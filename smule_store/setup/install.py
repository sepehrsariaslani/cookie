"""Install Smule fields on ERPNext's native sales and item records."""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from smule_store.setup.custom_fields import get_custom_fields


def after_install():
	create_custom_fields(get_custom_fields(), update=True)
	website_settings = frappe.get_doc("Website Settings")
	if not website_settings.home_page:
		website_settings.home_page = "smule_storefront"
		website_settings.save(ignore_permissions=True)
	frappe.clear_cache()


def after_migrate():
	"""Keep app-owned ERPNext fields in sync when the site schema is migrated."""
	create_custom_fields(get_custom_fields(), update=True)
	frappe.clear_cache()
