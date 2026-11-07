import unittest
from types import SimpleNamespace

from smule_store.domain import storefront_catalog


class TestStorefrontStockStatus(unittest.TestCase):
	def helper(self, name):
		result = getattr(storefront_catalog, name, None)
		self.assertTrue(callable(result), f"{name} must be implemented")
		return result

	def test_stock_item_without_warehouse_is_unavailable(self):
		get_stock_status = self.helper("get_stock_status")
		self.assertEqual(
			get_stock_status(True, None),
			{"available": False, "availableQty": 0, "availabilityReason": "warehouse_not_configured"},
		)

	def test_available_stock_subtracts_reservations_and_floors_at_zero(self):
		get_stock_status = self.helper("get_stock_status")
		self.assertEqual(
			get_stock_status(True, "Cookies - B", actual_qty=3, reserved_qty=3),
			{"available": False, "availableQty": 0, "availabilityReason": "out_of_stock"},
		)
		self.assertEqual(
			get_stock_status(True, "Cookies - B", actual_qty=5, reserved_qty=2),
			{"available": True, "availableQty": 3, "availabilityReason": "in_stock"},
		)

	def test_non_stock_item_does_not_require_bin_quantity(self):
		get_stock_status = self.helper("get_stock_status")
		self.assertEqual(
			get_stock_status(False, None),
			{"available": True, "availableQty": None, "availabilityReason": "non_stock_item"},
		)

	def test_selling_price_fields_copy_the_item_price_row(self):
		product_price_fields = self.helper("product_price_fields")
		self.assertEqual(
			product_price_fields(SimpleNamespace(price_list_rate=2_500_000, currency="IRR")),
			{"price": 2_500_000, "currency": "IRR"},
		)
		self.assertEqual(product_price_fields(None), {"price": None, "currency": None})

	def test_order_quantity_cannot_exceed_unreserved_stock(self):
		can_fulfill_quantity = self.helper("can_fulfill_quantity")
		status = {"available": True, "availableQty": 3, "availabilityReason": "in_stock"}
		self.assertTrue(can_fulfill_quantity(status, 3))
		self.assertFalse(can_fulfill_quantity(status, 4))
		self.assertFalse(can_fulfill_quantity(status, 0))
		self.assertFalse(can_fulfill_quantity(status, float("nan")))

	def test_order_quantity_for_non_stock_item_only_requires_positive_qty(self):
		can_fulfill_quantity = self.helper("can_fulfill_quantity")
		status = {"available": True, "availableQty": None, "availabilityReason": "non_stock_item"}
		self.assertTrue(can_fulfill_quantity(status, 2))
		self.assertFalse(can_fulfill_quantity(status, 0))

	def test_component_catalog_exposes_stock_uom_and_stock_managed_state(self):
		component_catalog_fields = self.helper("component_catalog_fields")
		self.assertEqual(
			component_catalog_fields(SimpleNamespace(stock_uom="Gram", is_stock_item=1)),
			{"stockUom": "Gram", "isStockItem": True},
		)


if __name__ == "__main__":
	unittest.main()
