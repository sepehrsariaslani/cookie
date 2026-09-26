import unittest

from smule_store.domain.order_tracking import create_tracking_token, hash_tracking_token


class TestGuestOrderTracking(unittest.TestCase):
	def test_persists_only_a_hash_for_a_high_entropy_token(self):
		token, token_hash = create_tracking_token()

		self.assertEqual(len(token), 43)
		self.assertNotEqual(token, token_hash)
		self.assertEqual(hash_tracking_token(token), token_hash)

	def test_rejects_malformed_tokens(self):
		for token in (None, "", "short", "x" * 42, "x" * 42 + "!"):
			with self.subTest(token=token), self.assertRaises(ValueError):
				hash_tracking_token(token)

	def test_each_order_receives_a_distinct_tracking_token(self):
		first, first_hash = create_tracking_token()
		second, second_hash = create_tracking_token()

		self.assertNotEqual(first, second)
		self.assertNotEqual(first_hash, second_hash)


if __name__ == "__main__":
	unittest.main()
