from html import escape
from pathlib import Path

import frappe
from markupsafe import Markup


def _page_file(path):
	root = Path(frappe.get_app_path("smule_store", "public", "site")).resolve()
	request_path = (path or "/").split("?", 1)[0].strip("/")
	if request_path == "smule_storefront":
		request_path = ""
	if request_path.startswith("orders/"):
		request_path = "orders/view"

	candidates = [root / f"{request_path}.html", root / request_path / "index.html"] if request_path else [root / "index.html"]
	for candidate in candidates:
		candidate = candidate.resolve()
		if candidate.is_relative_to(root) and candidate.is_file():
			return candidate

	if request_path.startswith("menu/"):
		fallback = (root / "menu" / "product" / "index.html").resolve()
		if fallback.is_relative_to(root) and fallback.is_file():
			return fallback

	for fallback_name in ("404.html", "not-found/index.html", "index.html"):
		fallback = (root / fallback_name).resolve()
		if fallback.is_relative_to(root) and fallback.is_file():
			return fallback

	frappe.throw("فایل فروشگاه اسموله هنوز ساخته نشده است.", frappe.DoesNotExistError)


def get_context(context):
	request_path = frappe.local.request.path if frappe.local.request else "/"
	page = _page_file(request_path).read_text(encoding="utf-8")
	csrf_token = escape(frappe.sessions.get_csrf_token(), quote=True)
	csrf_meta = f'<meta name="frappe-csrf-token" content="{csrf_token}">'
	page = page.replace("<head>", f"<head>{csrf_meta}", 1)
	context.storefront_html = Markup(page)
	# The exported React document is already a complete HTML page; do not wrap it
	# in Frappe's standard website shell.
	context.base_template = ""
	context.no_cache = True
	context.sitemap = 0
