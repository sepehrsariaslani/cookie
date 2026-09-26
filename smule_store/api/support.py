"""Customer-facing support intake stored in ERPNext's native Issue DocType."""

import hashlib

import frappe

from smule_store.domain.support import format_support_description, normalize_support_submission


SUPPORT_REQUESTS_PER_MINUTE = 5


def _rate_limit_support_request():
	request = getattr(frappe.local, "request", None)
	remote = getattr(request, "remote_addr", None) or "unknown"
	digest = hashlib.sha256(remote.encode("utf-8")).hexdigest()[:24]
	key = f"smule_store:support_request:{digest}"
	cache = frappe.cache()
	count = int(cache.get_value(key) or 0)
	if count >= SUPPORT_REQUESTS_PER_MINUTE:
		frappe.throw("پیام‌های زیادی از این اتصال فرستاده شده؛ یک دقیقهٔ دیگر دوباره تلاش کن.", frappe.ValidationError)
	cache.set_value(key, count + 1, expires_in_sec=60)


@frappe.whitelist(allow_guest=True)
def submit_support_request(name=None, email=None, topic=None, message=None, website=None):
	"""Accept a limited public support message without enabling checkout or payment."""
	request = getattr(frappe.local, "request", None)
	if request and request.method != "POST":
		frappe.throw("ارسال پیام فقط با درخواست امن POST پذیرفته می‌شود.", frappe.ValidationError)

	# A hidden honeypot is a low-cost spam check. Return the same success shape without storing it.
	if website:
		return {"accepted": True, "message": "پیام ثبت شد. زمان پاسخ‌گویی از طرف فروشگاه اعلام نشده است."}

	_rate_limit_support_request()
	try:
		submission = normalize_support_submission(name, email, topic, message)
	except ValueError as error:
		frappe.throw(str(error), frappe.ValidationError)

	issue = frappe.get_doc(
		{
			"doctype": "Issue",
			"subject": f"پیام سایت اسموله · {submission['topic']}",
			"description": format_support_description(submission),
			# Keep unverified visitor emails in the message body, not ERPNext's identity link.
			"raised_by": "website@smule.invalid",
			"status": "Open",
		}
	).insert(ignore_permissions=True)

	return {"accepted": True, "message": "پیام ثبت شد. زمان پاسخ‌گویی از طرف فروشگاه اعلام نشده است."}
