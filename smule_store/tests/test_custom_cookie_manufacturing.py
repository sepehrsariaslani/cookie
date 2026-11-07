import unittest

from smule_store.domain.custom_cookie_manufacturing import build_material_quantities, grams_to_stock_qty


class TestCustomCookieManufacturing(unittest.TestCase):
	def test_recipe_materials_scale_to_sales_order_quantity(self):
		self.assertEqual(
			build_material_quantities(
				{"materials": [
					{"itemCode": "DOUGH", "grams": 50},
					{"itemCode": "TOP-1", "grams": 3},
				]},
				2,
			),
			[{"item_code": "DOUGH", "qty_grams": 100.0}, {"item_code": "TOP-1", "qty_grams": 6.0}],
		)

	def test_duplicate_item_codes_are_aggregated_and_sorted(self):
		self.assertEqual(
			build_material_quantities(
				{"materials": [
					{"itemCode": "TOP", "grams": 2},
					{"itemCode": "DOUGH", "grams": 50},
					{"itemCode": "TOP", "grams": 3},
				]},
				2,
			),
			[{"item_code": "DOUGH", "qty_grams": 100.0}, {"item_code": "TOP", "qty_grams": 10.0}],
		)

	def test_legacy_server_recipe_shape_is_read_without_client_data(self):
		self.assertEqual(
			build_material_quantities({
				"dough": {"itemCode": "DOUGH"},
				"base_weight_grams": 50,
				"toppings": [{"itemCode": "TOP", "slug": "sesame"}],
				"topping_amounts": {"sesame": 3},
			}, 3),
			[{"item_code": "DOUGH", "qty_grams": 150.0}, {"item_code": "TOP", "qty_grams": 9.0}],
		)

	def test_invalid_recipe_and_output_values_are_rejected(self):
		invalid_cases = [
			({"materials": [{"grams": 1}]}, 1),
			({"materials": [{"itemCode": "TOP", "grams": -1}]}, 1),
			({"materials": [{"itemCode": "TOP", "grams": float("nan")}]}, 1),
			({"materials": [{"itemCode": "TOP", "grams": 1}]}, 0),
			({"materials": [{"itemCode": "TOP", "grams": 1}]}, float("inf")),
		]
		for recipe, quantity in invalid_cases:
			with self.subTest(recipe=recipe, quantity=quantity), self.assertRaises(ValueError):
				build_material_quantities(recipe, quantity)

	def test_exact_gram_to_stock_uom_conversion(self):
		self.assertEqual(grams_to_stock_qty(50, 0.001), 0.05)
		self.assertEqual(grams_to_stock_qty(0, 0.001), 0.0)

	def test_missing_or_invalid_uom_conversion_is_rejected(self):
		for factor in (None, 0, -1, float("nan"), float("inf")):
			with self.subTest(factor=factor), self.assertRaises(ValueError):
				grams_to_stock_qty(50, factor)

		for grams in (-1, float("nan"), float("inf")):
			with self.subTest(grams=grams), self.assertRaises(ValueError):
				grams_to_stock_qty(grams, 1)


if __name__ == "__main__":
	unittest.main()
