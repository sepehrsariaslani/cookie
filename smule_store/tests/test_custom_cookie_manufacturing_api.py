import subprocess
import sys
import unittest
from pathlib import Path


HARNESS = r'''
import json
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
state = SimpleNamespace(docs=[], make_calls=[], bin_locks=[], counter=0, permissions={}, uom_global={})

class FakeDoc:
    def __init__(self, doctype, **values):
        self.doctype = doctype
        self.__dict__.update(values)
    def insert(self, ignore_permissions=False):
        state.counter += 1
        if not getattr(self, "name", None):
            self.name = f"{self.doctype.replace(' ', '-')}-{state.counter}"
        state.docs.append(self)
        return self
    def submit(self):
        self.docstatus = 1
        return self
    def as_dict(self):
        return {key: value for key, value in self.__dict__.items() if not key.startswith("_")}
    def check_permission(self, permission_type):
        if permission_type != "read":
            raise AssertionError(f"unexpected Sales Order permission: {permission_type}")

def make_item(code, kind, stock_uom="Gram", uoms=None):
    return FakeDoc("Item", name=code, item_name=code, disabled=0, is_stock_item=1, stock_uom=stock_uom,
        smule_slug=code.lower(), smule_storefront_type=kind, smule_enabled_in_storefront=1,
        smule_recipe_is_sample=0, variant_of=None, uoms=uoms or [])

state.items = {
    "COOKIE": make_item("COOKIE", "Product", "Nos"),
    "DOUGH-1": make_item("DOUGH-1", "Dough"),
    "TOP-1": make_item("TOP-1", "Topping", "Kilogram", [SimpleNamespace(uom="Gram", conversion_factor=0.001)]),
}
state.warehouses = {
    "Raw - A": SimpleNamespace(company="Company A", is_group=0, disabled=0),
    "WIP - A": SimpleNamespace(company="Company A", is_group=0, disabled=0),
    "FG - A": SimpleNamespace(company="Company A", is_group=0, disabled=0),
}
state.bins = {
    ("DOUGH-1", "Raw - A"): SimpleNamespace(actual_qty=500, reserved_qty=20, reserved_qty_for_production=10,
        reserved_qty_for_sub_contract=5, reserved_qty_for_production_plan=5),
    ("TOP-1", "Raw - A"): SimpleNamespace(actual_qty=1, reserved_qty=0.1, reserved_qty_for_production=0.05,
        reserved_qty_for_sub_contract=0.05, reserved_qty_for_production_plan=0.1),
}
state.settings = SimpleNamespace(company="Company A", custom_cookie_item="COOKIE", sales_warehouse="FG - A",
    production_source_warehouse="Raw - A", production_wip_warehouse="WIP - A")
recipe = {"materials": [
    {"itemCode": "DOUGH-1", "slug": "dough-1", "kind": "Dough", "name": "Dough", "grams": 50, "uom": "Gram"},
    {"itemCode": "TOP-1", "slug": "top-1", "kind": "Topping", "name": "Topping", "grams": 3, "uom": "Gram"},
]}
state.sales_order = FakeDoc("Sales Order", name="SO-1", docstatus=1,
    items=[FakeDoc("Sales Order Item", name="SOI-1", parent="SO-1", parenttype="Sales Order",
        item_code="COOKIE", stock_qty=2, qty=2, smule_cookie_recipe_json=json.dumps(recipe))])

frappe = types.ModuleType("frappe")
frappe.ValidationError = ValueError
frappe.PermissionError = PermissionError
frappe.whitelist = lambda **kwargs: lambda function: function
frappe.throw = lambda message, error=None: (_ for _ in ()).throw((error or ValueError)(message))
frappe.has_permission = lambda doctype, permtype: state.permissions.get((doctype, permtype), True)
frappe.get_single = lambda doctype: state.settings

def get_doc(doctype, name=None, **kwargs):
    if isinstance(doctype, dict):
        values = dict(doctype)
        actual_doctype = values.pop("doctype")
        return FakeDoc(actual_doctype, **values)
    if doctype == "Sales Order":
        return state.sales_order
    for doc in state.docs:
        if doc.doctype == doctype and doc.name == name:
            return doc
    raise ValueError(f"missing document {doctype} {name}")

def get_all(doctype, filters=None, fields=None, pluck=None, **kwargs):
    docs = [doc for doc in state.docs if doc.doctype == doctype]
    filters = filters or {}
    for key, expected in filters.items():
        if isinstance(expected, (list, tuple)) and len(expected) == 2:
            operator, value = expected
            if operator == "!=":
                docs = [doc for doc in docs if getattr(doc, key, None) != value]
            elif operator == "in":
                docs = [doc for doc in docs if getattr(doc, key, None) in value]
        else:
            docs = [doc for doc in docs if getattr(doc, key, None) == expected]
    if pluck:
        return [getattr(doc, pluck, None) for doc in docs]
    if fields:
        return [SimpleNamespace(**{field: getattr(doc, field, None) for field in fields}) for doc in docs]
    return docs

def db_get_value(doctype, filters=None, fieldname="name", as_dict=False, for_update=False, **kwargs):
    if doctype == "Warehouse":
        if isinstance(filters, dict):
            filters = filters.get("name")
        row = state.warehouses.get(filters)
    elif doctype == "Bin":
        row = state.bins.get((filters.get("item_code"), filters.get("warehouse")))
        if for_update:
            state.bin_locks.append((filters.get("item_code"), filters.get("warehouse")))
    else:
        row = None
    if row is None:
        return None
    if isinstance(fieldname, list):
        values = {field: getattr(row, field, None) for field in fieldname}
        return SimpleNamespace(**values) if as_dict else tuple(values.values())
    return getattr(row, fieldname, None)

frappe.get_doc = get_doc
frappe.get_all = get_all
frappe.get_cached_doc = lambda doctype, name: state.items[name] if doctype == "Item" else get_doc(doctype, name)
frappe.db = SimpleNamespace(get_value=db_get_value)
frappe.session = SimpleNamespace(user="staff@example.com")
sys.modules["frappe"] = frappe

erpnext = types.ModuleType("erpnext")
erpnext.__path__ = []
stock = types.ModuleType("erpnext.stock")
stock.__path__ = []
stock_doctype = types.ModuleType("erpnext.stock.doctype")
stock_doctype.__path__ = []
item_package = types.ModuleType("erpnext.stock.doctype.item")
item_package.__path__ = []
item_module = types.ModuleType("erpnext.stock.doctype.item.item")
item_module.get_uom_conv_factor = lambda uom, stock_uom: state.uom_global.get((uom, stock_uom))
work_order_package = types.ModuleType("erpnext.manufacturing.doctype.work_order")
work_order_package.__path__ = []
work_order_module = types.ModuleType("erpnext.manufacturing.doctype.work_order.work_order")
def make_stock_entry(work_order_id, purpose):
    state.make_calls.append((work_order_id, purpose))
    return {"doctype": "Stock Entry", "purpose": purpose, "work_order": work_order_id,
        "company": state.settings.company, "to_warehouse": state.settings.production_wip_warehouse,
        "items": [{"item_code": "DOUGH-1", "qty": 100}]}
work_order_module.make_stock_entry = make_stock_entry
for module in (erpnext, stock, stock_doctype, item_package):
    sys.modules[module.__name__] = module
sys.modules["erpnext.manufacturing"] = types.ModuleType("erpnext.manufacturing")
sys.modules["erpnext.manufacturing"].__path__ = []
sys.modules["erpnext.manufacturing.doctype"] = types.ModuleType("erpnext.manufacturing.doctype")
sys.modules["erpnext.manufacturing.doctype"].__path__ = []
sys.modules["erpnext.stock.doctype.item.item"] = item_module
sys.modules["erpnext.manufacturing.doctype.work_order"] = work_order_package
sys.modules["erpnext.manufacturing.doctype.work_order.work_order"] = work_order_module

from smule_store.api import manufacturing
'''


class TestCustomCookieManufacturingApi(unittest.TestCase):
	def run_probe(self, assertions):
		repo_root = Path(__file__).resolve().parents[2]
		result = subprocess.run(
			[sys.executable, "-c", HARNESS + assertions, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_sales_order_desk_action_previews_before_explicit_confirmation(self):
		repo_root = Path(__file__).resolve().parents[2]
		hooks = (repo_root / "smule_store" / "hooks.py").read_text()
		script = (repo_root / "smule_store" / "public" / "js" / "sales_order.js").read_text()
		self.assertIn('doctype_js = {"Sales Order": "public/js/sales_order.js"}', hooks)
		self.assertIn("get_custom_cookie_work_order_preview", script)
		self.assertIn("frappe.confirm", script)
		self.assertIn("frappe.utils.escape_html", script)
		self.assertIn("frm.doc.docstatus !== 1", script)
		self.assertLess(script.index("get_custom_cookie_work_order_preview"), script.index("frappe.confirm"))
		self.assertLess(script.index("frappe.confirm"), script.index("create_custom_cookie_work_orders"))

	def test_preview_is_read_only_and_reports_scaled_recipe_and_unreserved_stock(self):
		self.run_probe('''
preview = manufacturing.get_custom_cookie_work_order_preview("SO-1")
assert preview["ready"] is True
assert preview["lines"][0]["salesOrderItem"] == "SOI-1"
materials = {item["itemCode"]: item for item in preview["lines"][0]["materials"]}
assert materials["DOUGH-1"]["qtyGrams"] == 100
assert materials["DOUGH-1"]["availableStockQty"] == 460
assert materials["TOP-1"]["qtyGrams"] == 6
assert round(materials["TOP-1"]["qtyStock"], 6) == 0.006
assert round(materials["TOP-1"]["availableStockQty"], 6) == 0.7
assert state.docs == []
state.sales_order.docstatus = 0
try:
    manufacturing.get_custom_cookie_work_order_preview("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("an unsubmitted Sales Order must be rejected")
''')

	def test_create_uses_native_bom_work_order_and_transfer_and_is_idempotent(self):
		self.run_probe('''
result = manufacturing.create_custom_cookie_work_orders("SO-1")
assert len(result["workOrders"]) == 1
assert len(state.docs) == 3
bom, work_order, transfer = state.docs
assert bom.doctype == "BOM" and bom.item == "COOKIE" and bom.is_active == 1 and bom.is_default == 0
assert bom.quantity == 1 and len(bom.items) == 2
materials_per_cookie = {item["item_code"]: item for item in bom.items}
assert materials_per_cookie["DOUGH-1"]["qty"] == 50
assert materials_per_cookie["TOP-1"]["qty"] == 3
assert materials_per_cookie["TOP-1"]["conversion_factor"] == 0.001
assert work_order.doctype == "Work Order" and work_order.qty == 2
assert work_order.sales_order == "SO-1" and work_order.sales_order_item == "SOI-1"
assert work_order.skip_transfer == 0 and work_order.source_warehouse == "Raw - A"
assert transfer.doctype == "Stock Entry" and transfer.docstatus == 1
assert transfer.purpose == "Material Transfer for Manufacture"
assert state.make_calls == [(work_order.name, "Material Transfer for Manufacture")]
assert {"DOUGH-1", "TOP-1"}.issubset({code for code, warehouse in state.bin_locks})
again = manufacturing.create_custom_cookie_work_orders("SO-1")
assert len(again["workOrders"]) == 1
assert len(state.docs) == 3 and len(state.make_calls) == 1
''')

	def test_missing_configuration_stock_or_item_identity_creates_no_documents(self):
		self.run_probe('''
state.settings.production_wip_warehouse = None
preview = manufacturing.get_custom_cookie_work_order_preview("SO-1")
assert preview["ready"] is False and preview["blockers"]
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("missing WIP must block creation")
assert state.docs == []

state.settings.production_wip_warehouse = "WIP - A"
state.bins[("DOUGH-1", "Raw - A")].actual_qty = 20
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("insufficient source stock must block creation")
assert state.docs == []

state.bins[("DOUGH-1", "Raw - A")].actual_qty = 500
bad_recipe = {"materials": [{"itemCode": "NOT-A-DOUGH", "slug": "dough-1", "kind": "Dough", "grams": 50, "uom": "Gram"}]}
state.sales_order.items[0].smule_cookie_recipe_json = json.dumps(bad_recipe)
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("a mismatched recipe Item Code must block creation")
assert state.docs == []
''')

	def test_create_permission_is_required(self):
		self.run_probe('''
state.permissions[("Work Order", "create")] = False
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except PermissionError:
    pass
else:
    raise AssertionError("Work Order create permission must be enforced")
assert state.docs == []
''')

	def test_missing_exact_uom_conversion_is_a_preview_blocker_and_writes_nothing(self):
		self.run_probe('''
state.items["TOP-1"].uoms = []
preview = manufacturing.get_custom_cookie_work_order_preview("SO-1")
assert preview["ready"] is False
assert any("ضریب دقیقی" in blocker for blocker in preview["blockers"])
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("missing Gram conversion must prevent creation")
assert state.docs == []
''')

	def test_repeated_item_codes_aggregate_once_in_bom_and_total_demand(self):
		self.run_probe('''
recipe = {"materials": [
    {"itemCode": "DOUGH-1", "slug": "dough-1", "kind": "Dough", "name": "Dough", "grams": 50, "uom": "Gram"},
    {"itemCode": "TOP-1", "slug": "top-1", "kind": "Topping", "name": "Topping", "grams": 2, "uom": "Gram"},
    {"itemCode": "TOP-1", "slug": "top-1", "kind": "Topping", "name": "Topping", "grams": 3, "uom": "Gram"},
]}
state.sales_order.items[0].smule_cookie_recipe_json = json.dumps(recipe)
preview = manufacturing.get_custom_cookie_work_order_preview("SO-1")
materials = {item["itemCode"]: item for item in preview["lines"][0]["materials"]}
assert materials["TOP-1"]["qtyGrams"] == 10
result = manufacturing.create_custom_cookie_work_orders("SO-1")
bom = next(doc for doc in state.docs if doc.doctype == "BOM")
top_bom_row = next(item for item in bom.items if item["item_code"] == "TOP-1")
assert top_bom_row["qty"] == 5
assert len([item for item in bom.items if item["item_code"] == "TOP-1"]) == 1
''')

	def test_late_invalid_order_line_prevents_all_document_writes(self):
		self.run_probe('''
bad_row = FakeDoc("Sales Order Item", name="SOI-2", parent="SO-1", parenttype="Sales Order",
    item_code="COOKIE", stock_qty=1, qty=1,
    smule_cookie_recipe_json=json.dumps({"materials": [{"itemCode": "NOT-A-DOUGH", "slug": "x", "kind": "Dough", "grams": 50, "uom": "Gram"}]}))
state.sales_order.items.append(bad_row)
try:
    manufacturing.create_custom_cookie_work_orders("SO-1")
except ValueError:
    pass
else:
    raise AssertionError("all lines must be validated before any BOM is inserted")
assert state.docs == []
''')


if __name__ == "__main__":
	unittest.main()
