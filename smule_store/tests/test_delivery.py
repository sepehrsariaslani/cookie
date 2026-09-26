import unittest

from smule_store.domain.delivery import normalize_delivery_city


class TestDeliveryCity(unittest.TestCase):
	def test_accepts_karaj_after_whitespace_normalization(self):
		self.assertEqual(normalize_delivery_city("  کرج  "), "کرج")

	def test_rejects_other_cities(self):
		with self.assertRaisesRegex(ValueError, "فقط در شهر کرج"):
			normalize_delivery_city("تهران")


if __name__ == "__main__":
	unittest.main()
