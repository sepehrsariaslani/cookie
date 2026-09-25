import unittest

from smule_store.domain.cookie import calculate_custom_cookie


class TestCustomCookieCalculation(unittest.TestCase):
	def setUp(self):
		self.dough = {"smule_kcal_per_100g": 450}
		self.topping = {
			"smule_slug": "walnut",
			"smule_grams_per_50g": 4,
			"smule_kcal_per_100g": 654,
		}

	def test_toppings_add_weight_and_calories_to_the_base(self):
		result = calculate_custom_cookie(50, self.dough, [self.topping])

		self.assertEqual(result["base_weight_grams"], 50)
		self.assertEqual(result["final_weight_grams"], 54)
		self.assertEqual(result["estimated_calories"], 251)

	def test_rejects_invalid_base_weight(self):
		with self.assertRaises(ValueError):
			calculate_custom_cookie(155, self.dough, [])
		with self.assertRaises(ValueError):
			calculate_custom_cookie(52, self.dough, [])

	def test_rejects_duplicate_or_too_heavy_toppings(self):
		with self.assertRaises(ValueError):
			calculate_custom_cookie(50, self.dough, [self.topping, self.topping])

		heavy = {**self.topping, "smule_slug": "heavy", "smule_grams_per_50g": 21}
		with self.assertRaises(ValueError):
			calculate_custom_cookie(50, self.dough, [heavy])


if __name__ == "__main__":
	unittest.main()
