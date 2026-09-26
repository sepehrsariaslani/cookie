"""Public order-request intake and controlled conversion to ERPNext Sales Order."""

import hashlib
import json
import re

import frappe
from frappe.utils import add_days, today

from smule_store.api.storefront import _get_prices
from smule_store.domain.cookie import calculate_custom_cookie
from smule_store.domain.order_tracking import create_tracking_token, hash_tracking_token
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


def _read_product_line(line, price_list, price_cache):
	slug = line.get("productSlug") or line.get("slug")
	item = _get_store_item(slug, "Product")
	if not frappe.db.get_value("Item", item.name, "is_sales_item"):
		_fail("یکی از کوکی‌های آماده برای فروش تنظیم نشده است.")
	if item.smule_recipe_is_sample:
		_fail("اطلاعات یکی از کوکی‌های آماده هنوز در آشپزخانه تأیید نشده است.")
	price = price_cache.get(item.name)
	if not price:
		price = _get_prices([item.name], price_list).get(item.name)
	if not price or price.price_list_rate <= 0:
		_fail("قیمت یکی از کوکی‌های آماده هنوز در ERPNext تنظیم نشده است.")
	return {
		"line_type": "کوکی آماده",
		"item_code": item.name,
		"title_fa": item.smule_display_name_fa or item.item_name,
		"qty": _normalize_quantity(line.get("quantity", 1)),
		"unit_price": price.price_list_rate,
		"quote_required": 0,
	}


def _read_custom_line(line):
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
		**calculation,
	}
	return {
		"line_type": "کوکی سفارشی",
		"title_fa": summary,
		"qty": _normalize_quantity(line.get("quantity", 1)),
		"unit_price": 0,
		"quote_required": 1,
		"recipe_summary": summary,
		"recipe_json": json.dumps(recipe, ensure_ascii=False, separators=(",", ":")),
		"base_weight_grams": calculation["base_weight_grams"],
		"final_weight_grams": calculation["final_weight_grams"],
		"estimated_calories": calculation["estimated_calories"],
	}


@frappe.whitelist(allow_guest=True)
def create_order_request(order=None):
	"""Store a validated website request; never charges or submits an invoice."""
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
			schedule.get("date"), schedule.get("time"), today()
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
		city = str(customer_data.get("city", "")).strip()
		address = str(customer_data.get("address", "")).strip()
		if len(city) < 2 or len(address) < 8:
			_fail("برای ارسال، شهر و نشانی کامل لازم است.")
		delivery_method = "ارسال"
		delivery_address = f"{city}، {address}"

	customer_link = None
	if frappe.session.user != "Guest":
		from smule_store.api.customer_portal import get_customer_for_current_user

		customer_link = get_customer_for_current_user().name
	tracking_token = None
	tracking_token_hash = None
	if frappe.session.user == "Guest":
		tracking_token, tracking_token_hash = create_tracking_token()

	lines = payload.get("items")
	if not isinstance(lines, list) or not lines or len(lines) > MAX_ORDER_LINES:
		_fail("سبد سفارش خالی یا بزرگ‌تر از حد مجاز است.")
	price_list = settings.selling_price_list or frappe.db.get_single_value("Selling Settings", "selling_price_list")
	price_cache = _get_prices(
		[
			item.name
			for line in lines
			if isinstance(line, dict) and (line.get("productSlug") or line.get("slug"))
			for item in frappe.get_all(
				"Item",
				filters={
					"disabled": 0,
					"smule_enabled_in_storefront": 1,
					"smule_slug": line.get("productSlug") or line.get("slug"),
					"smule_storefront_type": "Product",
				},
				fields=["name"],
				limit_page_length=1,
			)
		],
		price_list,
	)

	request_items = []
	for line in lines:
		if not isinstance(line, dict):
			_fail("یکی از اقلام سبد معتبر نیست.")
		if line.get("kind") == "product" or line.get("productSlug") or line.get("slug"):
			request_items.append(_read_product_line(line, price_list, price_cache))
		elif line.get("kind") == "custom" or line.get("doughId") or line.get("doughSlug"):
			request_items.append(_read_custom_line(line))
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
			"customer_note": str(customer_data.get("note", ""))[:2000],
			"currency": price_currency,
			"items": request_items,
		}
	)
	order_doc.insert(ignore_permissions=True)
	return {
		"name": order_doc.name,
		"status": order_doc.status,
		"readySubtotal": order_doc.ready_subtotal,
		"currency": order_doc.currency,
		"paymentRequired": False,
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
		],
		as_dict=True,
	)
	if not order:
		_fail("این پیوند پیگیری معتبر نیست یا دیگر در دسترس نیست.")

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
		"requestedForDate": order.requested_for_date,
		"requestedForTime": order.requested_for_time,
		"readySubtotal": order.ready_subtotal,
		"currency": order.currency,
		"paymentRequired": False,
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
	company = settings.company
	price_list = settings.selling_price_list
	if not company or not price_list:
		_fail("شرکت و لیست قیمت را در تنظیمات فروشگاه اسموله مشخص کنید.")

	customer = _get_or_create_customer(order_request)
	order_request.customer = customer
	custom_item = settings.custom_cookie_item
	so_items = []
	for line in order_request.items:
		if line.quote_required and (line.unit_price or 0) <= 0:
			_fail(f"ابتدا قیمت «{line.title_fa}» را تعیین کنید.")
		item_code = line.item_code if line.line_type == "کوکی آماده" else custom_item
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
					"smule_cookie_quote_required": 1,
				}
			)
		so_items.append(item_fields)

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
			"remarks": f"درخواست وب اسموله: {order_request.name}؛ ثبت اولیهٔ پیش‌نویس، بدون دریافت وجه.",
		}
	)
	sales_order.flags.ignore_pricing_rule = True
	sales_order.insert(ignore_permissions=True)

	order_request.sales_order = sales_order.name
	order_request.status = "تبدیل به سفارش فروش"
	order_request.save(ignore_permissions=True)
	return {"name": sales_order.name, "status": "draft"}
