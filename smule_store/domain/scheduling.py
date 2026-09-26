"""Validation helpers for customer-requested pickup and delivery times."""

from datetime import date
import math
import re


_PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_requested_schedule(requested_date, requested_time, today_value):
	date_value = str(requested_date or "").strip().translate(_PERSIAN_DIGITS)
	time_value = str(requested_time or "").strip().translate(_PERSIAN_DIGITS)
	if not date_value:
		if time_value:
			raise ValueError("برای انتخاب ساعت، ابتدا تاریخ را مشخص کنید.")
		return None, None

	try:
		selected_date = date.fromisoformat(date_value)
		current_date = date.fromisoformat(str(today_value)[:10])
	except (TypeError, ValueError):
		raise ValueError("تاریخ درخواستی معتبر نیست.") from None

	if selected_date < current_date:
		raise ValueError("تاریخ دریافت نمی‌تواند در گذشته باشد.")

	if time_value:
		match = re.fullmatch(r"((?:[01]\d|2[0-3]):[0-5]\d)(?::00)?", time_value)
		if not match:
			raise ValueError("ساعت درخواستی را به‌صورت ۲۴ ساعته وارد کنید.")
		time_value = f"{match.group(1)}:00"

	return selected_date.isoformat(), time_value or None


def normalize_coordinates(latitude, longitude):
	lat_value = str("" if latitude is None else latitude).strip().translate(_PERSIAN_DIGITS)
	lon_value = str("" if longitude is None else longitude).strip().translate(_PERSIAN_DIGITS)
	if not lat_value and not lon_value:
		return None, None
	if not lat_value or not lon_value:
		raise ValueError("برای ثبت موقعیت، هر دو مختصات لازم است.")

	try:
		lat = float(lat_value)
		lon = float(lon_value)
	except (TypeError, ValueError):
		raise ValueError("موقعیت انتخاب‌شده معتبر نیست.") from None

	if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
		raise ValueError("موقعیت انتخاب‌شده خارج از محدودهٔ معتبر است.")
	return lat, lon
