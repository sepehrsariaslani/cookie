"""Store-specific delivery constraints for Smule orders."""

import unicodedata


def normalize_delivery_city(value):
	city = unicodedata.normalize("NFKC", str(value or ""))
	city = city.replace("ك", "ک").replace("ي", "ی").replace("ى", "ی")
	city = " ".join(city.split())
	if city != "کرج":
		raise ValueError("ارسال اسموله فعلاً فقط در شهر کرج انجام می‌شود.")
	return city
