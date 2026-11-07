"""Pure helpers for the ERPNext-backed storefront catalog."""

from collections.abc import Mapping
from math import isfinite


def _finite_number(value):
	if isinstance(value, bool):
		return None
	try:
		number = float(value)
	except (TypeError, ValueError, OverflowError):
		return None
	return number if isfinite(number) else None


def _row_value(row, field):
	if isinstance(row, Mapping):
		return row.get(field)
	return getattr(row, field, None)


def get_stock_status(is_stock_item, warehouse, actual_qty=0, reserved_qty=0):
	"""Return sellable availability from a Warehouse Bin snapshot."""
	if not is_stock_item:
		return {"available": True, "availableQty": None, "availabilityReason": "non_stock_item"}
	if not warehouse:
		return {"available": False, "availableQty": 0, "availabilityReason": "warehouse_not_configured"}

	actual = _finite_number(actual_qty)
	reserved = _finite_number(reserved_qty)
	available_qty = max((actual or 0) - max(reserved or 0, 0), 0)
	return {
		"available": available_qty > 0,
		"availableQty": available_qty,
		"availabilityReason": "in_stock" if available_qty > 0 else "out_of_stock",
	}


def can_fulfill_quantity(stock_status, requested_qty):
	"""Check a positive requested quantity against the server-read stock state."""
	quantity = _finite_number(requested_qty)
	if quantity is None or quantity <= 0 or not stock_status.get("available"):
		return False
	if stock_status.get("availabilityReason") == "non_stock_item":
		return True
	available_qty = _finite_number(stock_status.get("availableQty"))
	return available_qty is not None and quantity <= available_qty


def product_price_fields(price_row):
	"""Expose only a valid native Item Price selling rate and currency."""
	if not price_row:
		return {"price": None, "currency": None}
	rate = _finite_number(_row_value(price_row, "price_list_rate"))
	if rate is None or rate <= 0:
		return {"price": None, "currency": None}
	return {"price": _row_value(price_row, "price_list_rate"), "currency": _row_value(price_row, "currency")}


def component_catalog_fields(item):
	"""Expose the native stock UOM and stock-managed flag for recipe items."""
	return {
		"stockUom": _row_value(item, "stock_uom") or "",
		"isStockItem": bool(_row_value(item, "is_stock_item")),
	}
