__version__ = "0.0.1"

try:
	import frappe
except ImportError:  # pragma: no cover - package metadata is usable outside Frappe
	pass
else:
	from smule_store.utils.bootstrap import ensure_smule_module_map

	ensure_smule_module_map()
