"""Pure cookie-configuration calculations shared by the public API and tests."""

from collections.abc import Sequence

MAX_BASE_WEIGHT_GRAMS = 150
MIN_BASE_WEIGHT_GRAMS = 30
BASE_WEIGHT_STEP_GRAMS = 5
MAX_TOPPING_COUNT = 6
MAX_TOPPING_WEIGHT_RATIO = 0.4


def calculate_custom_cookie(base_weight, dough, toppings: Sequence[dict]):
	if isinstance(base_weight, bool) or not isinstance(base_weight, (int, float)):
		raise ValueError("وزن پایه معتبر نیست.")
	if base_weight < MIN_BASE_WEIGHT_GRAMS or base_weight > MAX_BASE_WEIGHT_GRAMS:
		raise ValueError("وزن پایه باید بین ۳۰ تا ۱۵۰ گرم باشد.")
	if base_weight % BASE_WEIGHT_STEP_GRAMS:
		raise ValueError("وزن پایه باید با گام‌های ۵ گرمی انتخاب شود.")
	if not dough:
		raise ValueError("نوع خمیر انتخاب‌شده معتبر نیست.")
	if len(toppings) > MAX_TOPPING_COUNT:
		raise ValueError("هر کوکی حداکثر ۶ افزودنی می‌تواند داشته باشد.")

	grams_by_topping = {}
	for topping in toppings:
		slug = topping.get("smule_slug")
		if not slug or slug in grams_by_topping:
			raise ValueError("افزودنی تکراری یا نامعتبر است.")
		grams_per_50 = max(0.0, float(topping.get("smule_grams_per_50g") or 0))
		grams_by_topping[slug] = round(grams_per_50 * base_weight / 50, 1)

	topping_weight = round(sum(grams_by_topping.values()), 1)
	if topping_weight > base_weight * MAX_TOPPING_WEIGHT_RATIO + 0.001:
		raise ValueError("وزن افزودنی‌ها از ظرفیت این اندازهٔ کوکی بیشتر است.")

	calories = float(dough.get("smule_kcal_per_100g") or 0) * base_weight / 100
	for topping in toppings:
		grams = grams_by_topping[topping["smule_slug"]]
		calories += float(topping.get("smule_kcal_per_100g") or 0) * grams / 100

	return {
		"base_weight_grams": round(float(base_weight), 1),
		"topping_weight_grams": topping_weight,
		"final_weight_grams": round(float(base_weight) + topping_weight, 1),
		"estimated_calories": round(calories),
		"topping_amounts": grams_by_topping,
	}
