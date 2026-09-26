import unittest

import requests

from smule_store.domain.zarinpal import (
	PRODUCTION_ORIGIN,
	SANDBOX_ORIGIN,
	ZarinPalError,
	ZarinPalPendingError,
	create_payment,
	normalize_amount_irr,
	verify_payment,
)


class FakeResponse:
	def __init__(self, payload):
		self.payload = payload

	def raise_for_status(self):
		return None

	def json(self):
		return self.payload


class TestZarinPalAdapter(unittest.TestCase):
	def test_amount_must_be_positive_integer_rial(self):
		self.assertEqual(normalize_amount_irr("12000"), 12000)
		for value in (0, -1, 9999, "12000.5", "not-money"):
			with self.subTest(value=value), self.assertRaises(ZarinPalError):
				normalize_amount_irr(value)

	def test_create_payment_uses_fixed_sandbox_host_and_rial_amount(self):
		calls = []

		def post(url, **kwargs):
			calls.append((url, kwargs))
			return FakeResponse({"data": {"code": 100, "authority": "A" * 36}})

		payment = create_payment(
			"merchant",
			250000,
			"https://smule.example/api/callback",
			"Smule order",
			sandbox=True,
			post=post,
		)
		self.assertEqual(calls[0][0], f"{SANDBOX_ORIGIN}/pg/v4/payment/request.json")
		self.assertEqual(calls[0][1]["json"]["amount"], 250000)
		self.assertEqual(payment["payment_url"], f"{SANDBOX_ORIGIN}/pg/StartPay/{'A' * 36}")

	def test_create_payment_rejects_non_https_callback(self):
		with self.assertRaises(ZarinPalError):
			create_payment("merchant", 10000, "http://localhost/callback", "Order", post=lambda *_args, **_kwargs: None)

	def test_verification_uses_authoritative_amount_and_accepts_already_verified(self):
		calls = []

		def post(url, **kwargs):
			calls.append((url, kwargs))
			return FakeResponse({"data": {"code": 101, "ref_id": 987654321}})

		result = verify_payment("merchant", 420000, "A" * 36, post=post)
		self.assertEqual(calls[0][0], f"{PRODUCTION_ORIGIN}/pg/v4/payment/verify.json")
		self.assertEqual(calls[0][1]["json"]["amount"], 420000)
		self.assertEqual(result, {"code": 101, "reference_id": "987654321"})

	def test_verification_rejects_unconfirmed_provider_code(self):
		with self.assertRaises(ZarinPalError):
			verify_payment(
				"merchant",
				10000,
				"A" * 36,
				post=lambda *_args, **_kwargs: FakeResponse({"data": {"code": -9}}),
			)

	def test_verification_transport_response_does_not_mark_payment_as_failed(self):
		class UnavailableResponse:
			def raise_for_status(self):
				raise requests.HTTPError("gateway unavailable")

			def json(self):
				return None

		with self.assertRaises(ZarinPalPendingError):
			verify_payment("merchant", 10000, "A" * 36, post=lambda *_args, **_kwargs: UnavailableResponse())


if __name__ == "__main__":
	unittest.main()
