import subprocess
import sys
import unittest
from pathlib import Path


class TestStorefrontSettings(unittest.TestCase):
	def test_production_warehouses_are_optional_but_validated(self):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
warehouses = {
    "Raw - A": SimpleNamespace(company="Company A", is_group=0, disabled=0),
    "WIP - A": SimpleNamespace(company="Company A", is_group=0, disabled=0),
    "Group - A": SimpleNamespace(company="Company A", is_group=1, disabled=0),
    "Disabled - A": SimpleNamespace(company="Company A", is_group=0, disabled=1),
    "Raw - B": SimpleNamespace(company="Company B", is_group=0, disabled=0),
}
frappe = types.ModuleType("frappe")
frappe.db = SimpleNamespace(get_value=lambda doctype, name, *args, **kwargs: warehouses.get(name))
frappe.throw = lambda message: (_ for _ in ()).throw(ValueError(message))
sys.modules["frappe"] = frappe
frappe_model = types.ModuleType("frappe.model")
frappe_model.__path__ = []
document_module = types.ModuleType("frappe.model.document")
document_module.Document = type("Document", (), {})
sys.modules["frappe.model"] = frappe_model
sys.modules["frappe.model.document"] = document_module

from smule_store.smule_store.doctype.smule_store_settings.smule_store_settings import SmuleStoreSettings

settings = object.__new__(SmuleStoreSettings)
settings.company = "Company A"
settings.sales_warehouse = None
settings.production_source_warehouse = None
settings.production_wip_warehouse = None
settings.online_orders_enabled = 0
settings.validate()

settings.production_source_warehouse = "Raw - A"
settings.production_wip_warehouse = "WIP - A"
settings.validate()

for invalid in ("Group - A", "Disabled - A", "Raw - B"):
    settings.production_source_warehouse = invalid
    try:
        settings.validate()
    except ValueError:
        pass
    else:
        raise AssertionError(f"{invalid} must not be accepted as a production warehouse")

settings.production_source_warehouse = "Raw - A"
settings.production_wip_warehouse = "Raw - A"
try:
    settings.validate()
except ValueError:
    pass
else:
    raise AssertionError("the production source and WIP warehouses must differ")
'''
		result = subprocess.run(
			[sys.executable, "-c", probe, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_sales_warehouse_must_be_active_leaf_and_match_company(self):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
warehouse = SimpleNamespace(company="Company A", is_group=0, disabled=0)
frappe = types.ModuleType("frappe")
frappe.db = SimpleNamespace(get_value=lambda *args, **kwargs: warehouse)
frappe.throw = lambda message: (_ for _ in ()).throw(ValueError(message))
sys.modules["frappe"] = frappe
frappe_model = types.ModuleType("frappe.model")
frappe_model.__path__ = []
document_module = types.ModuleType("frappe.model.document")
document_module.Document = type("Document", (), {})
sys.modules["frappe.model"] = frappe_model
sys.modules["frappe.model.document"] = document_module

from smule_store.smule_store.doctype.smule_store_settings.smule_store_settings import SmuleStoreSettings

settings = object.__new__(SmuleStoreSettings)
settings.company = "Company A"
settings.sales_warehouse = "Cookies - A"
settings.online_orders_enabled = 0
settings.validate()

settings.company = "Company B"
try:
    settings.validate()
except ValueError as error:
    assert "شرکت" in str(error)
else:
    raise AssertionError("a warehouse owned by another company must be rejected")

settings.company = "Company A"
warehouse.is_group = 1
try:
    settings.validate()
except ValueError as error:
    assert "نهایی" in str(error)
else:
    raise AssertionError("group warehouses must be rejected")

settings.sales_warehouse = None
settings.online_orders_enabled = 1
try:
    settings.validate()
except ValueError as error:
    assert "انبار فروش" in str(error)
else:
    raise AssertionError("online orders must require a sales warehouse")
'''
		result = subprocess.run(
			[sys.executable, "-c", probe, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
	unittest.main()
