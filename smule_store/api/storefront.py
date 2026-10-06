"""Read-only public catalog API backed by ERPNext Items and Item Prices."""

import frappe
from frappe.utils import getdate, today

from smule_store.domain.payments import get_live_payment_configuration
from smule_store.domain.pricing import calculate_selling_price
from smule_store.domain.storefront_readiness import storefront_order_readiness


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


def _get_prices(item_codes, price_list, uom=None, selling=True):
	if not item_codes or not price_list:
		return {}
	filters = {"item_code": ["in", item_codes], "price_list": price_list, "selling" if selling else "buying": 1}
	if uom:
		filters["uom"] = uom
	else:
		stock_uoms = {
			row.name: row.stock_uom
			for row in frappe.get_all(
				"Item", filters={"name": ["in", item_codes]}, fields=["name", "stock_uom"]
			)
		}

	rows = frappe.get_all(
		"Item Price",
		filters=filters,
		fields=[
			"item_code",
			"price_list_rate",
			"currency",
			"uom",
			"customer",
			"supplier",
			"batch_no",
			"valid_from",
			"valid_upto",
			"modified",
		],
		order_by="modified desc",
	)

	current_date = getdate(today())
	prices = {}
	for row in rows:
		if row.customer or row.supplier or row.batch_no:
			continue
		if not uom and row.uom != stock_uoms.get(row.item_code):
			continue
		if row.valid_from and getdate(row.valid_from) > current_date:
			continue
		if row.valid_upto and getdate(row.valid_upto) < current_date:
			continue
		prices.setdefault(row.item_code, row)
	return prices


def _get_ready_product_prices(item_codes, settings):
	item_codes = list(dict.fromkeys(item_codes or []))
	if not item_codes or not settings.company:
		return {}
	boms = frappe.get_all(
		"BOM",
		filters={
			"item": ["in", item_codes],
			"company": settings.company,
			"is_active": 1,
			"is_default": 1,
			"docstatus": 1,
		},
		fields=["name", "item", "quantity", "base_total_cost"],
		order_by="modified desc",
		limit_page_length=max(2, len(item_codes) * 2),
	)
	boms_by_item = {}
	for bom in boms:
		boms_by_item.setdefault(bom.item, []).append(bom)

	prices = {}
	for item_code in item_codes:
		item_boms = boms_by_item.get(item_code, [])
		if len(item_boms) != 1 or not item_boms[0].quantity or not item_boms[0].base_total_cost:
			continue
		bom = item_boms[0]
		unit_cost = bom.base_total_cost / bom.quantity
		try:
			pricing = calculate_selling_price(
				unit_cost,
				settings.markup_percentage,
				settings.price_rounding_increment,
			)
		except ValueError:
			continue
		prices[item_code] = {
			**pricing,
			"bom_name": bom.name,
			"bom_quantity": bom.quantity,
			"bom_total_cost": bom.base_total_cost,
		}
	return prices


def _get_ready_product_price(item_code, settings):
	return _get_ready_product_prices([item_code], settings).get(item_code)


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
	component_codes = [
		item.name for item in items if item.smule_storefront_type in {"Dough", "Topping", "Flavor"}
	]
	component_prices = _get_prices(component_codes, settings.material_cost_price_list, uom="Gram", selling=False)
	price_currency = frappe.db.get_value("Price List", price_list, "currency") if price_list else None
	payment_ready = bool(get_live_payment_configuration(settings))
	material_price_list = frappe.db.get_value(
		"Price List", settings.material_cost_price_list, ["currency", "buying"], as_dict=True
	)
	selling_price_list = frappe.db.get_value(
		"Price List", price_list, ["currency", "selling"], as_dict=True
	) if price_list else None
	pricing_ready = bool(
		settings.automatic_pricing_enabled
		and material_price_list
		and material_price_list.buying
		and material_price_list.currency == "IRR"
		and selling_price_list
		and selling_price_list.selling
		and selling_price_list.currency == "IRR"
		and settings.markup_percentage is not None
		and settings.markup_percentage > 0
		and settings.markup_percentage <= 1000
		and settings.price_rounding_increment
		and settings.price_rounding_increment > 0
	)
	custom_pricing_ready = bool(
		pricing_ready
		and settings.custom_cookie_fixed_cost is not None
		and settings.custom_cookie_fixed_cost >= 0
	)
	order_readiness = storefront_order_readiness(
		settings.online_orders_enabled,
		payment_ready=payment_ready,
		custom_pricing_ready=custom_pricing_ready,
	)

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
			"kind": item.smule_storefront_type,
		}

		if item.smule_storefront_type == "Product" and item.is_sales_item:
			pricing = _get_ready_product_price(item.name, settings) if pricing_ready else None
			if not pricing or not pricing["unit_price"] or item.smule_recipe_is_sample:
				continue
			entry.update(
				{
					"price": pricing["unit_price"],
					"currency": price_currency,
					"priceBasis": "default-submitted-bom-cost-plus-markup",
					"serving": entry["serving"]
					or (f"یک عدد · حدود {int(item.smule_base_weight_grams or 0)} گرم" if item.smule_base_weight_grams else "یک عدد"),
				}
			)
			products.append(entry)
		elif item.smule_storefront_type in {"Dough", "Topping", "Flavor"}:
			entry["id"] = entry["slug"]
			entry["name"] = entry["name"]
			component_price = component_prices.get(item.name)
			entry["costPerGram"] = (
				component_price.price_list_rate
				if custom_pricing_ready and component_price and component_price.price_list_rate > 0 and not item.smule_recipe_is_sample
				else None
			)
			entry["costCurrency"] = component_price.currency if entry["costPerGram"] else None
			components.append(entry)

	return {
		"products": products,
		"components": components,
		"currency": price_currency,
		"priceList": price_list,
		"ordersEnabled": order_readiness["orders_enabled"],
		"paymentsEnabled": order_readiness["payments_enabled"],
		"customPricingReady": custom_pricing_ready,
		"pricingMarkupPercent": settings.markup_percentage if pricing_ready else None,
		"customCookieFixedCost": settings.custom_cookie_fixed_cost if custom_pricing_ready else None,
		"priceRoundingIncrement": settings.price_rounding_increment if pricing_ready else None,
		"deliveryEnabled": bool(
			settings.delivery_enabled
			and settings.delivery_fee_collection
			and (
				settings.delivery_fee_collection == "پرداخت جداگانه به اسنپ‌پیک"
				or (
					settings.delivery_fee_collection == "افزودن به مبلغ زرین‌پال"
					and settings.delivery_fee > 0
					and settings.delivery_charge_item
				)
			)
		),
		"deliveryFee": settings.delivery_fee or 0,
		"deliveryFeeCollection": settings.delivery_fee_collection or "",
		"pickupAddress": settings.pickup_address or "",
		"pickupHours": settings.pickup_hours or "",
	}
