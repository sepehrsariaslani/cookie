import unittest

from smule_store.domain.payment_retry import is_payment_retry_allowed


class TestPaymentRetrySafety(unittest.TestCase):
	def setUp(self):
		self.order = {
			"order_payment_status": "ناموفق",
			"payment_request_status": "Failed",
			"payment_request_docstatus": 1,
			"sales_order_docstatus": 1,
			"payment_entry_exists": False,
			"has_advance_payment": False,
			"payment_amount_matches": True,
		}

	def test_failed_and_cancelled_attempts_can_be_retried(self):
		for status in ("ناموفق", "لغوشده"):
			with self.subTest(status=status):
				self.assertTrue(is_payment_retry_allowed(**{**self.order, "order_payment_status": status}))

	def test_pending_or_reconciliation_state_cannot_be_retried(self):
		for status in ("در انتظار پرداخت", "تأییدشده در درگاه؛ نیازمند تطبیق", "پرداخت‌شده"):
			with self.subTest(status=status):
				self.assertFalse(is_payment_retry_allowed(**{**self.order, "order_payment_status": status}))

	def test_request_order_payment_and_amount_must_all_be_safe(self):
		unsafe_states = (
			{"payment_request_status": "Requested"},
			{"payment_request_docstatus": 0},
			{"sales_order_docstatus": 2},
			{"payment_entry_exists": True},
			{"has_advance_payment": True},
			{"payment_amount_matches": False},
		)
		for change in unsafe_states:
			with self.subTest(change=change):
				self.assertFalse(is_payment_retry_allowed(**{**self.order, **change}))


if __name__ == "__main__":
	unittest.main()
