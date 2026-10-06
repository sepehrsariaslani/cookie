app_name = "smule_store"
app_title = "Smule Store"
app_publisher = "Smule"
app_description = "Smule cookie storefront and ERPNext integration."
app_email = "support@example.com"
app_license = "mit"

# Smule uses ERPNext's native Item, Item Price, Customer, and Sales Order records.
required_apps = ["erpnext"]
after_install = "smule_store.setup.install.after_install"
after_migrate = "smule_store.setup.install.after_migrate"

website_route_rules = [
	{"from_route": "/", "to_route": "smule_storefront"},
	{"from_route": "/menu", "to_route": "smule_storefront"},
	{"from_route": "/menu/product", "to_route": "smule_storefront"},
	{"from_route": "/menu/<path:slug>", "to_route": "smule_storefront"},
	{"from_route": "/build-cookie", "to_route": "smule_storefront"},
	{"from_route": "/cart", "to_route": "smule_storefront"},
	{"from_route": "/checkout", "to_route": "smule_storefront"},
	{"from_route": "/account", "to_route": "smule_storefront"},
	{"from_route": "/signup", "to_route": "smule_storefront"},
	{"from_route": "/my-orders", "to_route": "smule_storefront"},
	{"from_route": "/orders/view", "to_route": "smule_storefront"},
	{"from_route": "/order-confirmation", "to_route": "smule_storefront"},
	{"from_route": "/about", "to_route": "smule_storefront"},
	{"from_route": "/contact", "to_route": "smule_storefront"},
	{"from_route": "/faq", "to_route": "smule_storefront"},
	{"from_route": "/pickup", "to_route": "smule_storefront"},
	{"from_route": "/privacy", "to_route": "smule_storefront"},
	{"from_route": "/returns", "to_route": "smule_storefront"},
	{"from_route": "/terms", "to_route": "smule_storefront"},
]

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "smule_store",
# 		"logo": "/assets/smule_store/logo.png",
# 		"title": "Smule Store",
# 		"route": "/smule_store",
# 		"has_permission": "smule_store.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/smule_store/css/smule_store.css"
# app_include_js = "/assets/smule_store/js/smule_store.js"

# include js, css files in header of web template
web_include_css = "/assets/smule_store/css/storefront-auth.css"
# web_include_js = "/assets/smule_store/js/smule_store.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "smule_store/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "smule_store/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "smule_store.utils.jinja_methods",
# 	"filters": "smule_store.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "smule_store.install.before_install"
# after_install = "smule_store.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "smule_store.uninstall.before_uninstall"
# after_uninstall = "smule_store.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "smule_store.utils.before_app_install"
# after_app_install = "smule_store.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "smule_store.utils.before_app_uninstall"
# after_app_uninstall = "smule_store.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "smule_store.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "smule_store.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"smule_store.tasks.all"
# 	],
# 	"daily": [
# 		"smule_store.tasks.daily"
# 	],
# 	"hourly": [
# 		"smule_store.tasks.hourly"
# 	],
# 	"weekly": [
# 		"smule_store.tasks.weekly"
# 	],
# 	"monthly": [
# 		"smule_store.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "smule_store.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "smule_store.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "smule_store.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "smule_store.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["smule_store.utils.before_request"]
# after_request = ["smule_store.utils.after_request"]

# Job Events
# ----------
# before_job = ["smule_store.utils.before_job"]
# after_job = ["smule_store.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"smule_store.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
