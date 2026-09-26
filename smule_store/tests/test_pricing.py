import unittest

from smule_store.domain.pricing import calculate_custom_cookie_price, calculate_selling_price


class TestCustomCookiePricing(unittest.TestCase):
	def test_custom_cookie_adds_fixed_cost_markup_and_upward_rounding(self):
		result = calculate_custom_cookie_price(
			50,
			250,
			{"banana": 6, "dark-chocolate": 6},
			{"banana": 800, "dark-chocolate": 1200},
			30,
			1000,
			2500,
		)

		self.assertEqual(result["unit_price"], 36_000)
		self.assertEqual(result["material_cost"], 24_500)
		self.assertEqual(result["fixed_cost"], 2500)
		self.assertEqual(result["markup_amount"], 8100)
		self.assertEqual(result["rounding_amount"], 900)
		self.assertEqual([row["material_cost"] for row in result["breakdown"]], [12_500, 4_800, 7_200])

	def test_rejects_missing_base_rate(self):
		with self.assertRaisesRegex(ValueError, "بهای هر گرم"):
			calculate_custom_cookie_price(50, 0, {}, {}, 30, 1000)

	def test_rejects_missing_topping_rate(self):
		with self.assertRaisesRegex(ValueError, "بهای هر گرم"):
			calculate_custom_cookie_price(50, 250, {"banana": 6}, {}, 30, 1000)

	def test_ready_product_price_adds_markup_and_rounds_up(self):
		result = calculate_selling_price(10_000, 25, 1000)
		self.assertEqual(result["unit_price"], 13_000)
		self.assertEqual(result["markup_amount"], 2500)

	def test_rejects_invalid_markup_and_rounding(self):
		with self.assertRaisesRegex(ValueError, "درصد افزوده"):
			calculate_selling_price(100, -1, 1)
		with self.assertRaisesRegex(ValueError, "گام گردکردن"):
			calculate_selling_price(100, 10, 0)


if __name__ == "__main__":
	unittest.main()
