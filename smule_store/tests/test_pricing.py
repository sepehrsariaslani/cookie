import unittest

from smule_store.domain.pricing import calculate_custom_cookie_price


class TestCustomCookiePricing(unittest.TestCase):
	def test_prices_base_dough_and_scaled_toppings_by_gram(self):
		result = calculate_custom_cookie_price(
			50,
			250,
			{"banana": 6, "dark-chocolate": 6},
			{"banana": 800, "dark-chocolate": 1200},
		)

		self.assertEqual(result["unit_price"], 24_500)
		self.assertEqual([row["amount"] for row in result["breakdown"]], [12_500, 4_800, 7_200])

	def test_rejects_missing_base_rate(self):
		with self.assertRaisesRegex(ValueError, "قیمت فروش هر گرم"):
			calculate_custom_cookie_price(50, 0, {}, {})

	def test_rejects_missing_topping_rate(self):
		with self.assertRaisesRegex(ValueError, "قیمت فروش هر گرم"):
			calculate_custom_cookie_price(50, 250, {"banana": 6}, {})

	def test_rounds_to_currency_precision(self):
		result = calculate_custom_cookie_price(30, 0.333, {}, {})
		self.assertEqual(result["unit_price"], 9.99)


if __name__ == "__main__":
	unittest.main()
