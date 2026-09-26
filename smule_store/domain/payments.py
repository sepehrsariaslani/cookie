"""ERPNext-native order/payment records for the Smule storefront."""

import frappe
from frappe.utils import get_url

from smule_store.domain.zarinpal import ZarinPalError, create_payment, normalize_amount_irr


def get_live_payment_configuration(settings, throw=False):
	"""Return secure payment configuration only when the live checkout is safe."""
	def fail(message):
		if throw:
			frappe.throw(message, frappe.ValidationError)
		return None

	if not settings.online_orders_enabled or not settings.zarinpal_enabled:
		return fail("ثبت سفارش آنلاین یا پرداخت زرین‌پال فعال نیست.")
	if settings.zarinpal_sandbox:
		return fail("حالت آزمایشی زرین‌پال روشن است؛ فروش واقعی غیرفعال می‌ماند.")
	merchant_id = settings.get_password("zarinpal_merchant_id", raise_exception=False)
	if not merchant_id:
		return fail("شناسهٔ پذیرندهٔ زرین‌پال در تنظیمات امن نشده است.")
	if not settings.company or not settings.selling_price_list:
		return fail("شرکت و لیست قیمت فروشگاه کامل نیست.")
	if not settings.mode_of_payment or not settings.payment_account:
		return fail("روش پرداخت و حساب دریافت وجه ERPNext کامل نیست.")
	if not settings.pickup_address and not settings.delivery_enabled:
		return fail("روش تحویل سفارش هنوز توسط فروشگاه تنظیم نشده است.")
	if frappe.db.get_value("Price List", settings.selling_price_list, "currency") != "IRR":
		return fail("ارز لیست قیمت باید برای زرین‌پال ریال (IRR) باشد.")
	if frappe.get_cached_value("Company", settings.company, "default_currency") != "IRR":
		return fail("ارز پیش‌فرض شرکت باید برای تسویهٔ زرین‌پال ریال (IRR) باشد.")
	account = frappe.db.get_value(
		"Account",
		settings.payment_account,
		["company", "account_type", "account_currency", "is_group", "disabled"],
		as_dict=True,
	)
	if (
		not account
		or account.company != settings.company
		or account.account_type not in {"Bank", "Cash"}
		or account.is_group
		or account.disabled
		or (account.account_currency and account.account_currency != "IRR")
	):
		return fail("حساب دریافت باید بانک یا وجه نقد ریالی و متعلق به شرکت فروشنده باشد.")
	if not frappe.db.exists(
		"Mode of Payment Account",
		{"parent": settings.mode_of_payment, "company": settings.company, "default_account": settings.payment_account},
	):
		return fail("حساب بانکی انتخاب‌شده را به همان روش پرداخت و شرکت در ERPNext وصل کنید.")
	return {"merchant_id": merchant_id, "sandbox": False}


def create_native_payment_request(order_request, sales_order, settings, config):
	"""Create the provider authority and submitted ERPNext Payment Request."""
	if sales_order.currency != "IRR":
		frappe.throw("ارز سفارش فروش باید ریال (IRR) باشد.", frappe.ValidationError)
	try:
		amount = normalize_amount_irr(sales_order.grand_total)
	except ZarinPalError as error:
		frappe.throw(str(error), frappe.ValidationError)

	callback_url = get_url("/api/method/smule_store.api.payments.zarinpal_callback")
	try:
		payment = create_payment(
			config["merchant_id"],
			amount,
			callback_url,
			f"پرداخت سفارش اسموله {order_request.name}",
			sandbox=config["sandbox"],
		)
	except ZarinPalError as error:
		frappe.throw(str(error), frappe.ValidationError)

	request = frappe.get_doc(
		{
			"doctype": "Payment Request",
			"payment_request_type": "Inward",
			"company": sales_order.company,
			"mode_of_payment": settings.mode_of_payment,
			"party_type": "Customer",
			"party": sales_order.customer,
			"party_name": sales_order.customer_name,
			"reference_doctype": "Sales Order",
			"reference_name": sales_order.name,
			"currency": sales_order.currency,
			"party_account_currency": sales_order.party_account_currency,
			"grand_total": amount,
			"payment_account": settings.payment_account,
			"payment_channel": "Other",
			"payment_url": payment["payment_url"],
			"subject": f"پرداخت سفارش اسموله {order_request.name}",
			"mute_email": 1,
		}
	)
	request.insert(ignore_permissions=True)
	request.flags.ignore_permissions = True
	request.submit()

	return {
		"payment_request": request.name,
		"payment_url": payment["payment_url"],
		"authority": payment["authority"],
		"amount": amount,
		"sandbox": bool(config["sandbox"]),
	}
