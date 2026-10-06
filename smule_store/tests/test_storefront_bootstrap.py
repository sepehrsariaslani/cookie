import subprocess
import sys
import unittest
from pathlib import Path


class TestStorefrontBootstrap(unittest.TestCase):
	def test_import_repairs_missing_smule_module_mapping(self):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import importlib
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
frappe = types.ModuleType("frappe")
frappe.local = SimpleNamespace(module_app={}, app_modules={})

def setup_module_map(include_all_apps=False):
    frappe.local.module_app = {}
    frappe.local.app_modules = {"smule_store": []}

frappe.setup_module_map = setup_module_map
frappe.get_module_list = lambda app_name: ["Smule Store"]
frappe.scrub = lambda value: value.lower().replace(" ", "_")
sys.modules["frappe"] = frappe
import smule_store
assert frappe.local.module_app.get("smule_store") == "smule_store"
assert "smule_store" in frappe.local.app_modules.get("smule_store", [])

def unavailable_site_cache(include_all_apps=False):
    raise RuntimeError("site cache unavailable")

frappe.setup_module_map = unavailable_site_cache
frappe.local.module_app = {}
frappe.local.app_modules = {}
importlib.reload(smule_store)
assert frappe.local.module_app.get("smule_store") == "smule_store"
assert "smule_store" in frappe.local.app_modules.get("smule_store", [])
'''
		result = subprocess.run(
			[sys.executable, "-c", probe, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)
