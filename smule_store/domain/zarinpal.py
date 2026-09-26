"""Small, fixed-host ZarinPal adapter; amounts are always integer Iranian Rial."""

from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import requests


PRODUCTION_ORIGIN = "https://payment.zarinpal.com"
SANDBOX_ORIGIN = "https://sandbox.zarinpal.com"
MIN_AMOUNT_IRR = 10_000


class ZarinPalError(ValueError):
	"""A safe-to-display payment error with no provider credentials or payloads."""


class ZarinPalPendingError(ZarinPalError):
	"""The provider could not be reached, so payment outcome is not yet known."""


def normalize_amount_irr(value):
	try:
		amount = Decimal(str(value))
	except (InvalidOperation, TypeError, ValueError):
		raise ZarinPalError("مبلغ سفارش برای پرداخت معتبر نیست.")
	if not amount.is_finite() or amount != amount.to_integral_value():
		raise ZarinPalError("مبلغ سفارش باید عدد صحیح و به ریال باشد.")
	if amount < MIN_AMOUNT_IRR:
		raise ZarinPalError("حداقل مبلغ قابل پرداخت در زرین‌پال ۱۰٬۰۰۰ ریال است.")
	return int(amount)


def _provider_json(response):
	try:
		response.raise_for_status()
		payload = response.json()
	except (requests.RequestException, ValueError, AttributeError):
		raise ZarinPalError("ارتباط امن با درگاه برقرار نشد؛ سفارش ثبت نشد.")
	if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
		raise ZarinPalError("پاسخ درگاه پرداخت قابل تأیید نیست.")
	return payload


def create_payment(merchant_id, amount_irr, callback_url, description, sandbox=False, post=None):
	"""Create one ZarinPal authority and return its fixed-origin payment URL."""
	amount = normalize_amount_irr(amount_irr)
	merchant_id = str(merchant_id or "").strip()
	if not merchant_id or len(merchant_id) > 100:
		raise ZarinPalError("شناسهٔ پذیرندهٔ زرین‌پال تنظیم نشده است.")
	if not str(callback_url or "").startswith("https://"):
		raise ZarinPalError("نشانی امن بازگشت از درگاه تنظیم نشده است.")

	origin = SANDBOX_ORIGIN if sandbox else PRODUCTION_ORIGIN
	send = post or requests.post
	try:
		response = send(
			f"{origin}/pg/v4/payment/request.json",
			json={
				"merchant_id": merchant_id,
				"amount": amount,
				"callback_url": callback_url,
				"description": str(description or "سفارش فروشگاه اسموله")[:250],
			},
			timeout=(5, 20),
		)
	except requests.RequestException:
		raise ZarinPalError("ارتباط امن با درگاه برقرار نشد؛ سفارش ثبت نشد.")

	payload = _provider_json(response)
	if payload.get("data", {}).get("code") != 100:
		raise ZarinPalError("درگاه نتوانست پرداخت این سفارش را آماده کند.")
	authority = payload["data"].get("authority")
	if not isinstance(authority, str) or not authority or len(authority) > 64:
		raise ZarinPalError("درگاه شناسهٔ پرداخت معتبری برنگرداند.")
	return {
		"authority": authority,
		"payment_url": f"{origin}/pg/StartPay/{quote(authority, safe='')}",
	}


def verify_payment(merchant_id, amount_irr, authority, sandbox=False, post=None):
	"""Verify the provider result against the amount loaded from the ERP order."""
	amount = normalize_amount_irr(amount_irr)
	authority = str(authority or "")
	if not authority or len(authority) > 64:
		raise ZarinPalError("شناسهٔ پرداخت معتبر نیست.")

	origin = SANDBOX_ORIGIN if sandbox else PRODUCTION_ORIGIN
	send = post or requests.post
	try:
		response = send(
			f"{origin}/pg/v4/payment/verify.json",
			json={"merchant_id": str(merchant_id), "amount": amount, "authority": authority},
			timeout=(5, 20),
		)
	except requests.RequestException:
		raise ZarinPalPendingError("تأیید پرداخت از درگاه دریافت نشد؛ وضعیت سفارش در انتظار بررسی است.")

	try:
		payload = _provider_json(response)
	except ZarinPalError:
		# A malformed or non-success HTTP response cannot prove that the charge failed.
		raise ZarinPalPendingError("پاسخ قطعی تأیید از درگاه دریافت نشد؛ وضعیت سفارش در انتظار بررسی است.")
	code = payload.get("data", {}).get("code")
	if code not in (100, 101):
		raise ZarinPalError("پرداخت در زرین‌پال تأیید نشد.")
	ref_id = payload["data"].get("ref_id")
	if ref_id is None or not str(ref_id).strip():
		raise ZarinPalError("درگاه کد رهگیری معتبری برنگرداند.")
	return {"code": code, "reference_id": str(ref_id)}
