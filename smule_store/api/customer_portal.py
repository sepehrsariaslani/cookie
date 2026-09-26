"""Authenticated customer portal backed by ERPNext's native records."""

import json
import re

import frappe
from frappe import _
from frappe.utils import escape_html
from frappe.website.utils import is_signup_disabled


def _fail(message):
	frappe.throw(_(message), frappe.ValidationError)


def _parse_payload(payload):
	if isinstance(payload, str):
		try:
			payload = json.loads(payload)
		except json.JSONDecodeError:
			_fail("اطلاعات واردشده قابل خواندن نیست.")
	if not isinstance(payload, dict):
		_fail("اطلاعات واردشده معتبر نیست.")
	return payload


def _require_customer_user():
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("برای دیدن اطلاعات حساب، ابتدا وارد شو."), frappe.PermissionError)

	user_type = frappe.db.get_value("User", user, "user_type")
	if user_type != "Website User":
		frappe.throw(_("این بخش برای حساب مشتریان فروشگاه است."), frappe.PermissionError)
	return user


def _get_customer_name_from_user(user):
	user_doc = frappe.get_cached_doc("User", user)
	name = " ".join(part for part in [user_doc.first_name, user_doc.last_name] if part).strip()
	return name or user_doc.full_name or user.split("@", 1)[0]


def _customer_for_user(user):
	"""Resolve only explicit ERPNext portal/contact links; never guess by phone."""
	customers = set(
		frappe.get_all(
			"Portal User",
			filters={"user": user, "parenttype": "Customer"},
			pluck="parent",
			limit_page_length=20,
		)
	)

	contacts = frappe.get_all("Contact", filters={"user": user}, pluck="name", limit_page_length=20)
	if contacts:
		customers.update(
			frappe.get_all(
				"Dynamic Link",
				filters={
					"parenttype": "Contact",
					"parent": ["in", contacts],
					"link_doctype": "Customer",
				},
				pluck="link_name",
				limit_page_length=20,
			)
		)

	customers.discard(None)
	if len(customers) > 1:
		frappe.throw(_("چند پروندهٔ مشتری به این حساب وصل است؛ لطفاً با پشتیبانی اسموله تماس بگیر."))
	return next(iter(customers), None)


def _customer_defaults_if_available():
	group = frappe.db.get_single_value("Selling Settings", "customer_group")
	territory = frappe.db.get_single_value("Selling Settings", "territory")
	if not group:
		group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name", order_by="lft asc")
	if not territory:
		territory = frappe.db.get_value("Territory", {"is_group": 0}, "name", order_by="lft asc")
	return group, territory


def _customer_defaults():
	group, territory = _customer_defaults_if_available()
	if not group or not territory:
		_fail("گروه مشتری و قلمرو پیش‌فرض در ERPNext کامل نیست؛ مدیر فروشگاه باید آن‌ها را تنظیم کند.")
	return group, territory


def _get_or_create_customer_for_user(user):
	customer_name = _customer_for_user(user)
	if customer_name:
		customer = frappe.get_doc("Customer", customer_name)
		if not any(row.user == user for row in customer.portal_users):
			customer.append("portal_users", {"user": user})
			customer.save(ignore_permissions=True)
		return customer

	group, territory = _customer_defaults()
	name = _get_customer_name_from_user(user)
	customer = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": escape_html(name)[:140],
			"customer_type": "Individual",
			"customer_group": group,
			"territory": territory,
			"email_id": user,
			"portal_users": [{"user": user}],
		}
	)
	customer.insert(ignore_permissions=True)
	return customer


def get_customer_for_current_user():
	"""Resolve the signed-in storefront user and ensure a native ERPNext Customer."""
	return _get_or_create_customer_for_user(_require_customer_user())


def _normalize_phone(value):
	digit_map = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
	return re.sub(r"\D", "", str(value or "").translate(digit_map))


def _profile(customer, user):
	phone = customer.mobile_no if customer else ""
	if customer and customer.customer_primary_contact:
		phone = frappe.db.get_value("Contact", customer.customer_primary_contact, "mobile_no") or phone
	return {
		"customer": customer.name if customer else None,
		"fullName": customer.customer_name if customer else _get_customer_name_from_user(user),
		"email": user,
		"phone": phone or "",
	}


def _owned_address_names(customer):
	if not customer:
		return []
	rows = frappe.get_all(
		"Dynamic Link",
		filters={
			"parenttype": "Address",
			"link_doctype": "Customer",
			"link_name": customer,
		},
		pluck="parent",
		limit_page_length=100,
	)
	return list(dict.fromkeys(rows))


def _addresses(customer):
	names = _owned_address_names(customer)
	if not names:
		return []
	return frappe.get_all(
		"Address",
		filters={"name": ["in", names], "disabled": 0},
		fields=[
			"name",
			"address_title",
			"address_line1",
			"address_line2",
			"city",
			"state",
			"pincode",
			"country",
			"is_primary_address",
		],
		order_by="is_primary_address desc, modified desc",
		limit_page_length=100,
	)


def _order_history(customer):
	if not customer:
		return [], []

	requests = frappe.get_all(
		"Smule Order Request",
		filters={"customer": customer},
		fields=[
			"name",
			"status",
			"creation",
			"delivery_method",
			"requested_for_date",
			"requested_for_time",
			"ready_subtotal",
			"currency",
			"sales_order",
			"payment_status",
		],
		order_by="creation desc",
		limit_page_length=100,
	)
	request_names = [row.name for row in requests]
	request_items = {}
	if request_names:
		for row in frappe.get_all(
			"Smule Order Request Item",
			filters={"parent": ["in", request_names], "parenttype": "Smule Order Request"},
			fields=["parent", "line_type", "title_fa", "qty", "unit_price", "quote_required"],
			limit_page_length=1000,
		):
			request_items.setdefault(row.parent, []).append(
				{
					"title": row.title_fa,
					"quantity": row.qty,
					"quoteRequired": bool(row.quote_required),
				}
			)

	sales_orders = frappe.get_all(
		"Sales Order",
		filters={"customer": customer, "docstatus": ["!=", 2]},
		fields=[
			"name",
			"status",
			"docstatus",
			"transaction_date",
			"delivery_date",
			"grand_total",
			"advance_paid",
			"currency",
			"delivery_status",
		],
		order_by="creation desc",
		limit_page_length=100,
	)
	sales_order_names = [row.name for row in sales_orders]
	request_by_sales_order = {row.sales_order: row for row in requests if row.sales_order}
	sales_items = {}
	if sales_order_names:
		item_fields = ["parent", "item_name", "qty", "amount"]
		if frappe.get_meta("Sales Order Item").has_field("smule_cookie_recipe_summary"):
			item_fields.append("smule_cookie_recipe_summary")
		for row in frappe.get_all(
			"Sales Order Item",
			filters={"parent": ["in", sales_order_names], "parenttype": "Sales Order"},
			fields=item_fields,
			limit_page_length=1000,
		):
			sales_items.setdefault(row.parent, []).append(
				{
					"title": row.get("smule_cookie_recipe_summary") or row.item_name,
					"quantity": row.qty,
				}
			)

	orders = []
	for row in sales_orders:
		request = request_by_sales_order.get(row.name)
		orders.append(
			{
				"name": row.name,
				"kind": "sales-order",
				"status": row.status,
				"date": row.transaction_date,
				"deliveryDate": row.delivery_date,
				"total": row.grand_total,
				"paid": row.advance_paid,
				"currency": row.currency,
				"deliveryStatus": row.delivery_status,
				"requestedForTime": request.requested_for_time if request else None,
				"requestName": request.name if request else None,
				"paymentStatus": request.payment_status if request else None,
				"items": sales_items.get(row.name, []),
			}
		)

	known_sales_orders = set(sales_order_names)
	for row in requests:
		if row.sales_order and row.sales_order in known_sales_orders:
			continue
		orders.append(
			{
				"name": row.name,
				"kind": "order-request",
				"status": row.status,
				"date": row.creation,
				"deliveryDate": row.requested_for_date,
				"requestedForTime": row.requested_for_time,
				"total": row.ready_subtotal,
				"paid": 0,
				"currency": row.currency,
				"paymentStatus": row.payment_status,
				"items": request_items.get(row.name, []),
			}
		)
	orders.sort(key=lambda row: str(row.get("date") or ""), reverse=True)

	payments = frappe.get_all(
		"Payment Entry",
		filters={
			"party_type": "Customer",
			"party": customer,
			"payment_type": "Receive",
			"docstatus": 1,
		},
		fields=[
			"name",
			"posting_date",
			"received_amount",
			"paid_to_account_currency",
			"mode_of_payment",
			"status",
		],
		order_by="posting_date desc, creation desc",
		limit_page_length=100,
	)
	return orders, payments


def _portal_data_for_user(user):
	customer_name = _customer_for_user(user)
	customer = frappe.get_doc("Customer", customer_name) if customer_name else None
	orders, payments = _order_history(customer_name)
	countries = frappe.get_all("Country", fields=["name"], order_by="name asc", limit_page_length=300)
	group, territory = _customer_defaults_if_available() if not customer else (True, True)
	return {
		"authenticated": True,
		"signupEnabled": not is_signup_disabled(),
		"signupEmailReady": bool(
			frappe.get_all(
				"Email Account",
				filters={"enable_outgoing": 1},
				pluck="name",
				limit_page_length=1,
			)
		),
		"profile": _profile(customer, user),
		"accountReady": bool(customer),
		"customerSetupReady": bool(group and territory),
		"addresses": _addresses(customer_name),
		"orders": orders,
		"payments": payments,
		"countries": [row.name for row in countries],
	}


@frappe.whitelist(allow_guest=True)
def get_portal_data():
	"""Return public account-creation availability and the signed-in user's data."""
	user = frappe.session.user
	if user == "Guest" or frappe.db.get_value("User", user, "user_type") != "Website User":
		return {
			"authenticated": False,
			"signupEnabled": not is_signup_disabled(),
			"signupEmailReady": bool(
				frappe.get_all(
					"Email Account",
					filters={"enable_outgoing": 1},
					pluck="name",
					limit_page_length=1,
				)
			),
		}
	return _portal_data_for_user(user)


def _split_name(full_name):
	parts = full_name.split(maxsplit=1)
	return parts[0], parts[1] if len(parts) > 1 else ""


def _sync_contact(customer, user, full_name, phone):
	if not customer.customer_primary_contact:
		return
	contact = frappe.get_doc("Contact", customer.customer_primary_contact)
	if contact.user and contact.user != user:
		frappe.throw(_("راه ارتباطی این مشتری به حساب دیگری وصل شده است."), frappe.PermissionError)
	first_name, last_name = _split_name(full_name)
	contact.first_name = first_name
	contact.last_name = last_name
	contact.user = user
	primary = next((row for row in contact.phone_nos if row.is_primary_mobile_no), None)
	for row in contact.phone_nos:
		row.is_primary_mobile_no = 0
	if phone and primary:
		primary.phone = phone
		primary.is_primary_mobile_no = 1
	elif phone:
		contact.append("phone_nos", {"phone": phone, "is_primary_mobile_no": 1})
	elif primary:
		primary.phone = None
	contact.save(ignore_permissions=True)


def _require_post():
	request = getattr(frappe.local, "request", None)
	if request and request.method != "POST":
		_fail("این عملیات فقط با روش امن POST انجام می‌شود.")


@frappe.whitelist()
def update_profile(profile=None):
	_require_post()
	user = _require_customer_user()
	payload = _parse_payload(profile or frappe.form_dict.get("profile"))
	full_name = str(payload.get("fullName") or "").strip()
	phone = _normalize_phone(payload.get("phone"))
	if len(full_name) < 2 or len(full_name) > 140:
		_fail("نام و نام خانوادگی را کامل وارد کن.")
	if phone and not 10 <= len(phone.lstrip("+")) <= 15:
		_fail("شمارهٔ تماس باید بین ۱۰ تا ۱۵ رقم باشد.")
	if phone:
		other_users = frappe.get_all(
			"User",
			filters={"name": ["!=", user]},
			fields=["name", "mobile_no"],
		)
		if any(_normalize_phone(row.mobile_no) == phone for row in other_users if row.mobile_no):
			_fail("این شمارهٔ موبایل قبلاً به حساب دیگری وصل شده است.")

	customer = _get_or_create_customer_for_user(user)
	customer.customer_name = escape_html(full_name)
	customer.mobile_no = phone or None
	customer.save(ignore_permissions=True)
	first_name, last_name = _split_name(escape_html(full_name))
	user_doc = frappe.get_doc("User", user)
	user_doc.first_name = first_name
	user_doc.last_name = last_name
	user_doc.mobile_no = phone or None
	user_doc.save(ignore_permissions=True)
	_sync_contact(customer, user, escape_html(full_name), phone)
	return _portal_data_for_user(user)


def _address_for_customer(address_name, customer):
	if not address_name or address_name not in _owned_address_names(customer.name):
		frappe.throw(_("این نشانی در حساب تو پیدا نشد."), frappe.PermissionError)
	return frappe.get_doc("Address", address_name)


def _set_primary_address(address, customer):
	if not address.is_primary_address:
		return
	for name in _owned_address_names(customer.name):
		if name == address.name:
			continue
		other = frappe.get_doc("Address", name)
		if other.is_primary_address:
			other.is_primary_address = 0
			other.save(ignore_permissions=True)


@frappe.whitelist()
def save_address(address=None):
	_require_post()
	user = _require_customer_user()
	payload = _parse_payload(address or frappe.form_dict.get("address"))
	city = str(payload.get("city") or "").strip()
	line1 = str(payload.get("addressLine1") or "").strip()
	if len(city) < 2 or len(city) > 100:
		_fail("نام شهر را کامل وارد کن.")
	if len(line1) < 5 or len(line1) > 240:
		_fail("نشانی را کامل وارد کن؛ حداقل ۵ نویسه لازم است.")

	customer = _get_or_create_customer_for_user(user)
	address_name = str(payload.get("name") or "").strip()
	address_doc = _address_for_customer(address_name, customer) if address_name else frappe.new_doc("Address")
	country = str(payload.get("country") or frappe.db.get_default("country") or "Iran").strip()
	if not frappe.db.exists("Country", country):
		_fail("کشور انتخاب‌شده در ERPNext پیدا نشد.")

	address_doc.address_title = str(payload.get("title") or city).strip()[:100]
	address_doc.address_type = "Personal"
	address_doc.address_line1 = line1
	address_doc.address_line2 = str(payload.get("addressLine2") or "").strip()[:240]
	address_doc.city = city
	address_doc.state = str(payload.get("state") or "").strip()[:100]
	address_doc.pincode = str(payload.get("postalCode") or "").strip()[:40]
	address_doc.country = country
	address_doc.is_primary_address = 1 if payload.get("isPrimary") else 0
	address_doc.disabled = 0
	if not address_name:
		address_doc.append("links", {"link_doctype": "Customer", "link_name": customer.name})
		address_doc.insert(ignore_permissions=True)
	else:
		address_doc.save(ignore_permissions=True)
	_set_primary_address(address_doc, customer)
	return _portal_data_for_user(user)


@frappe.whitelist()
def archive_address(name=None):
	_require_post()
	user = _require_customer_user()
	customer_name = _customer_for_user(user)
	if not customer_name:
		frappe.throw(_("هنوز نشانی‌ای برای این حساب ثبت نشده است."), frappe.PermissionError)
	customer = frappe.get_doc("Customer", customer_name)
	address_doc = _address_for_customer(str(name or frappe.form_dict.get("name") or "").strip(), customer)
	address_doc.links = [
		row
		for row in address_doc.links
		if not (row.link_doctype == "Customer" and row.link_name == customer.name)
	]
	if not address_doc.links:
		# Keep the record for historical ERPNext documents that may still reference it.
		address_doc.disabled = 1
		address_doc.is_primary_address = 0
	address_doc.save(ignore_permissions=True)
	return _portal_data_for_user(user)
