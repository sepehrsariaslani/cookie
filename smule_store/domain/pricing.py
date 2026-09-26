"""Deterministic Smule selling prices from verified ERPNext costs."""

from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP


PRICE_PRECISION = Decimal("0.01")


def _decimal(value, message):
	try:
		number = Decimal(str(value))
	except (InvalidOperation, TypeError, ValueError):
		raise ValueError(message) from None
	if not number.is_finite():
		raise ValueError(message)
	return number


def _positive_rate(value):
	rate = _decimal(value, "بهای هر گرم یکی از مواد در لیست خرید ERPNext معتبر نیست.")
	if rate <= 0:
		raise ValueError("بهای هر گرم یکی از مواد در لیست خرید ERPNext ثبت نشده است.")
	return rate


def calculate_selling_price(material_cost, markup_percent, rounding_increment, fixed_cost=0):
	"""Add configured fixed cost and markup, then round the customer price up.

	The percentage is a markup on cost, not a gross-margin percentage. All inputs
	and returned amounts use the company's currency (Smule currently requires IRR).
	"""
	cost = _decimal(material_cost, "بهای تمام‌شده برای قیمت‌گذاری معتبر نیست.")
	fixed = _decimal(fixed_cost, "هزینهٔ ثابت ساخت و بسته‌بندی معتبر نیست.")
	markup = _decimal(markup_percent, "درصد افزودهٔ قیمت‌گذاری معتبر نیست.")
	step = _decimal(rounding_increment, "گام گردکردن قیمت معتبر نیست.")
	if cost <= 0:
		raise ValueError("بهای تمام‌شدهٔ تأییدشده برای این محصول پیدا نشد.")
	if fixed < 0:
		raise ValueError("هزینهٔ ثابت ساخت و بسته‌بندی نمی‌تواند منفی باشد.")
	if markup < 0 or markup > 1000:
		raise ValueError("درصد افزوده باید بین صفر تا ۱۰۰۰ باشد.")
	if step <= 0:
		raise ValueError("گام گردکردن قیمت باید بیشتر از صفر باشد.")

	before_markup = cost + fixed
	markup_amount = before_markup * markup / Decimal("100")
	calculated = before_markup + markup_amount
	unit_price = (calculated / step).to_integral_value(rounding=ROUND_CEILING) * step
	unit_price = unit_price.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)

	return {
		"unit_price": float(unit_price),
		"material_cost": float(cost),
		"fixed_cost": float(fixed),
		"markup_percent": float(markup),
		"markup_amount": float(markup_amount.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)),
		"rounding_increment": float(step),
		"rounding_amount": float((unit_price - calculated).quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)),
	}


def calculate_custom_cookie_price(
	base_weight_grams,
	dough_rate_per_gram,
	topping_amounts,
	topping_rates_per_gram,
	markup_percent,
	rounding_increment,
	fixed_cost=0,
):
	"""Price a custom cookie from verified buying rates and save an audit trail."""
	if not isinstance(topping_amounts, dict) or not isinstance(topping_rates_per_gram, dict):
		raise ValueError("اطلاعات قیمت‌گذاری کوکی معتبر نیست.")

	base_grams = _decimal(base_weight_grams, "وزن خمیر برای قیمت‌گذاری معتبر نیست.")
	if base_grams <= 0:
		raise ValueError("وزن خمیر برای قیمت‌گذاری معتبر نیست.")

	components = [("خمیر پایه", base_grams, dough_rate_per_gram)]
	for slug, grams in topping_amounts.items():
		if slug not in topping_rates_per_gram:
			raise ValueError("بهای هر گرم یکی از مواد در لیست خرید ERPNext ثبت نشده است.")
		amount_grams = _decimal(grams, "مقدار یکی از مواد برای قیمت‌گذاری معتبر نیست.")
		if amount_grams <= 0:
			raise ValueError("مقدار یکی از مواد برای قیمت‌گذاری معتبر نیست.")
		components.append((slug, amount_grams, topping_rates_per_gram[slug]))

	breakdown = []
	total_cost = Decimal("0")
	for slug, amount_grams, raw_rate in components:
		rate = _positive_rate(raw_rate)
		line_total = amount_grams * rate
		total_cost += line_total
		breakdown.append(
			{
				"slug": slug,
				"grams": float(amount_grams),
				"cost_per_gram": float(rate),
				"material_cost": float(line_total.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)),
			}
		)

	pricing = calculate_selling_price(total_cost, markup_percent, rounding_increment, fixed_cost)
	return {**pricing, "breakdown": breakdown}
