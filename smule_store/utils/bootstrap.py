from __future__ import annotations

import frappe


def ensure_smule_module_map() -> None:
	"""Ensure Frappe's in-process module map includes Smule Store modules."""
	module_app = getattr(frappe.local, "module_app", None)
	app_modules = getattr(frappe.local, "app_modules", None)
	smule_modules = [frappe.scrub(module) for module in frappe.get_module_list("smule_store")]
	if (
		isinstance(module_app, dict)
		and module_app.get("smule_store") == "smule_store"
		and isinstance(app_modules, dict)
		and app_modules.get("smule_store") == smule_modules
	):
		return

	frappe.setup_module_map(include_all_apps=False)
	module_app = getattr(frappe.local, "module_app", None)
	app_modules = getattr(frappe.local, "app_modules", None)
	if not isinstance(module_app, dict):
		module_app = frappe.local.module_app = {}
	if not isinstance(app_modules, dict):
		app_modules = frappe.local.app_modules = {}

	app_modules["smule_store"] = smule_modules
	module_app["smule_store"] = "smule_store"
	for module in smule_modules:
		module_app[module] = "smule_store"
