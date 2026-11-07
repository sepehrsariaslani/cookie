"""ERPNext-aware UOM helpers that reject implicit conversion fallbacks."""

from smule_store.domain.custom_cookie_manufacturing import grams_to_stock_qty


def get_grams_to_stock_factor(item):
	"""Return an explicit Gram-to-stock-UOM factor for an Item document or row."""
	import frappe

	stock_uom = getattr(item, "stock_uom", None)
	if not stock_uom:
		raise ValueError("واحد موجودی ماده در ERPNext ثبت نشده است.")
	if stock_uom == "Gram":
		return 1.0

	item_doc = frappe.get_cached_doc("Item", item.name)
	item_codes = [(item.name, item_doc)]
	variant_of = getattr(item_doc, "variant_of", None)
	if variant_of:
		item_codes.append((variant_of, frappe.get_cached_doc("Item", variant_of)))
	for _, conversion_item in item_codes:
		for uom_detail in getattr(conversion_item, "uoms", []) or []:
			if uom_detail.uom == "Gram":
				grams_to_stock_qty(1, uom_detail.conversion_factor)
				return float(uom_detail.conversion_factor)

	from erpnext.stock.doctype.item.item import get_uom_conv_factor

	factor = get_uom_conv_factor("Gram", stock_uom)
	if factor is None:
		raise ValueError(f"برای تبدیل Gram به {stock_uom} مادهٔ {item.name} ضریب دقیقی در ERPNext تعریف نشده است.")
	grams_to_stock_qty(1, factor)
	return float(factor)
