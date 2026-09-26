"""Guest-safe ZarinPal callback with server-side verification and ERPNext posting."""

import hashlib
import re

import frappe
from frappe.utils import get_url, today

from smule_store.domain.order_tracking import create_tracking_token, hash_tracking_token
from smule_store.domain.payment_retry import is_payment_retry_allowed
from smule_store.domain.payments import create_native_payment_request, get_live_payment_configuration
from smule_store.domain.zarinpal import (
	ZarinPalError,
	ZarinPalPendingError,
	normalize_amount_irr,
	verify_payment,
)


AUTHORITY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
PAYMENT_RETRYABLE_STATUSES = {"ناموفق", "لغوشده"}
PAYMENT_RETRY_PER_MINUTE = 5


def _redirect_to_receipt(order_name=None):
	if order_name and frappe.db.exists("Smule Order Request", order_name):
		token, token_hash = create_tracking_token()
		frappe.db.set_value(
			"Smule Order Request",
			order_name,
			"guest_tracking_token_hash",
			token_hash,
			update_modified=False,
		)
		location = f"{get_url('/order-confirmation')}#{token}"
	else:
		location = get_url("/order-confirmation/?payment=unavailable")
	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = location


def _mark_payment_status(order, status, reference_id=None):
	values = {"payment_status": status}
	if reference_id:
		values["zarinpal_reference_id"] = str(reference_id)[:140]
	frappe.db.set_value("Smule Order Request", order.name, values, update_modified=True)


def _existing_payment_entry(payment_request_name):
	if not payment_request_name:
		return None
	parents = frappe.get_all(
		"Payment Entry Reference",
		filters={"payment_request": payment_request_name},
		pluck="parent",
		limit_page_length=5,
	)
	for name in parents:
		if frappe.db.get_value("Payment Entry", name, "docstatus") == 1:
			return name
	return None


def _rate_limit_payment_retry():
	request = getattr(frappe.local, "request", None)
	remote = request.remote_addr if request else "unknown"
	digest = hashlib.sha256(remote.encode("utf-8")).hexdigest()[:24]
	key = f"smule_store:payment_retry:{digest}"
	cache = frappe.cache()
	count = int(cache.get_value(key) or 0)
	if count >= PAYMENT_RETRY_PER_MINUTE:
		frappe.throw("تلاش‌های پرداخت زیادی انجام شده؛ یک دقیقهٔ دیگر دوباره امتحان کن.", frappe.ValidationError)
	cache.set_value(key, count + 1, expires_in_sec=60)


@frappe.whitelist(allow_guest=True)
def retry_zarinpal_payment(order_name=None, token=None):
	"""Create a fresh authority only for a failed/cancelled, still-unpaid ERPNext order."""
	request = getattr(frappe.local, "request", None)
	if request and request.method != "POST":
		frappe.throw("درخواست پرداخت مجدد فقط با روش امن POST پذیرفته می‌شود.", frappe.ValidationError)
	_rate_limit_payment_retry()
	form = getattr(frappe, "form_dict", {})
	private_token = str(token or form.get("token") or "")
	customer_name = None
	if private_token:
		try:
			token_hash = hash_tracking_token(private_token)
		except ValueError as error:
			frappe.throw(str(error), frappe.ValidationError)
		order_name = frappe.db.get_value(
			"Smule Order Request", {"guest_tracking_token_hash": token_hash}, "name"
		)
		if not order_name:
			frappe.throw("پیوند پیگیری معتبر نیست یا دیگر در دسترس نیست.", frappe.PermissionError)
	else:
		order_name = str(order_name or form.get("order_name") or "").strip()
		if frappe.session.user == "Guest":
			frappe.throw("برای پرداخت مجدد، پیوند خصوصی پیگیری یا حساب مشتری لازم است.", frappe.PermissionError)
		from smule_store.api.customer_portal import get_customer_for_current_user

		customer_name = get_customer_for_current_user().name
		if not order_name or not frappe.db.exists("Smule Order Request", order_name):
			frappe.throw("سفارش برای پرداخت مجدد پیدا نشد.", frappe.PermissionError)
		if frappe.db.get_value("Smule Order Request", order_name, "customer") != customer_name:
			frappe.throw("این سفارش به حساب مشتری دیگری تعلق دارد.", frappe.PermissionError)

	# Serialize concurrent taps/retries before checking the payment state and creating another request.
	frappe.db.sql(
		"select name from `tabSmule Order Request` where name = %s for update",
		(order_name,),
	)
	order = frappe.get_doc("Smule Order Request", order_name)
	if customer_name and order.customer != customer_name:
		frappe.throw("این سفارش به حساب مشتری دیگری تعلق دارد.", frappe.PermissionError)
	if not order.payment_request or not order.sales_order:
		frappe.throw("برای این سفارش درخواست پرداخت ERPNext در دسترس نیست.", frappe.ValidationError)
	if order.payment_status not in PAYMENT_RETRYABLE_STATUSES:
		frappe.throw("این سفارش هنوز در وضعیت پرداخت مجدد نیست؛ ابتدا وضعیت پرداخت را تازه‌سازی کن.", frappe.ValidationError)

	old_request = frappe.get_doc("Payment Request", order.payment_request)
	if (
		old_request.reference_doctype != "Sales Order"
		or old_request.reference_name != order.sales_order
	):
		frappe.throw("وضعیت سند پرداخت سفارش نیازمند بررسی فروشگاه است.", frappe.ValidationError)
	if order.payment_entry and frappe.db.get_value("Payment Entry", order.payment_entry, "docstatus") == 1:
		frappe.throw("پرداخت این سفارش قبلاً ثبت شده و پرداخت مجدد مجاز نیست.", frappe.ValidationError)
	sales_order = frappe.get_doc("Sales Order", order.sales_order)
	try:
		request_amount = normalize_amount_irr(old_request.grand_total)
		order_amount = normalize_amount_irr(sales_order.grand_total)
	except ZarinPalError as error:
		frappe.throw(str(error), frappe.ValidationError)
	payment_entry_exists = bool(_existing_payment_entry(old_request.name))
	if not is_payment_retry_allowed(
		order.payment_status,
		old_request.status,
		old_request.docstatus,
		sales_order.docstatus,
		payment_entry_exists,
		float(sales_order.advance_paid or 0) > 0,
		request_amount == order_amount,
	) or sales_order.status in {"Closed", "Cancelled", "Completed"}:
		frappe.throw("این سفارش قابل پرداخت مجدد نیست؛ وضعیت آن را با فروشگاه بررسی کن.", frappe.ValidationError)

	settings = frappe.get_single("Smule Store Settings")
	payment_config = get_live_payment_configuration(settings, throw=True)
	payment = create_native_payment_request(order, sales_order, settings, payment_config)
	order.db_set(
		{
			"payment_request": payment["payment_request"],
			"zarinpal_authority": payment["authority"],
			"zarinpal_sandbox": payment["sandbox"],
			"payment_status": "در انتظار پرداخت",
		},
		update_modified=True,
	)
	return {
		"name": order.name,
		"paymentRequired": True,
		"paymentUrl": payment["payment_url"],
		"payableTotal": payment["amount"],
		"currency": sales_order.currency,
	}


@frappe.whitelist(allow_guest=True)
def zarinpal_callback(Authority=None, Status=None):
	"""Verify the amount and authority from ERPNext; never trust callback fields as proof."""
	request = getattr(frappe.local, "request", None)
	if request and request.method != "GET":
		frappe.throw("بازگشت درگاه فقط با روش GET پذیرفته می‌شود.", frappe.ValidationError)
	form = getattr(frappe, "form_dict", {})
	authority = str(Authority or form.get("Authority") or "")
	provider_status = str(Status or form.get("Status") or "")
	if not AUTHORITY_PATTERN.fullmatch(authority):
		frappe.throw("شناسهٔ بازگشت زرین‌پال معتبر نیست.", frappe.ValidationError)

	order_name = frappe.db.get_value("Smule Order Request", {"zarinpal_authority": authority}, "name")
	if not order_name:
		_redirect_to_receipt()
		return
	# Serialize duplicate provider callbacks with payment retries before either can
	# create a Payment Entry or change the order's payment state.
	locked_rows = frappe.db.sql(
		"""
		select name, payment_entry, payment_request, sales_order, zarinpal_sandbox
		from `tabSmule Order Request`
		where name = %s
		for update
		""",
		(order_name,),
		as_dict=True,
	)
	if not locked_rows:
		_redirect_to_receipt()
		return
	locked_order = locked_rows[0]
	order = frappe.get_doc("Smule Order Request", order_name)
	# Read linkage from the locking query: under concurrent callbacks, an earlier
	# transaction may have committed after this request's initial authority lookup.
	order.payment_entry = locked_order.payment_entry
	order.payment_request = locked_order.payment_request
	order.sales_order = locked_order.sales_order
	order.zarinpal_sandbox = locked_order.zarinpal_sandbox
	if order.payment_entry and frappe.db.get_value("Payment Entry", order.payment_entry, "docstatus") == 1:
		_redirect_to_receipt(order.name)
		return

	if provider_status.upper() != "OK":
		_mark_payment_status(order, "لغوشده" if provider_status.upper() in {"NOK", "CANCELLED"} else "ناموفق")
		if order.payment_request:
			frappe.db.set_value("Payment Request", order.payment_request, "status", "Failed")
		_redirect_to_receipt(order.name)
		return

	settings = frappe.get_single("Smule Store Settings")
	merchant_id = settings.get_password("zarinpal_merchant_id", raise_exception=False)
	if not merchant_id or not order.payment_request:
		_mark_payment_status(order, "تأییدشده در درگاه؛ نیازمند تطبیق")
		_redirect_to_receipt(order.name)
		return

	payment_request = frappe.get_doc("Payment Request", order.payment_request)
	if (
		payment_request.docstatus != 1
		or payment_request.reference_doctype != "Sales Order"
		or not payment_request.reference_name
	):
		_mark_payment_status(order, "تأییدشده در درگاه؛ نیازمند تطبیق")
		_redirect_to_receipt(order.name)
		return
	sales_order = frappe.get_doc("Sales Order", payment_request.reference_name)
	try:
		request_amount = normalize_amount_irr(payment_request.grand_total)
		order_amount = normalize_amount_irr(sales_order.grand_total)
	except ZarinPalError:
		request_amount = order_amount = 0
	if (
		sales_order.docstatus != 1
		or payment_request.currency != "IRR"
		or sales_order.currency != "IRR"
		or request_amount <= 0
		or request_amount != order_amount
	):
		_mark_payment_status(order, "تأییدشده در درگاه؛ نیازمند تطبیق")
		_redirect_to_receipt(order.name)
		return

	try:
		verification = verify_payment(
			merchant_id,
			request_amount,
			authority,
			sandbox=bool(order.zarinpal_sandbox),
		)
	except ZarinPalPendingError:
		# A timeout does not prove a failed payment; leave the submitted Payment Request open.
		_mark_payment_status(order, "در انتظار پرداخت")
		_redirect_to_receipt(order.name)
		return
	except ZarinPalError:
		_mark_payment_status(order, "ناموفق")
		frappe.db.set_value("Payment Request", payment_request.name, "status", "Failed")
		_redirect_to_receipt(order.name)
		return

	ref_id = verification["reference_id"]
	_mark_payment_status(order, "تأییدشده در درگاه؛ نیازمند تطبیق", ref_id)
	try:
		entry_name = _existing_payment_entry(payment_request.name)
		if not entry_name:
			entry = payment_request.create_payment_entry(submit=False)
			entry.reference_no = ref_id
			entry.reference_date = today()
			entry.remarks = f"پرداخت زرین‌پال؛ سفارش اسموله {order.name}؛ کد رهگیری {ref_id}"
			entry.insert(ignore_permissions=True)
			entry.flags.ignore_permissions = True
			entry.submit()
			entry_name = entry.name
		frappe.db.set_value(
			"Smule Order Request",
			order.name,
			{"payment_entry": entry_name, "payment_status": "پرداخت‌شده", "status": "پرداخت‌شده"},
			update_modified=True,
		)
	except Exception:
		# Payment is provider-verified. Keep its provider reference visible for safe reconciliation.
		frappe.log_error(
			"زرین‌پال پرداخت را تأیید کرده اما ساخت Payment Entry خودکار انجام نشد.",
			f"Smule payment reconciliation: {order.name}",
		)
	_redirect_to_receipt(order.name)
