"""Pure validation and unit conversion for custom-cookie manufacturing recipes."""

from collections.abc import Mapping
from math import isfinite


def _finite_number(value, label):
	if isinstance(value, bool):
		raise ValueError(f"{label} must be a finite number")
	try:
		number = float(value)
	except (TypeError, ValueError, OverflowError) as error:
		raise ValueError(f"{label} must be a finite number") from error
	if not isfinite(number):
		raise ValueError(f"{label} must be a finite number")
	return number


def _recipe_materials(recipe):
	if not isinstance(recipe, Mapping):
		raise ValueError("The saved recipe must be an object")

	materials = recipe.get("materials")
	if materials is not None:
		if not isinstance(materials, list) or not materials:
			raise ValueError("The saved recipe has no materials")
		return materials

	dough = recipe.get("dough")
	toppings = recipe.get("toppings")
	amounts = recipe.get("topping_amounts")
	if not isinstance(dough, Mapping) or not isinstance(toppings, list) or not isinstance(amounts, Mapping):
		raise ValueError("The saved legacy recipe is incomplete")
	materials = [{
		"itemCode": dough.get("itemCode"),
		"grams": recipe.get("base_weight_grams"),
	}]
	for topping in toppings:
		if not isinstance(topping, Mapping):
			raise ValueError("The saved legacy topping is invalid")
		slug = topping.get("slug")
		materials.append({"itemCode": topping.get("itemCode"), "grams": amounts.get(slug)})
	return materials


def build_material_quantities(recipe: dict, output_stock_qty: float) -> list[dict]:
	"""Scale a server-saved per-cookie recipe to native ERPNext stock quantity."""
	quantity = _finite_number(output_stock_qty, "Output quantity")
	if quantity <= 0:
		raise ValueError("Output quantity must be positive")

	aggregated = {}
	for material in _recipe_materials(recipe):
		if not isinstance(material, Mapping):
			raise ValueError("A saved material row is invalid")
		item_code = material.get("itemCode")
		if not isinstance(item_code, str) or not item_code.strip():
			raise ValueError("A saved material is missing its Item Code")
		if material.get("uom") not in (None, "Gram"):
			raise ValueError("Saved material quantities must use Gram")
		grams = _finite_number(material.get("grams"), "Material grams")
		if grams < 0:
			raise ValueError("Material grams cannot be negative")
		if grams == 0:
			continue
		scaled = grams * quantity
		if not isfinite(scaled):
			raise ValueError("Scaled material quantity is not finite")
		code = item_code.strip()
		aggregated[code] = aggregated.get(code, 0.0) + scaled

	return [
		{"item_code": item_code, "qty_grams": round(grams, 9)}
		for item_code, grams in sorted(aggregated.items())
	]


def grams_to_stock_qty(qty_grams: float, conversion_factor: float) -> float:
	"""Convert Gram UOM quantity to stock UOM using an explicit ERPNext factor."""
	grams = _finite_number(qty_grams, "Material grams")
	factor = _finite_number(conversion_factor, "UOM conversion factor")
	if grams < 0:
		raise ValueError("Material grams cannot be negative")
	if factor <= 0:
		raise ValueError("UOM conversion factor must be positive")
	result = grams * factor
	if not isfinite(result):
		raise ValueError("Converted stock quantity is not finite")
	return round(result, 12)
