"""Safe customer-facing delivery details from native ERPNext order records."""


def customer_delivery_snapshot(
	request_method=None,
	request_address=None,
	sales_order_method=None,
	sales_order_address=None,
	delivery_status=None,
):
	"""Prefer the original customer request, with Sales Order fields as fallback."""
	return {
		"deliveryMethod": request_method or sales_order_method or "",
		"deliveryAddress": request_address or sales_order_address or "",
		"deliveryStatus": delivery_status or "",
	}
