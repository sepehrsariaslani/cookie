# Smule Demo Products to Real Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register four confirmed Smule menu names as real ERPNext stock-managed sales Items and expose them through the live ERPNext-backed catalog without importing sample commercial or recipe data.

**Architecture:** No application source change is required: the installed `smule_store` catalog API already reads enabled Product Items from ERPNext. Create the records directly through the Frappe site console after a backup, then verify the ERPNext records and public catalog API.

**Tech Stack:** ERPNext v16 Item DocType, Frappe bench console, `smule_store.api.storefront.get_catalog`.

## Global Constraints

- Register only `کلاسیک شکلاتی`, `نمک دریا`, `دارچین کارامل`, and `پک مینی اسموله`.
- Do not copy sample prices, ingredients, allergens, nutrition, descriptions, photos, BOMs, or material rates.
- Use the verified product defaults: Item Group `کوکی`, Stock UOM `Nos`, `is_stock_item=1`, and `is_sales_item=1`.
- Do not create an opening balance, Stock Entry, Item Price, BOM, Warehouse, or payment configuration.
- Keep online ordering disabled; do not change warehouse, payment, or order settings.
- Preserve every existing Item and all unrelated workspace changes.

---

### Task 1: Confirm target records and create a recovery point

**Files:**
- No source files; this task reads and backs up the live `boller.ir` site.

**Interfaces:**
- Consumes: live Frappe site `boller.ir` in `den-v16-backend`.
- Produces: verified absence of the four exact Item codes/slugs and a site backup before mutation.

- [x] **Step 1: Query existing Items and settings**

Run:

```bash
docker exec den-v16-backend bash -lc 'cd /home/frappe/frappe-bench && bench --site boller.ir execute frappe.get_all --kwargs '\''{"doctype":"Item","fields":["name","item_name","item_group","stock_uom","smule_slug","smule_storefront_type"],"limit_page_length":100}'\'''
```

Expected: the current three Items are shown; none uses one of the four approved names or slugs. If a matching name or slug exists, stop and inspect it instead of inserting or overwriting it.

- [x] **Step 2: Back up the site**

Run:

```bash
docker exec den-v16-backend bash -lc 'cd /home/frappe/frappe-bench && bench --site boller.ir backup'
```

Expected: database and public/private file backups complete successfully. Do not proceed if backup fails.

### Task 2: Insert the four minimal real Item records

**Files:**
- No source files; create ERPNext `Item` records through Frappe.

**Interfaces:**
- Consumes: existing Item Group `کوکی`, UOM `Nos`, and custom Item fields installed by `smule_store`.
- Produces: four enabled, stock-managed Product Items with stable storefront slugs and no sample values.

- [x] **Step 1: Run the guarded Frappe console insertion**

Run:

```bash
docker exec -i den-v16-backend bash -lc 'cd /home/frappe/frappe-bench && bench --site boller.ir console' <<'PY'
products = [
    ("کلاسیک شکلاتی", "classic-chocolate"),
    ("نمک دریا", "sea-salt"),
    ("دارچین کارامل", "cinnamon-caramel"),
    ("پک مینی اسموله", "mini-box"),
]
conflicts = []
for item_name, slug in products:
    if frappe.db.exists("Item", item_name) or frappe.db.exists("Item", {"smule_slug": slug}):
        conflicts.append((item_name, slug))
if conflicts:
    raise Exception(f"Unexpected existing Item name/slug; no records inserted: {conflicts}")

created = []
try:
    for item_name, slug in products:
        doc = frappe.get_doc({
            "doctype": "Item",
            "item_code": item_name,
            "item_name": item_name,
            "item_group": "کوکی",
            "stock_uom": "Nos",
            "is_stock_item": 1,
            "is_sales_item": 1,
            "disabled": 0,
            "smule_enabled_in_storefront": 1,
            "smule_storefront_type": "Product",
            "smule_slug": slug,
            "smule_display_name_fa": item_name,
            "smule_category_fa": "کوکی",
            "smule_recipe_is_sample": 0,
        }).insert(ignore_permissions=True)
        created.append(doc.name)
    frappe.db.commit()
except Exception:
    frappe.db.rollback()
    raise
print({"created": created})
PY
```

Expected: all four Item names are printed under `created`. The guard must stop the whole operation if any code or slug unexpectedly exists; it never updates an existing record.

### Task 3: Verify ERPNext and the live storefront

**Files:**
- No source files; verify live Item records and the public catalog response.

**Interfaces:**
- Consumes: four inserted Items.
- Produces: evidence that all four are real catalog entries, have no sample price, have zero sellable availability, and do not enable checkout.

- [x] **Step 1: Query the four Item records**

Run:

```bash
docker exec den-v16-backend bash -lc 'cd /home/frappe/frappe-bench && bench --site boller.ir execute frappe.get_all --kwargs '\''{"doctype":"Item","filters":{"smule_slug":["in",["classic-chocolate","sea-salt","cinnamon-caramel","mini-box"]]},"fields":["name","item_name","item_group","stock_uom","is_stock_item","is_sales_item","disabled","smule_slug","smule_recipe_is_sample","smule_enabled_in_storefront","smule_storefront_type","smule_ingredients_fa","smule_allergens_fa","smule_kcal_per_100g"],"limit_page_length":10}'\'''
```

Expected: exactly four rows; each is enabled, stock-managed, sales-enabled, has `smule_recipe_is_sample=0`, and has blank ingredients/allergens with no copied nutritional data.

- [x] **Step 2: Verify the public catalog API**

Run:

```bash
curl -fsS https://erpyar.ir/api/method/smule_store.api.storefront.get_catalog
```

Expected: the four slugs appear in `products`, each has `isSample:false` and `price:null`; each is unavailable because the sales warehouse is not configured; `ordersEnabled` remains `false`.

- [x] **Step 3: Check the live menu response**

Run:

```bash
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' https://erpyar.ir/menu
```

Expected: HTTP 200. Product rows may be fetched by client hydration; the authoritative product-content check is the catalog API in Step 2.
