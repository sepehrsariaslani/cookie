"""Read-only public catalog API backed by ERPNext Items and Item Prices."""

import frappe
from frappe.utils import getdate, today


ITEM_FIELDS = [
	"name",
	"item_name",
	"image",
	"stock_uom",
	"is_sales_item",
	"smule_slug",
	"smule_display_name_fa",
	"smule_description_fa",
	"smule_serving_description_fa",
	"smule_recipe_is_sample",
	"smule_category_fa",
	"smule_ingredients_fa",
	"smule_not_included_fa",
	"smule_storefront_type",
	"smule_component_group",
	"smule_grams_per_50g",
	"smule_base_weight_grams",
	"smule_kcal_per_100g",
	"smule_protein_per_100g",
	"smule_carbs_per_100g",
	"smule_fat_per_100g",
	"smule_sugar_per_100g",
	"smule_allergens_fa",
	"smule_visual_group",
	"smule_visual_color",
	"smule_sort_order",
]


def _split_fa_list(value):
	return [
		part.strip()
		for part in (value or "").replace("\n", "،").replace(",", "،").split("،")
		if part.strip()
	]


def _get_prices(item_codes, price_list):
	if not item_codes or not price_list:
		return {}

	rows = frappe.get_all(
		"Item Price",
		filters={"item_code": ["in", item_codes], "price_list": price_list, "selling": 1},
		fields=["item_code", "price_list_rate", "currency", "valid_from", "valid_upto", "modified"],
		order_by="modified desc",
	)

	current_date = getdate(today())
	prices = {}
	for row in rows:
		if row.valid_from and getdate(row.valid_from) > current_date:
			continue
		if row.valid_upto and getdate(row.valid_upto) < current_date:
			continue
		prices.setdefault(row.item_code, row)
	return prices


@frappe.whitelist(allow_guest=True)
def get_catalog():
	"""Return only explicitly enabled products/components and configured live prices."""
	items = frappe.get_all(
		"Item",
		filters={"disabled": 0, "smule_enabled_in_storefront": 1},
		fields=ITEM_FIELDS,
		order_by="smule_sort_order asc, item_name asc",
		limit_page_length=500,
	)

	settings = frappe.get_single("Smule Store Settings")
	price_list = settings.selling_price_list or frappe.db.get_single_value("Selling Settings", "selling_price_list")
	product_codes = [item.name for item in items if item.smule_storefront_type == "Product" and item.is_sales_item]
	prices = _get_prices(product_codes, price_list)

	products = []
	components = []
	for item in items:
		entry = {
			"itemCode": item.name,
			"slug": item.smule_slug or item.name,
			"name": item.smule_display_name_fa or item.item_name,
			"shortName": item.smule_display_name_fa or item.item_name,
			"description": item.smule_description_fa or "",
			"serving": item.smule_serving_description_fa or "",
			"category": item.smule_category_fa or "کوکی",
			"image": item.image or "",
			"ingredients": _split_fa_list(item.smule_ingredients_fa),
			"notIncluded": _split_fa_list(item.smule_not_included_fa),
			"allergens": _split_fa_list(item.smule_allergens_fa),
			"group": item.smule_component_group or "",
			"gramsPer50": item.smule_grams_per_50g or 0,
			"baseWeightGrams": item.smule_base_weight_grams or 0,
			"nutrition": {
				"calories": item.smule_kcal_per_100g or 0,
				"protein": item.smule_protein_per_100g or 0,
				"carbohydrates": item.smule_carbs_per_100g or 0,
				"fat": item.smule_fat_per_100g or 0,
				"sugar": item.smule_sugar_per_100g or 0,
			},
			"visualGroup": item.smule_visual_group or "crumb",
			"visualColor": item.smule_visual_color or "#c98955",
			"isSample": bool(item.smule_recipe_is_sample),
		}

		if item.smule_storefront_type == "Product" and item.is_sales_item:
			price = prices.get(item.name)
			if not price or price.price_list_rate <= 0 or item.smule_recipe_is_sample:
				continue
			entry.update(
				{
					"price": price.price_list_rate,
					"currency": price.currency,
					"serving": entry["serving"]
					or (f"یک عدد · حدود {int(item.smule_base_weight_grams or 0)} گرم" if item.smule_base_weight_grams else "یک عدد"),
				}
			)
			products.append(entry)
		elif item.smule_storefront_type in {"Dough", "Topping", "Flavor"}:
			entry["id"] = entry["slug"]
			entry["name"] = entry["name"]
			components.append(entry)

	return {
		"products": products,
		"components": components,
		"currency": next((prices[item].currency for item in prices if item in product_codes), None),
		"priceList": price_list,
		"ordersEnabled": bool(settings.online_orders_enabled),
		"deliveryEnabled": bool(settings.delivery_enabled),
		"pickupAddress": settings.pickup_address or "",
		"pickupHours": settings.pickup_hours or "",
	}
