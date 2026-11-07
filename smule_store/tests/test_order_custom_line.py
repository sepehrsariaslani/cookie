import subprocess
import sys
import unittest
from pathlib import Path


class TestCustomOrderLine(unittest.TestCase):
	def run_probe(self, assertions):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
frappe = types.ModuleType("frappe")
frappe.whitelist = lambda **kwargs: lambda function: function
frappe.ValidationError = ValueError
frappe.throw = lambda message, error=None: (_ for _ in ()).throw((error or ValueError)(message))
frappe.db = SimpleNamespace(get_value=lambda *args, **kwargs: "IRR")
sys.modules["frappe"] = frappe
frappe_utils = types.ModuleType("frappe.utils")
frappe_utils.add_days = lambda *args: None
frappe_utils.now_datetime = lambda: None
frappe_utils.today = lambda: "2026-10-06"
frappe_utils.getdate = lambda value: value
frappe_utils.get_url = lambda value: value
sys.modules["frappe.utils"] = frappe_utils

from smule_store.api import orders

dough = SimpleNamespace(
    name="DOUGH-1", smule_slug="vanilla", item_name="خمیر وانیلی",
    smule_display_name_fa="خمیر وانیلی", smule_recipe_is_sample=0, is_stock_item=1, stock_uom="Gram",
    smule_storefront_type="Dough",
)
topping = SimpleNamespace(
    name="TOPPING-1", smule_slug="sesame", item_name="کنجد",
    smule_display_name_fa="کنجد", smule_recipe_is_sample=0, is_stock_item=1, stock_uom="Gram",
    smule_storefront_type="Topping",
)
orders._get_store_item = lambda slug, kind: {"vanilla": dough, "sesame": topping}.get(slug)
orders._get_prices = lambda *args, **kwargs: {
    "DOUGH-1": SimpleNamespace(price_list_rate=100, currency="IRR"),
    "TOPPING-1": SimpleNamespace(price_list_rate=200, currency="IRR"),
}
orders.calculate_custom_cookie = lambda *args: {
    "base_weight_grams": 50, "topping_weight_grams": 3, "final_weight_grams": 53,
    "estimated_calories": 100, "topping_amounts": {"sesame": 3},
}
orders.calculate_custom_cookie_price = lambda *args: {
    "unit_price": 1000, "material_cost": 100, "fixed_cost": 100,
    "markup_percent": 10, "markup_amount": 10, "rounding_increment": 10,
    "rounding_amount": 0, "breakdown": [],
}
settings = SimpleNamespace(
    material_cost_price_list="Materials", selling_price_list="Standard Selling",
    markup_percentage=10, price_rounding_increment=10, custom_cookie_fixed_cost=100,
)
line = {"doughId": "vanilla", "toppingIds": ["sesame"], "sizeGrams": 50, "quantity": 2,
        "materials": [{"itemCode": "FORGED", "grams": 999999}]}
result = orders._read_custom_line(line, settings)
assert result["line_type"] == "کوکی سفارشی"
assert result["qty"] == 2
assert result["recipe_summary"] == "خمیر وانیلی · بیس 50 گرم · کنجد"
import json
recipe = json.loads(result["recipe_json"])
'''
		result = subprocess.run(
			[sys.executable, "-c", probe + assertions, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_custom_line_snapshots_server_calculated_material_codes_and_grams(self):
		self.run_probe('''
assert recipe["materials"] == [
    {"itemCode": "DOUGH-1", "slug": "vanilla", "kind": "Dough", "name": "خمیر وانیلی", "grams": 50.0, "uom": "Gram"},
    {"itemCode": "TOPPING-1", "slug": "sesame", "kind": "Topping", "name": "کنجد", "grams": 3.0, "uom": "Gram"},
]
''')

	def test_non_stock_material_cannot_be_added_to_a_custom_sales_order_line(self):
		self.run_probe('''
dough.is_stock_item = 0
try:
    orders._read_custom_line(line, settings)
except ValueError:
    pass
else:
    raise AssertionError("non-stock Dough must be rejected")
''')

	def test_missing_exact_gram_conversion_blocks_custom_order_line(self):
		self.run_probe('''
orders._get_grams_to_stock_factor = lambda item: (_ for _ in ()).throw(ValueError("Gram conversion missing"))
try:
    orders._read_custom_line(line, settings)
except ValueError as error:
    assert "Gram conversion missing" in str(error)
else:
    raise AssertionError("a missing exact Gram conversion must be rejected at checkout")
''')


if __name__ == "__main__":
	unittest.main()
