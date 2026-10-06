"""Public order-request intake and controlled conversion to ERPNext Sales Order."""

import hashlib
import json
import re

import frappe
from frappe.utils import add_days, now_datetime, today

from smule_store.api.storefront import _get_prices, _get_ready_product_prices
from smule_store.domain.cookie import calculate_custom_cookie
from smule_store.domain.delivery import normalize_delivery_city
from smule_store.domain.order_tracking import create_tracking_token, hash_tracking_token
from smule_store.domain.payments import create_native_payment_request, get_live_payment_configuration
from smule_store.domain.pricing import calculate_custom_cookie_price
from smule_store.domain.scheduling import normalize_coordinates, normalize_requested_schedule

MAX_ORDER_LINES = 30
MAX_ORDER_QUANTITY = 20
RATE_LIMIT_PER_MINUTE = 8
GUEST_LOOKUP_RATE_LIMIT_PER_MINUTE = 30


def _fail(message):
	frappe.throw(message, frappe.ValidationError)


def _parse_payload(payload):
	if isinstance(payload, str):
		try:
			payload = json.loads(payload)
		except json.JSONDecodeError:
			_fail("اطلاعات سفارش قابل خواندن نیست.")
	if not isinstance(payload, dict):
		_fail("اطلاعات سفارش معتبر نیست.")
	return payload


def _normalize_phone(value):
	digit_map = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
	return re.sub(r"\D", "", str(value or "").translate(digit_map))


def _rate_limit_request():
	request = getattr(frappe.local, "request", None)
	remote = request.remote_addr if request else "unknown"
	digest = hashlib.sha256(remote.encode("utf-8")).hexdigest()[:24]
	key = f"smule_store:order_request:{digest}"
	cache = frappe.cache()
	count = int(cache.get_value(key) or 0)
	if count >= RATE_LIMIT_PER_MINUTE:
		_fail("درخواست‌های زیادی ثبت شده؛ یک دقیقهٔ دیگر دوباره تلاش کن.")
	cache.set_value(key, count + 1, expires_in_sec=60)


def _rate_limit_guest_lookup():
	request = getattr(frappe.local, "request", None)
	remote = request.remote_addr if request else "unknown"
	digest = hashlib.sha256(remote.encode("utf-8")).hexdigest()[:24]
	key = f"smule_store:guest_order_lookup:{digest}"
	cache = frappe.cache()
	count = int(cache.get_value(key) or 0)
	if count >= GUEST_LOOKUP_RATE_LIMIT_PER_MINUTE:
		_fail("درخواست‌های پیگیری زیادی ثبت شده؛ کمی بعد دوباره تلاش کن.")
	cache.set_value(key, count + 1, expires_in_sec=60)


def _get_existing_checkout_result(idempotency_hash):
	name = frappe.db.get_value("Smule Order Request", {"checkout_idempotency_hash": idempotency_hash}, "name")
	if not name:
		return None
	order = frappe.get_doc("Smule Order Request", name)
	if not order.payment_request:
		_fail("ثبت سفارش قبلی در حال تکمیل است؛ کمی بعد دوباره تلاش کن.")
	payment_request = frappe.get_doc("Payment Request", order.payment_request)
	token, token_hash = create_tracking_token()
	order.db_set("guest_tracking_token_hash", token_hash, update_modified=False)
	paid = order.payment_status == "پرداخت‌شده"
	retry_pending_attempt = order.payment_status in {"ناموفق", "لغوشده"}
	return {
		"name": order.name,
		"status": order.status,
		"readySubtotal": order.ready_subtotal,
		"payableTotal": payment_request.grand_total,
		"currency": payment_request.currency,
		"paymentRequired": not paid,
		"paymentUrl": payment_request.payment_url if not paid and not retry_pending_attempt else None,
		"trackingToken": token,
		"requestedForDate": order.requested_for_date,
		"requestedForTime": order.requested_for_time,
	}


def _get_store_item(slug, expected_type):
	if not isinstance(slug, str) or not slug or len(slug) > 140:
		_fail("یکی از اجزای انتخاب‌شده معتبر نیست.")
	expected_types = expected_type if isinstance(expected_type, (list, tuple)) else [expected_type]
	rows = frappe.get_all(
		"Item",
		filters={
			"disabled": 0,
			"smule_enabled_in_storefront": 1,
			"smule_slug": slug,
			"smule_storefront_type": ["in", expected_types],
		},
		fields=[
			"name",
			"item_name",
			"smule_slug",
			"smule_display_name_fa",
			"smule_grams_per_50g",
			"smule_kcal_per_100g",
			"smule_component_group",
			"smule_recipe_is_sample",
		],
		limit_page_length=2,
	)
	if len(rows) != 1:
		_fail("این طعم یا افزودنی دیگر در دسترس نیست.")
	return rows[0]


def _normalize_quantity(value):
	if isinstance(value, bool):
		_fail("تعداد یکی از اقلام معتبر نیست.")
	try:
		quantity = int(value)
		if float(value) != quantity:
			raise ValueError
	except (TypeError, ValueError):
		_fail("تعداد یکی از اقلام معتبر نیست.")
	if quantity < 1 or quantity > MAX_ORDER_QUANTITY:
		_fail("تعداد هر قلم باید بین ۱ تا ۲۰ باشد.")
	return quantity


def _read_product_line(line, settings, price_cache):
	slug = line.get("productSlug") or line.get("slug")
	item = _get_store_item(slug, "Product")
	if not frappe.db.get_value("Item", item.name, "is_sales_item"):
		_fail("یکی از کوکی‌های آماده برای فروش تنظیم نشده است.")
	if item.smule_recipe_is_sample:
		_fail("اطلاعات یکی از کوکی‌های آماده هنوز در آشپزخانه تأیید نشده است.")
	price = price_cache.get(item.name)
	if not price:
		_fail("برای یکی از کوکی‌های آماده، BOM پیش‌فرضِ فعال و بهای ساخت معتبر در ERPNext پیدا نشد.")
	price_snapshot = {
		"method": "ERPNext submitted default BOM cost plus configured markup",
		"bom": price["bom_name"],
		"bomQuantity": price["bom_quantity"],
		"bomTotalCost": price["bom_total_cost"],
		"unitCost": price["material_cost"],
		"markupPercent": price["markup_percent"],
		"markupAmount": price["markup_amount"],
		"roundingIncrement": price["rounding_increment"],
		"roundingAmount": price["rounding_amount"],
		"unitPrice": price["unit_price"],
		"currency": frappe.db.get_value("Price List", settings.selling_price_list, "currency"),
	}
	return {
		"line_type": "کوکی آماده",
		"item_code": item.name,
		"title_fa": item.smule_display_name_fa or item.item_name,
		"qty": _normalize_quantity(line.get("quantity", 1)),
		"unit_price": price["unit_price"],
		"quote_required": 0,
		"pricing_snapshot": json.dumps(price_snapshot, ensure_ascii=False, separators=(",", ":")),
	}


def _read_custom_line(line, settings):
	dough_slug = line.get("doughId") or line.get("doughSlug")
	dough = _get_store_item(dough_slug, "Dough")
	selected = line.get("toppingIds") or line.get("toppingSlugs") or []
	if not isinstance(selected, list):
		_fail("فهرست افزودنی‌ها معتبر نیست.")
	if len(selected) > 6:
		_fail("هر کوکی حداکثر ۶ افزودنی می‌تواند داشته باشد.")
	toppings = [_get_store_item(slug, ("Topping", "Flavor")) for slug in selected]
	if dough.smule_recipe_is_sample or any(item.smule_recipe_is_sample for item in toppings):
		_fail("دستور یکی از خمیرها یا افزودنی‌ها هنوز در آشپزخانه تأیید نشده است.")
	base_weight = line.get("sizeGrams", line.get("baseWeightGrams"))
	try:
		calculation = calculate_custom_cookie(base_weight, dough, toppings)
	except (TypeError, ValueError) as error:
		_fail(str(error))

	component_prices = _get_prices(
		[dough.name, *(item.name for item in toppings)],
		settings.material_cost_price_list,
		uom="Gram",
		selling=False,
	)
	dough_price = component_prices.get(dough.name)
	if not dough_price or dough_price.price_list_rate <= 0 or dough.smule_recipe_is_sample:
		_fail("بهای خرید هر گرم خمیر را در لیست بهای مواد ERPNext تنظیم کنید.")
	topping_rates_per_gram = {}
	for item in toppings:
		price = component_prices.get(item.name)
		if not price or price.price_list_rate <= 0 or item.smule_recipe_is_sample:
			_fail("بهای خرید هر گرم خمیر و همهٔ افزودنی‌ها را در لیست بهای مواد ERPNext تنظیم کنید.")
		topping_rates_per_gram[item.smule_slug] = price.price_list_rate
	try:
		pricing = calculate_custom_cookie_price(
			calculation["base_weight_grams"],
			dough_price.price_list_rate,
			calculation["topping_amounts"],
			topping_rates_per_gram,
			settings.markup_percentage,
			settings.price_rounding_increment,
			settings.custom_cookie_fixed_cost or 0,
		)
	except ValueError as error:
		_fail(str(error))

	dough_name = dough.smule_display_name_fa or dough.item_name
	topping_names = [item.smule_display_name_fa or item.item_name for item in toppings]
	summary = f"{dough_name} · بیس {calculation['base_weight_grams']:g} گرم"
	if topping_names:
		summary += " · " + "، ".join(topping_names)

	recipe = {
		"dough": {"itemCode": dough.name, "slug": dough.smule_slug, "name": dough_name},
		"toppings": [
			{"itemCode": item.name, "slug": item.smule_slug, "name": item.smule_display_name_fa or item.item_name}
			for item in toppings
		],
		"pricing": {
			"method": "ERPNext Buying Item Price per Gram plus configured markup",
			"currency": frappe.db.get_value("Price List", settings.selling_price_list, "currency") if settings.selling_price_list else None,
			"unitPrice": pricing["unit_price"],
			"materialCost": pricing["material_cost"],
			"fixedCost": pricing["fixed_cost"],
			"markupPercent": pricing["markup_percent"],
			"markupAmount": pricing["markup_amount"],
			"roundingIncrement": pricing["rounding_increment"],
			"roundingAmount": pricing["rounding_amount"],
			"breakdown": pricing["breakdown"],
		},
		**calculation,
	}
	return {
		"line_type": "کوکی سفارشی",
		"title_fa": summary,
		"qty": _normalize_quantity(line.get("quantity", 1)),
		"unit_price": pricing["unit_price"],
		"quote_required": 0,
		"pricing_snapshot": json.dumps(recipe["pricing"], ensure_ascii=False, separators=(",", ":")),
		"recipe_summary": summary,
		"recipe_json": json.dumps(recipe, ensure_ascii=False, separators=(",", ":")),
		"base_weight_grams": calculation["base_weight_grams"],
		"final_weight_grams": calculation["final_weight_grams"],
		"estimated_calories": calculation["estimated_calories"],
	}


@frappe.whitelist(allow_guest=True)
def create_order_request(order=None):
	"""Create a validated ERPNext Sales Order and pending Payment Request."""
	request = getattr(frappe.local, "request", None)
	if request and request.method != "POST":
		_fail("ثبت درخواست فقط با روش POST انجام می‌شود.")
	_rate_limit_request()
	payload = _parse_payload(order or frappe.form_dict.get("order"))
	if payload.get("website"):
		_fail("ثبت درخواست ناموفق بود.")

	settings = frappe.get_single("Smule Store Settings")
	if not settings.online_orders_enabled:
		_fail("ثبت سفارش آنلاین هنوز از سوی فروشگاه فعال نشده است.")
	payment_config = get_live_payment_configuration(settings, throw=True)
	idempotency_key = str(payload.get("idempotencyKey") or "")
	if not re.fullmatch(r"[A-Za-z0-9_-]{43}", idempotency_key):
		_fail("نشست ثبت سفارش معتبر نیست؛ صفحه را تازه‌سازی کن.")
	idempotency_hash = hashlib.sha256(idempotency_key.encode("ascii")).hexdigest()
	existing_result = _get_existing_checkout_result(idempotency_hash)
	if existing_result:
		return existing_result

	customer_data = payload.get("customer")
	if not isinstance(customer_data, dict):
		_fail("اطلاعات مشتری معتبر نیست.")
	name = str(customer_data.get("name", "")).strip()
	phone = _normalize_phone(customer_data.get("phone"))
	if len(name) < 2 or len(name) > 140:
		_fail("نام مشتری را کامل وارد کن.")
	if len(phone) < 10 or len(phone) > 15:
		_fail("شمارهٔ تماس معتبر نیست.")
	schedule = payload.get("schedule") or {}
	if not isinstance(schedule, dict):
		_fail("زمان درخواستی دریافت معتبر نیست.")
	try:
		requested_for_date, requested_for_time = normalize_requested_schedule(
			schedule.get("date"), schedule.get("time"), today(), now_datetime().strftime("%H:%M:%S")
		)
		latitude, longitude = normalize_coordinates(
			customer_data.get("latitude"), customer_data.get("longitude")
		)
	except ValueError as error:
		_fail(str(error))

	delivery = payload.get("deliveryMethod")
	if delivery not in {"pickup", "delivery"}:
		_fail("روش دریافت سفارش معتبر نیست.")
	if delivery == "pickup":
		if not settings.pickup_address:
			_fail("نشانی تحویل حضوری هنوز توسط فروشگاه ثبت نشده است.")
		delivery_method = "تحویل حضوری"
		delivery_address = settings.pickup_address
	else:
		if not settings.delivery_enabled:
			_fail("ارسال سفارش هنوز توسط فروشگاه فعال نشده است.")
		if not settings.delivery_fee_collection:
			_fail("روش دریافت هزینهٔ اسنپ‌پیک هنوز توسط فروشگاه تنظیم نشده است.")
		if (
			settings.delivery_fee_collection == "افزودن به مبلغ زرین‌پال"
			and (not settings.delivery_fee or not settings.delivery_charge_item)
		):
			_fail("مبلغ و کالای هزینهٔ اسنپ‌پیک هنوز در ERPNext تنظیم نشده است.")
		try:
			city = normalize_delivery_city(customer_data.get("city"))
		except ValueError as error:
			_fail(str(error))
		address = str(customer_data.get("address", "")).strip()
		if len(city) < 2 or len(address) < 8:
			_fail("برای ارسال، شهر و نشانی کامل لازم است.")
		delivery_method = "ارسال"
		delivery_address = f"{city}، {address}"

	customer_link = None
	if frappe.session.user != "Guest":
		from smule_store.api.customer_portal import get_customer_for_current_user

		customer_link = get_customer_for_current_user().name
	tracking_token, tracking_token_hash = create_tracking_token()

	lines = payload.get("items")
	if not isinstance(lines, list) or not lines or len(lines) > MAX_ORDER_LINES:
		_fail("سبد سفارش خالی یا بزرگ‌تر از حد مجاز است.")
	price_list = settings.selling_price_list or frappe.db.get_single_value("Selling Settings", "selling_price_list")
	product_slugs = list(
		dict.fromkeys(
			(line.get("productSlug") or line.get("slug"))
			for line in lines
			if isinstance(line, dict)
			and (line.get("kind") == "product" or line.get("productSlug") or line.get("slug"))
			and isinstance(line.get("productSlug") or line.get("slug"), str)
		)
	)
	product_items = frappe.get_all(
		"Item",
		filters={
			"disabled": 0,
			"smule_enabled_in_storefront": 1,
			"smule_slug": ["in", product_slugs],
			"smule_storefront_type": "Product",
		},
		fields=["name"],
		limit_page_length=MAX_ORDER_LINES,
	) if product_slugs else []
	price_cache = _get_ready_product_prices([item.name for item in product_items], settings)

	request_items = []
	for line in lines:
		if not isinstance(line, dict):
			_fail("یکی از اقلام سبد معتبر نیست.")
		if line.get("kind") == "product" or line.get("productSlug") or line.get("slug"):
			request_items.append(_read_product_line(line, settings, price_cache))
		elif line.get("kind") == "custom" or line.get("doughId") or line.get("doughSlug"):
			request_items.append(_read_custom_line(line, settings))
		else:
			_fail("نوع یکی از اقلام سبد پشتیبانی نمی‌شود.")

	price_currency = frappe.db.get_value("Price List", price_list, "currency") if price_list else None
	order_doc = frappe.get_doc(
		{
			"doctype": "Smule Order Request",
			"customer_name": name,
			"phone": phone,
			"customer": customer_link,
			"delivery_method": delivery_method,
			"delivery_address": delivery_address,
			"requested_for_date": requested_for_date,
			"requested_for_time": requested_for_time,
			"delivery_latitude": latitude if delivery == "delivery" else None,
			"delivery_longitude": longitude if delivery == "delivery" else None,
			"guest_tracking_token_hash": tracking_token_hash,
			"checkout_idempotency_hash": idempotency_hash,
			"customer_note": str(customer_data.get("note", ""))[:2000],
			"currency": price_currency,
			"items": request_items,
		}
	)
	try:
		order_doc.insert(ignore_permissions=True)
	except frappe.DuplicateEntryError:
		existing_result = _get_existing_checkout_result(idempotency_hash)
		if existing_result:
			return existing_result
		raise
	sales_order = _create_sales_order(order_doc, settings, submit=True)
	payment = create_native_payment_request(order_doc, sales_order, settings, payment_config)
	order_doc.db_set(
		{
			"customer": sales_order.customer,
			"status": "تبدیل به سفارش فروش",
			"payment_status": "در انتظار پرداخت",
			"zarinpal_authority": payment["authority"],
			"zarinpal_sandbox": payment["sandbox"],
			"payment_request": payment["payment_request"],
			"sales_order": sales_order.name,
		},
		update_modified=True,
	)
	return {
		"name": order_doc.name,
		"status": "تبدیل به سفارش فروش",
		"readySubtotal": order_doc.ready_subtotal,
		"payableTotal": payment["amount"],
		"currency": sales_order.currency,
		"paymentRequired": True,
		"paymentUrl": payment["payment_url"],
		"trackingToken": tracking_token,
		"requestedForDate": order_doc.requested_for_date,
		"requestedForTime": order_doc.requested_for_time,
	}


@frappe.whitelist(allow_guest=True)
def get_guest_order_status(token=None):
	"""Read a minimal order status using a private token; never expose contact or address data."""
	request = getattr(frappe.local, "request", None)
	if request and request.method != "POST":
		_fail("پیگیری سفارش فقط با روش امن POST انجام می‌شود.")
	_rate_limit_guest_lookup()
	try:
		token_hash = hash_tracking_token(token or frappe.form_dict.get("token"))
	except ValueError:
		_fail("این پیوند پیگیری معتبر نیست یا دیگر در دسترس نیست.")

	order = frappe.db.get_value(
		"Smule Order Request",
		{"guest_tracking_token_hash": token_hash},
		[
			"name",
			"status",
			"creation",
			"delivery_method",
			"requested_for_date",
			"requested_for_time",
			"ready_subtotal",
			"currency",
			"payment_status",
			"payment_request",
			"customer",
			"sales_order",
		],
		as_dict=True,
	)
	if not order:
		_fail("این پیوند پیگیری معتبر نیست یا دیگر در دسترس نیست.")

	delivery_status = None
	if order.sales_order and order.customer:
		delivery_status = frappe.db.get_value(
			"Sales Order",
			{"name": order.sales_order, "customer": order.customer, "docstatus": ["!=", 2]},
			"delivery_status",
		)

	items = frappe.get_all(
		"Smule Order Request Item",
		filters={"parent": order.name, "parenttype": "Smule Order Request"},
		fields=["title_fa", "qty", "quote_required"],
		order_by="idx asc",
		limit_page_length=MAX_ORDER_LINES,
	)
	return {
		"name": order.name,
		"status": order.status,
		"createdAt": order.creation,
		"deliveryMethod": order.delivery_method,
		"deliveryStatus": delivery_status,
		"requestedForDate": order.requested_for_date,
		"requestedForTime": order.requested_for_time,
		"readySubtotal": order.ready_subtotal,
		"currency": order.currency,
		"paymentRequired": bool(order.payment_request and order.payment_status != "پرداخت‌شده"),
		"paymentStatus": order.payment_status or "",
		"paymentAmount": (
			frappe.db.get_value("Payment Request", order.payment_request, "grand_total")
			if order.payment_request
			else order.ready_subtotal
		),
		"items": [
			{"title": row.title_fa, "quantity": row.qty, "quoteRequired": bool(row.quote_required)}
			for row in items
		],
	}


def _get_customer_group_and_territory():
	group = frappe.db.get_single_value("Selling Settings", "customer_group")
	territory = frappe.db.get_single_value("Selling Settings", "territory")
	if not group:
		group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name", order_by="lft asc")
	if not territory:
		territory = frappe.db.get_value("Territory", {"is_group": 0}, "name", order_by="lft asc")
	if not group or not territory:
		_fail("گروه مشتری و قلمرو پیش‌فرض را در تنظیمات ERPNext مشخص کنید.")
	return group, territory


def _get_or_create_customer(order_request):
	if order_request.customer and frappe.db.exists("Customer", order_request.customer):
		return order_request.customer
	customer = frappe.db.get_value("Customer", {"smule_phone_number": order_request.phone}, "name")
	if customer:
		return customer
	group, territory = _get_customer_group_and_territory()
	doc = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": order_request.customer_name,
			"customer_type": "Individual",
			"customer_group": group,
			"territory": territory,
			"smule_phone_number": order_request.phone,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _create_sales_order(order_request, settings, submit=False):
	"""Build the ERPNext Sales Order once for staff drafts and paid web checkout."""
	company = settings.company
	price_list = settings.selling_price_list
	if not company or not price_list:
		_fail("شرکت و لیست قیمت را در تنظیمات فروشگاه اسموله مشخص کنید.")
	customer = _get_or_create_customer(order_request)
	order_request.customer = customer
	so_items = []
	for line in order_request.items:
		if line.quote_required and (line.unit_price or 0) <= 0:
			_fail(f"ابتدا قیمت «{line.title_fa}» را تعیین کنید.")
		item_code = line.item_code if line.line_type == "کوکی آماده" else settings.custom_cookie_item
		if not item_code:
			_fail("کالای پایهٔ کوکی سفارشی را در تنظیمات فروشگاه انتخاب کنید.")
		item_fields = {"item_code": item_code, "qty": line.qty, "rate": line.unit_price}
		if line.line_type == "کوکی سفارشی":
			item_fields.update(
				{
					"description": line.recipe_summary,
					"smule_cookie_recipe_summary": line.recipe_summary,
					"smule_cookie_recipe_json": line.recipe_json,
					"smule_cookie_base_weight_grams": line.base_weight_grams,
					"smule_cookie_final_weight_grams": line.final_weight_grams,
					"smule_cookie_estimated_calories": line.estimated_calories,
					"smule_cookie_quote_required": int(bool(line.quote_required)),
				}
			)
		so_items.append(item_fields)
	if (
		order_request.delivery_method == "ارسال"
		and settings.delivery_fee_collection == "افزودن به مبلغ زرین‌پال"
	):
		so_items.append(
			{
				"item_code": settings.delivery_charge_item,
				"qty": 1,
				"rate": settings.delivery_fee,
				"description": "هزینهٔ ثابت ارسال با اسنپ‌پیک",
			}
		)

	sales_order = frappe.get_doc(
		{
			"doctype": "Sales Order",
			"customer": customer,
			"company": company,
			"transaction_date": today(),
			"delivery_date": order_request.requested_for_date or add_days(today(), 1),
			"selling_price_list": price_list,
			"items": so_items,
			"smule_delivery_method": order_request.delivery_method,
			"smule_delivery_address": order_request.delivery_address,
			"smule_customer_note": order_request.customer_note,
			"smule_customer_phone": order_request.phone,
			"smule_requested_for_time": order_request.requested_for_time,
			"smule_delivery_latitude": order_request.delivery_latitude,
			"smule_delivery_longitude": order_request.delivery_longitude,
			"remarks": f"درخواست وب اسموله: {order_request.name}؛ "
			+ ("سفارش ثبت‌شده در انتظار پرداخت زرین‌پال." if submit else "پیش‌نویس برای بررسی فروشگاه."),
		}
	)
	sales_order.flags.ignore_pricing_rule = True
	sales_order.insert(ignore_permissions=True)
	if submit:
		sales_order.flags.ignore_permissions = True
		sales_order.submit()
	return sales_order


@frappe.whitelist()
def convert_to_sales_order(name):
	"""Convert a reviewed request to a native, unsubmitted ERPNext Sales Order."""
	allowed_roles = {"System Manager", "Sales Manager"}
	if not allowed_roles.intersection(frappe.get_roles()):
		frappe.throw("برای تبدیل درخواست، دسترسی مدیر فروش لازم است.", frappe.PermissionError)
	if not frappe.has_permission("Sales Order", "create"):
		frappe.throw("دسترسی ساخت سفارش فروش ندارید.", frappe.PermissionError)

	order_request = frappe.get_doc("Smule Order Request", name)
	order_request.check_permission("write")
	if order_request.sales_order:
		return {"name": order_request.sales_order, "status": "already-converted"}
	if order_request.status == "ردشده":
		_fail("درخواست ردشده قابل تبدیل نیست.")

	settings = frappe.get_single("Smule Store Settings")
	sales_order = _create_sales_order(order_request, settings, submit=False)

	order_request.db_set(
		{"customer": sales_order.customer, "sales_order": sales_order.name, "status": "تبدیل به سفارش فروش"},
		update_modified=True,
	)
	return {"name": sales_order.name, "status": "draft"}
