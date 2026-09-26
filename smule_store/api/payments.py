"""Guest-safe ZarinPal callback with server-side verification and ERPNext posting."""

import re

import frappe
from frappe.utils import get_url, today

from smule_store.domain.order_tracking import create_tracking_token
from smule_store.domain.zarinpal import (
	ZarinPalError,
	ZarinPalPendingError,
	normalize_amount_irr,
	verify_payment,
)


AUTHORITY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


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
	order = frappe.get_doc("Smule Order Request", order_name)
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
