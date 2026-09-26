"""Guardrails for creating another payment attempt for one ERPNext order."""


RETRYABLE_PAYMENT_STATUSES = frozenset({"ناموفق", "لغوشده"})


def is_payment_retry_allowed(
	order_payment_status,
	payment_request_status,
	payment_request_docstatus,
	sales_order_docstatus,
	payment_entry_exists,
	has_advance_payment,
	payment_amount_matches,
):
	"""Retry only a definitively failed attempt against an unpaid submitted order."""
	return bool(
		order_payment_status in RETRYABLE_PAYMENT_STATUSES
		and payment_request_status == "Failed"
		and payment_request_docstatus == 1
		and sales_order_docstatus == 1
		and not payment_entry_exists
		and not has_advance_payment
		and payment_amount_matches
	)
