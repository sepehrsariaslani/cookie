import unittest

from smule_store.domain.storefront_readiness import storefront_order_readiness


class TestStorefrontReadiness(unittest.TestCase):
	def test_checkout_stays_disabled_until_every_store_gate_is_ready(self):
		for values in (
			(False, True, True),
			(True, False, True),
			(True, True, False),
		):
			with self.subTest(values=values):
				self.assertEqual(
					storefront_order_readiness(*values),
					{"orders_enabled": False, "payments_enabled": False},
				)

	def test_checkout_is_enabled_only_when_all_gates_are_ready(self):
		self.assertEqual(
			storefront_order_readiness(True, True, True),
			{"orders_enabled": True, "payments_enabled": True},
		)


if __name__ == "__main__":
	unittest.main()
