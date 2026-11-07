"""Custom-cookie manufacturing endpoints backed by native ERPNext documents."""

import json
from collections.abc import Mapping
from math import isfinite

import frappe

from smule_store.domain.custom_cookie_manufacturing import build_material_quantities, grams_to_stock_qty
from smule_store.utils.item_uom import get_grams_to_stock_factor

TRANSFER_PURPOSE = "Material Transfer for Manufacture"
RESERVATION_FIELDS = (
	"reserved_qty",
	"reserved_qty_for_production",
	"reserved_qty_for_sub_contract",
	"reserved_qty_for_production_plan",
)


def _value(document, key, default=None):
	if isinstance(document, Mapping):
		return document.get(key, default)
	return getattr(document, key, default)


def _finite(value, label):
	if isinstance(value, bool):
		raise ValueError(f"{label} must be a finite number")
	try:
		number = float(value)
	except (TypeError, ValueError, OverflowError) as error:
		raise ValueError(f"{label} must be a finite number") from error
	if not isfinite(number):
		raise ValueError(f"{label} must be a finite number")
	return number


def _fail(message, error=None):
	frappe.throw(message, error or frappe.ValidationError)


def _read_recipe(value):
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (TypeError, json.JSONDecodeError) as error:
			raise ValueError("دستور ذخیره‌شدهٔ این ردیف قابل خواندن نیست.") from error
	if not isinstance(value, Mapping):
		raise ValueError("دستور ذخیره‌شدهٔ این ردیف معتبر نیست.")
	return value


def _snapshot_material_rows(recipe):
	materials = recipe.get("materials")
	if materials is not None:
		if not isinstance(materials, list):
			raise ValueError("فهرست مواد ذخیره‌شده معتبر نیست.")
		return materials

	dough = recipe.get("dough")
	toppings = recipe.get("toppings")
	amounts = recipe.get("topping_amounts")
	if not isinstance(dough, Mapping) or not isinstance(toppings, list) or not isinstance(amounts, Mapping):
		raise ValueError("دستور قدیمی ذخیره‌شده کامل نیست.")
	rows = [{
		"itemCode": dough.get("itemCode"),
		"slug": dough.get("slug"),
		"kind": "Dough",
		"name": dough.get("name"),
		"grams": recipe.get("base_weight_grams"),
		"uom": "Gram",
	}]
	for topping in toppings:
		if not isinstance(topping, Mapping):
			raise ValueError("افزودنی ذخیره‌شده معتبر نیست.")
		rows.append({
			"itemCode": topping.get("itemCode"),
			"slug": topping.get("slug"),
			"kind": None,
			"name": topping.get("name"),
			"grams": amounts.get(topping.get("slug")),
			"uom": "Gram",
		})
	return rows


def _warehouse_state(warehouse_name, company):
	if not warehouse_name:
		return None
	warehouse = frappe.db.get_value(
		"Warehouse", warehouse_name, ["company", "is_group", "disabled"], as_dict=True
	)
	if not warehouse or _value(warehouse, "disabled") or _value(warehouse, "is_group"):
		return None
	if _value(warehouse, "company") != company:
		return None
	return warehouse


def _find_existing(sales_order, row):
	orders = frappe.get_all(
		"Work Order",
		filters={"sales_order": sales_order, "sales_order_item": row.name, "docstatus": ["!=", 2]},
		fields=["name"],
		order_by="creation asc",
		limit_page_length=2,
	)
	if not orders:
		return None, None, None
	if len(orders) > 1:
		return None, None, "برای یک ردیف سفارش بیش از یک دستورکار فعال پیدا شد؛ از ایجاد انتقال جدید خودداری شد."
	work_order = frappe.get_doc("Work Order", orders[0].name)
	if _value(work_order, "docstatus") != 1:
		return work_order, None, "برای این ردیف یک دستورکار پیش‌نویس وجود دارد؛ ابتدا وضعیت آن را بررسی کنید."
	if _value(work_order, "production_item") != row.item_code:
		return work_order, None, "کالای دستورکار موجود با ردیف سفارش فروش یکسان نیست."
	entries = frappe.get_all(
		"Stock Entry",
		filters={"work_order": work_order.name, "purpose": TRANSFER_PURPOSE, "docstatus": 1},
		fields=["name"],
		order_by="creation asc",
		limit_page_length=2,
	)
	if len(entries) != 1:
		return work_order, None, "دستورکار موجود دقیقاً یک انتقال ثبت‌شده به انبار تولید ندارد؛ انتقال خودکار تکرار نشد."
	return work_order, frappe.get_doc("Stock Entry", entries[0].name), None


def _load_context(sales_order_name, lock_order=False, lock_bins=False):
	if not isinstance(sales_order_name, str) or not sales_order_name.strip():
		_fail("شمارهٔ سفارش فروش معتبر نیست.")
	sales_order = frappe.get_doc("Sales Order", sales_order_name, for_update=lock_order)
	sales_order.check_permission("read")
	if _value(sales_order, "docstatus") != 1:
		_fail("ساخت دستورکار فقط از سفارش فروش ثبت‌شده امکان‌پذیر است.")
	settings = frappe.get_single("Smule Store Settings")
	custom_item = _value(settings, "custom_cookie_item")
	if not custom_item:
		_fail("کالای پایهٔ کوکی سفارشی در تنظیمات اسموله انتخاب نشده است.")
	rows = [row for row in (_value(sales_order, "items", []) or []) if _value(row, "item_code") == custom_item]
	if not rows:
		_fail("این سفارش فروش ردیف کوکی سفارشی ندارد.")

	blockers = []
	lines = []
	new_lines = []
	for row in rows:
		if _value(row, "parent") != sales_order.name or _value(row, "parenttype") != "Sales Order":
			blockers.append(f"ردیف {_value(row, 'name', 'نامشخص')} متعلق به همین سفارش فروش نیست.")
			continue
		line = {
			"row": row,
			"salesOrderItem": row.name,
			"itemCode": row.item_code,
			"itemName": _value(row, "item_name", row.item_code),
			"qty": None,
			"materials": [],
			"workOrder": None,
			"stockEntry": None,
			"alreadyCreated": False,
			"bomMaterials": [],
		}
		try:
			recipe = _read_recipe(_value(row, "smule_cookie_recipe_json"))
			output_qty = _finite(_value(row, "stock_qty"), "Sales Order stock quantity")
			if output_qty <= 0:
				raise ValueError("تعداد انباری ردیف سفارش فروش باید بیشتر از صفر باشد.")
			total_materials = build_material_quantities(recipe, output_qty)
			unit_materials = build_material_quantities(recipe, 1)
			snapshot_rows = _snapshot_material_rows(recipe)
			metadata = {}
			for material in snapshot_rows:
				if not isinstance(material, Mapping):
					raise ValueError("یکی از ردیف‌های ماده معتبر نیست.")
				item_code = material.get("itemCode")
				if not isinstance(item_code, str) or not item_code.strip():
					raise ValueError("یکی از مواد Item Code ندارد.")
				identity = (material.get("slug"), material.get("kind"))
				if item_code in metadata and metadata[item_code]["identity"] != identity:
					raise ValueError(f"Item Code {item_code} در دستور با دو هویت متفاوت آمده است.")
				metadata[item_code] = {"identity": identity, "row": material}
			unit_by_code = {material["item_code"]: material["qty_grams"] for material in unit_materials}
			total_by_code = {material["item_code"]: material["qty_grams"] for material in total_materials}
			if set(unit_by_code) != set(total_by_code) or set(unit_by_code) != set(metadata):
				raise ValueError("Item Codeهای دستور و مواد تجمیع‌شده یکسان نیستند.")
			line["qty"] = output_qty
			line["recipe"] = recipe
			line["metadata"] = metadata
			line["unitQuantities"] = unit_by_code
			line["totalQuantities"] = total_by_code
		except (TypeError, ValueError) as error:
			blockers.append(f"ردیف {_value(row, 'name', 'نامشخص')}: {error}")
			lines.append(line)
			continue

		work_order, stock_entry, existing_error = _find_existing(sales_order.name, row)
		if existing_error:
			blockers.append(f"ردیف {row.name}: {existing_error}")
			line["workOrder"] = _value(work_order, "name")
			lines.append(line)
			continue
		if work_order:
			line["alreadyCreated"] = True
			line["workOrder"] = work_order.name
			line["bom"] = work_order.bom_no
			line["stockEntry"] = stock_entry.name
			for item_code, grams in total_by_code.items():
				material_row = metadata[item_code]["row"]
				line["materials"].append({
					"itemCode": item_code,
					"name": material_row.get("name") or item_code,
					"kind": material_row.get("kind"),
					"qtyGrams": grams,
					"qtyStock": None,
					"stockUom": None,
					"availableStockQty": None,
				})
			lines.append(line)
			continue
		new_lines.append(line)
		lines.append(line)

	if new_lines:
		company = _value(settings, "company")
		warehouse_values = {
			"sourceWarehouse": _value(settings, "production_source_warehouse"),
			"wipWarehouse": _value(settings, "production_wip_warehouse"),
			"fgWarehouse": _value(settings, "sales_warehouse"),
		}
		warehouse_labels = {
			"sourceWarehouse": "انبار مواد اولیهٔ تولید",
			"wipWarehouse": "انبار در جریان تولید",
			"fgWarehouse": "انبار محصول نهایی",
		}
		warehouse_docs = {}
		for key, label in warehouse_labels.items():
			warehouse_name = warehouse_values[key]
			if not warehouse_name:
				blockers.append(f"{label} در تنظیمات اسموله انتخاب نشده است.")
			elif not _warehouse_state(warehouse_name, company):
				blockers.append(f"{label} باید انبار فعال و نهایی متعلق به شرکت تنظیم‌شده باشد.")
			else:
				warehouse_docs[key] = warehouse_name
		if warehouse_values["sourceWarehouse"] and warehouse_values["sourceWarehouse"] == warehouse_values["wipWarehouse"]:
			blockers.append("انبار مواد اولیه و انبار در جریان تولید باید متفاوت باشند.")
		source_warehouse_ready = bool(
			warehouse_values["sourceWarehouse"] and warehouse_docs.get("sourceWarehouse")
		)

		try:
			finished_item = frappe.get_cached_doc("Item", custom_item)
			if _value(finished_item, "disabled") or not _value(finished_item, "is_stock_item") or not _value(finished_item, "stock_uom"):
				blockers.append("کالای پایهٔ کوکی سفارشی باید کالای فعال انبارشونده با واحد موجودی باشد.")
		except Exception:
			finished_item = None
			blockers.append("کالای پایهٔ کوکی سفارشی در ERPNext پیدا نشد.")

		demand = {}
		for line in new_lines:
			bom_materials = []
			preview_materials = []
			for item_code, total_grams in line["totalQuantities"].items():
				unit_grams = line["unitQuantities"][item_code]
				metadata_row = line["metadata"][item_code]["row"]
				try:
					item = frappe.get_cached_doc("Item", item_code)
					if _value(item, "disabled") or not _value(item, "is_stock_item") or not _value(item, "stock_uom"):
						raise ValueError("ماده باید کالای فعال انبارشونده با واحد موجودی باشد.")
					if _value(item, "smule_recipe_is_sample"):
						raise ValueError("دستور ماده هنوز نمونه است.")
					if not _value(item, "smule_enabled_in_storefront"):
						raise ValueError("ماده دیگر برای سازندهٔ سایت فعال نیست.")
					if metadata_row.get("slug") and _value(item, "smule_slug") != metadata_row.get("slug"):
						raise ValueError("slug ماده با snapshot سفارش فروش یکسان نیست.")
					kind = metadata_row.get("kind")
					item_kind = _value(item, "smule_storefront_type")
					if kind and item_kind != kind:
						raise ValueError("نوع ماده با snapshot سفارش فروش یکسان نیست.")
					if item_kind not in {"Dough", "Topping", "Flavor"}:
						raise ValueError("Item Code دستور، مادهٔ منتشرشدهٔ خمیر یا افزودنی نیست.")
					factor = get_grams_to_stock_factor(item)
					unit_stock_qty = grams_to_stock_qty(unit_grams, factor)
					total_stock_qty = grams_to_stock_qty(total_grams, factor)
					if source_warehouse_ready:
						demand[item_code] = demand.get(item_code, 0.0) + total_stock_qty
					bom_materials.append({
						"item_code": item_code,
						"qty": unit_grams,
						"uom": "Gram",
						"conversion_factor": factor,
						"stock_qty": unit_stock_qty,
						"source_warehouse": warehouse_values["sourceWarehouse"],
					})
					preview_materials.append({
						"itemCode": item_code,
						"name": metadata_row.get("name") or _value(item, "item_name") or item_code,
						"kind": kind or item_kind,
						"qtyGrams": total_grams,
						"qtyStock": total_stock_qty,
						"stockUom": _value(item, "stock_uom"),
						"availableStockQty": None,
					})
				except Exception as error:
					blockers.append(f"مادهٔ {item_code}: {error}")
			line["bomMaterials"] = bom_materials
			line["materials"] = preview_materials

		if source_warehouse_ready:
			available_by_code = {}
			for item_code in sorted(demand):
				bin_row = frappe.db.get_value(
					"Bin",
					{"item_code": item_code, "warehouse": warehouse_values["sourceWarehouse"]},
					["actual_qty", *RESERVATION_FIELDS],
					as_dict=True,
					for_update=lock_bins,
				)
				actual = max(0.0, _finite(_value(bin_row, "actual_qty", 0), "Bin actual quantity")) if bin_row else 0.0
				reserved = sum(
					max(0.0, _finite(_value(bin_row, field, 0), f"Bin {field}"))
					for field in RESERVATION_FIELDS
				) if bin_row else 0.0
				available_by_code[item_code] = max(actual - reserved, 0.0)
				if demand[item_code] > available_by_code[item_code] + 1e-9:
					blockers.append(
						f"موجودی آزاد مادهٔ {item_code} در انبار مبدا کافی نیست؛ نیاز {demand[item_code]:g} و موجودی آزاد {available_by_code[item_code]:g}."
					)
			for line in new_lines:
				for material in line["materials"]:
					material["availableStockQty"] = available_by_code.get(material["itemCode"], 0.0)

	public_lines = []
	for line in lines:
		public_lines.append({
			"salesOrderItem": line["salesOrderItem"],
			"itemCode": line["itemCode"],
			"itemName": line["itemName"],
			"qty": line["qty"],
			"materials": line["materials"],
			"bom": line.get("bom"),
			"workOrder": line.get("workOrder"),
			"stockEntry": line.get("stockEntry"),
			"alreadyCreated": line["alreadyCreated"],
		})
	return {
		"salesOrder": sales_order.name,
		"ready": not blockers,
		"blockers": list(dict.fromkeys(blockers)),
		"sourceWarehouse": _value(settings, "production_source_warehouse"),
		"wipWarehouse": _value(settings, "production_wip_warehouse"),
		"fgWarehouse": _value(settings, "sales_warehouse"),
		"lines": public_lines,
		"_sales_order_doc": sales_order,
		"_settings_doc": settings,
		"_new_lines": new_lines,
	}


@frappe.whitelist()
def get_custom_cookie_work_order_preview(sales_order: str):
	"""Return a read-only summary of the custom-cookie production flow."""
	context = _load_context(sales_order)
	return {key: value for key, value in context.items() if not key.startswith("_")}


@frappe.whitelist()
def create_custom_cookie_work_orders(sales_order: str):
	"""Create native per-line BOMs, Work Orders, and material-transfer entries."""
	for doctype in ("Work Order", "Stock Entry"):
		if not frappe.has_permission(doctype, "create"):
			frappe.throw(f"مجوز ساخت {doctype} برای حساب شما وجود ندارد.", frappe.PermissionError)
	context = _load_context(sales_order, lock_order=True, lock_bins=True)
	if context["blockers"]:
		_fail("\n".join(context["blockers"]))
	settings = context["_settings_doc"]
	created = []
	from erpnext.manufacturing.doctype.work_order.work_order import make_stock_entry

	for line in context["_new_lines"]:
		bom = frappe.get_doc({
			"doctype": "BOM",
			"item": line["itemCode"],
			"quantity": 1,
			"uom": _value(frappe.get_cached_doc("Item", line["itemCode"]), "stock_uom"),
			"company": _value(settings, "company"),
			"is_active": 1,
			"is_default": 0,
			"with_operations": 0,
			"items": line["bomMaterials"],
		}).insert(ignore_permissions=True)
		bom.submit()
		work_order = frappe.get_doc({
			"doctype": "Work Order",
			"production_item": line["itemCode"],
			"bom_no": bom.name,
			"company": _value(settings, "company"),
			"qty": line["qty"],
			"sales_order": context["salesOrder"],
			"sales_order_item": line["salesOrderItem"],
			"source_warehouse": context["sourceWarehouse"],
			"wip_warehouse": context["wipWarehouse"],
			"fg_warehouse": context["fgWarehouse"],
			"skip_transfer": 0,
			"use_multi_level_bom": 0,
		}).insert(ignore_permissions=True)
		work_order.submit()
		transfer_doc = frappe.get_doc(make_stock_entry(work_order.name, TRANSFER_PURPOSE))
		transfer_doc.insert(ignore_permissions=True)
		transfer_doc.submit()
		created.append({
			"salesOrderItem": line["salesOrderItem"],
			"bom": bom.name,
			"workOrder": work_order.name,
			"stockEntry": transfer_doc.name,
			"alreadyCreated": False,
		})

	for line in context["lines"]:
		if line["alreadyCreated"]:
			created.append({
				"salesOrderItem": line["salesOrderItem"],
				"bom": line["bom"],
				"workOrder": line["workOrder"],
				"stockEntry": line["stockEntry"],
				"alreadyCreated": True,
			})
	return {"salesOrder": context["salesOrder"], "workOrders": created}
