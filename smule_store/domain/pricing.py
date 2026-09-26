"""Price custom cookies from configured ERPNext selling rates per gram."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


PRICE_PRECISION = Decimal("0.01")


def _decimal_rate(value):
	try:
		rate = Decimal(str(value))
	except (InvalidOperation, TypeError, ValueError):
		rate = Decimal("0")
	if not rate.is_finite() or rate <= 0:
		raise ValueError("قیمت فروش هر گرم برای یکی از مواد در ERPNext تنظیم نشده است.")
	return rate


def calculate_custom_cookie_price(base_weight_grams, dough_rate_per_gram, topping_amounts, topping_rates_per_gram):
	"""Return a server-calculated price and auditable per-component snapshot.

	All rates must come from the active ERPNext selling Price List in the Gram UOM.
	"""
	if not isinstance(topping_amounts, dict) or not isinstance(topping_rates_per_gram, dict):
		raise ValueError("اطلاعات قیمت‌گذاری کوکی معتبر نیست.")

	try:
		base_grams = Decimal(str(base_weight_grams))
	except (InvalidOperation, TypeError, ValueError):
		raise ValueError("وزن خمیر برای قیمت‌گذاری معتبر نیست.") from None
	if not base_grams.is_finite() or base_grams <= 0:
		raise ValueError("وزن خمیر برای قیمت‌گذاری معتبر نیست.")

	components = [("خمیر پایه", base_grams, dough_rate_per_gram)]
	for slug, grams in topping_amounts.items():
		if slug not in topping_rates_per_gram:
			raise ValueError("قیمت فروش هر گرم برای یکی از مواد در ERPNext تنظیم نشده است.")
		try:
			amount_grams = Decimal(str(grams))
		except (InvalidOperation, TypeError, ValueError):
			raise ValueError("مقدار یکی از مواد برای قیمت‌گذاری معتبر نیست.") from None
		if not amount_grams.is_finite() or amount_grams <= 0:
			raise ValueError("مقدار یکی از مواد برای قیمت‌گذاری معتبر نیست.")
		components.append((slug, amount_grams, topping_rates_per_gram[slug]))

	breakdown = []
	total = Decimal("0")
	for slug, amount_grams, raw_rate in components:
		rate = _decimal_rate(raw_rate)
		line_total = amount_grams * rate
		total += line_total
		breakdown.append(
			{
				"slug": slug,
				"grams": float(amount_grams),
				"rate_per_gram": float(rate),
				"amount": float(line_total.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)),
			}
		)

	return {
		"unit_price": float(total.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)),
		"breakdown": breakdown,
	}
