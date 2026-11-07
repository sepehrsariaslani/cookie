import subprocess
import sys
import unittest
from pathlib import Path


class TestStorefrontBootstrap(unittest.TestCase):
	def test_package_import_is_safe_before_frappe_site_initialization(self):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
frappe = types.ModuleType("frappe")
frappe.local = SimpleNamespace(site=None, module_app=None, app_modules=None)
frappe.client_cache = None

def setup_module_map(include_all_apps=False):
    raise AssertionError("module map setup must wait until a site is initialized")

frappe.setup_module_map = setup_module_map
sys.modules["frappe"] = frappe

import smule_store
assert smule_store.__version__ == "0.0.1"
'''
		result = subprocess.run(
			[sys.executable, "-c", probe, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)

	def test_before_request_repairs_missing_smule_module_mapping(self):
		repo_root = Path(__file__).resolve().parents[2]
		probe = r'''
import importlib
import sys
import types
from types import SimpleNamespace

sys.path.insert(0, sys.argv[1])
frappe = types.ModuleType("frappe")
frappe.local = SimpleNamespace(site="boller.ir", module_app={}, app_modules={})
frappe.client_cache = object()

def setup_module_map(include_all_apps=False):
    frappe.local.module_app = {}
    frappe.local.app_modules = {"smule_store": []}

frappe.setup_module_map = setup_module_map
frappe.get_module_list = lambda app_name: ["Smule Store"]
frappe.scrub = lambda value: value.lower().replace(" ", "_")
sys.modules["frappe"] = frappe
import smule_store
import smule_store.hooks as hooks
assert hooks.before_request == ["smule_store.utils.bootstrap.ensure_smule_module_map"]
from smule_store.utils.bootstrap import ensure_smule_module_map
ensure_smule_module_map()
assert frappe.local.module_app.get("smule_store") == "smule_store"
assert "smule_store" in frappe.local.app_modules.get("smule_store", [])

frappe.get_module_list = lambda app_name: []
frappe.local.module_app = {}
frappe.local.app_modules = {}
ensure_smule_module_map()
assert frappe.local.module_app.get("smule_store") == "smule_store"
assert frappe.local.app_modules.get("smule_store") == []
'''
		result = subprocess.run(
			[sys.executable, "-c", probe, str(repo_root)],
			capture_output=True,
			text=True,
			check=False,
		)
		self.assertEqual(result.returncode, 0, result.stderr)
