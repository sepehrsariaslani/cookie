"""Small, pure storefront readiness rules shared by the catalog API and tests."""


def storefront_order_readiness(online_orders_enabled, payment_ready, custom_pricing_ready):
	"""Expose checkout only when the store switch and all required setup are ready."""
	enabled = bool(online_orders_enabled and payment_ready and custom_pricing_ready)
	return {"orders_enabled": enabled, "payments_enabled": enabled}
