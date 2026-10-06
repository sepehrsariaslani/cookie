# Smule ERPNext Catalog Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Smule storefront read explicitly published products, valid ERPNext selling prices, and warehouse-specific availability from native ERPNext records without changing its visual identity.

**Architecture:** Repair Frappe's app/module map when the Smule package is imported. The catalog API will use `Item`, `Item Price`, `Warehouse`, and `Bin`; `Smule Store Settings` will hold only a Link to the chosen native sales Warehouse. The existing storefront UI remains, but live catalog failures and empty catalogs no longer fall back to sample products.

**Tech Stack:** Frappe 16 / ERPNext 16, Python, Next.js-compatible React + TypeScript, Node.js test runner (`tsx`).

## Global Constraints

- The existing Smule Persian RTL UI and brand remain visually unchanged; only product truth, stock status, and feedback states change.
- `Item` is the identity/content source, valid `Item Price` is the selling-rate source, and `Bin` in the selected `Warehouse` is the stock source.
- `smule_enabled_in_storefront` is the only publication switch; deployment and migration must not publish or edit any Item records.
- Do not map old sample product names to ERPNext records by name similarity.
- Add `sales_warehouse` as a Link to native `Warehouse`; leave it blank unless the owner selects a company-owned leaf Warehouse.
- An Item is not orderable if it is stock-managed and the sales Warehouse is unset or available stock is zero.
- Keep online orders, payments, delivery, and the cookie builder's sample recipe flow disabled/unmodified in this subproject.
- Do not put sample products or sample prices into live product listings when the API is empty or unavailable.
- Do not alter `/desk`, existing Item data, price records, or operational ERPNext configuration as part of code deployment.

---

### Task 1: Repair Smule DocType Controller Resolution

**Files:**
- Create: `smule_store/utils/__init__.py`
- Create: `smule_store/utils/bootstrap.py`
- Modify: `smule_store/__init__.py`
- Test: `smule_store/tests/test_storefront_bootstrap.py`

**Interfaces:**
- Produces: `ensure_smule_module_map() -> None`; it guarantees `frappe.local.module_app["smule_store"] == "smule_store"` and `frappe.local.app_modules["smule_store"]` includes the scrubbed module names from `modules.txt`.

- [ ] **Step 1: Write the failing regression test**

Create a test that saves the current local maps, empties them, reloads the app package, and asserts that the module map is repaired. Restore the old maps in `finally` so the test does not affect later tests.

```python
import importlib
import unittest

import frappe
import smule_store


class TestStorefrontBootstrap(unittest.TestCase):
	def test_import_repairs_missing_smule_module_mapping(self):
		previous_module_app = getattr(frappe.local, "module_app", None)
		previous_app_modules = getattr(frappe.local, "app_modules", None)
		try:
			frappe.local.module_app = {}
			frappe.local.app_modules = {}
			importlib.reload(smule_store)
			self.assertEqual(frappe.local.module_app.get("smule_store"), "smule_store")
			self.assertIn("smule_store", frappe.local.app_modules.get("smule_store", []))
		finally:
			frappe.local.module_app = previous_module_app
			frappe.local.app_modules = previous_app_modules
```

- [ ] **Step 2: Run the test and verify the assertion fails**

Run: `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_bootstrap`

Expected: the test reaches the assertions and fails because the current app import does not repopulate either map.

- [ ] **Step 3: Add the module-map repair helper**

Implement the same narrowly scoped fallback pattern used by the installed Flow app: call `frappe.setup_module_map(include_all_apps=False)`, then fill the Smule entries from `frappe.get_module_list("smule_store")` if the cached site map is still incomplete. Keep this module limited to map repair; do not clear all Redis/site caches from a normal web request.

- [ ] **Step 4: Invoke the helper from the package import and rerun the test**

In `smule_store/__init__.py`, keep the app version and use a guarded `import frappe` so importing package metadata outside a Frappe process remains safe. When Frappe is available, import and call `ensure_smule_module_map()`.

Run: `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_bootstrap`

Expected: PASS; `frappe.local.module_app["smule_store"]` is `"smule_store"` and the module list includes `"smule_store"`.

- [ ] **Step 5: Commit the isolated task**

Run: `git add smule_store/__init__.py smule_store/utils/__init__.py smule_store/utils/bootstrap.py smule_store/tests/test_storefront_bootstrap.py && git commit -m "fix: repair Smule Frappe module mapping"`

Expected: one commit containing only the four Task 1 files.

---

### Task 2: Read Native ERPNext Prices and Sales-Warehouse Stock

**Files:**
- Create: `smule_store/domain/storefront_catalog.py`
- Create: `smule_store/tests/test_storefront_catalog.py`
- Modify: `smule_store/api/storefront.py`
- Modify: `smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.json`
- Modify: `smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.py`

**Interfaces:**
- Consumes: explicitly enabled ERPNext Items and `Smule Store Settings`.
- Produces: catalog product records with `itemCode`, `price`, `currency`, `isAvailable`, `availableQty`, and `availabilityReason`.
- Produces: `get_stock_status(is_stock_item, warehouse, actual_qty=0, reserved_qty=0) -> dict` with `available`, `availableQty`, and `availabilityReason`.
- Produces: `product_price_fields(price_row) -> dict` with `price` copied from native `Item Price.price_list_rate` and `currency` copied from the row, or `{"price": None, "currency": None}` when no valid row exists.

- [ ] **Step 1: Write failing tests for stock availability**

Create the new `storefront_catalog.py` as a module-docstring-only scaffold, then add `unittest.TestCase` tests for (a) stock-managed item with no Warehouse, (b) no available stock after reservations, (c) positive stock after reservations, (d) non-stock sales item, and (e) an `Item Price` row's rate/currency being passed through unchanged. Resolve the not-yet-added functions with `getattr`; assert each is callable before calling it so RED is an assertion failure, not an import/attribute error.

```python
import unittest
from types import SimpleNamespace

from smule_store.domain import storefront_catalog


class TestStorefrontStockStatus(unittest.TestCase):
	def test_stock_item_without_warehouse_is_unavailable(self):
		get_stock_status = getattr(storefront_catalog, "get_stock_status", None)
		self.assertTrue(callable(get_stock_status), "get_stock_status must be implemented")
		if get_stock_status is None:
			return
		self.assertEqual(
			get_stock_status(True, None),
			{"available": False, "availableQty": 0, "availabilityReason": "warehouse_not_configured"},
		)

	def test_reserved_quantity_is_subtracted_from_bin_stock(self):
		get_stock_status = getattr(storefront_catalog, "get_stock_status", None)
		self.assertTrue(callable(get_stock_status), "get_stock_status must be implemented")
		if get_stock_status is None:
			return
		self.assertEqual(get_stock_status(True, "Cookies - B", actual_qty=3, reserved_qty=3)["available"], False)
		self.assertEqual(get_stock_status(True, "Cookies - B", actual_qty=5, reserved_qty=2)["availableQty"], 3)

	def test_non_stock_item_does_not_require_bin_quantity(self):
		get_stock_status = getattr(storefront_catalog, "get_stock_status", None)
		self.assertTrue(callable(get_stock_status), "get_stock_status must be implemented")
		if get_stock_status is None:
			return
		self.assertEqual(
			get_stock_status(False, None),
			{"available": True, "availableQty": None, "availabilityReason": "non_stock_item"},
		)

	def test_selling_price_fields_copy_the_item_price_row(self):
		product_price_fields = getattr(storefront_catalog, "product_price_fields", None)
		self.assertTrue(callable(product_price_fields), "product_price_fields must be implemented")
		if product_price_fields is None:
			return
		self.assertEqual(
			product_price_fields(SimpleNamespace(price_list_rate=2_500_000, currency="IRR")),
			{"price": 2_500_000, "currency": "IRR"},
		)
```

- [ ] **Step 2: Run the stock tests and verify they fail for the missing helper**

Run: `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_catalog`

Expected: FAIL because `get_stock_status` is not implemented yet.

- [ ] **Step 3: Implement the pure stock-status and price-field helpers**

Add the typed helpers to `smule_store/domain/storefront_catalog.py`. For stock-managed Items, no selected Warehouse returns `warehouse_not_configured`; otherwise calculate `max(actual_qty - reserved_qty, 0)` and return `in_stock` only when the result is positive. Non-stock Items return available with a `None` quantity. `product_price_fields` copies only `price_list_rate` and `currency` from a row selected by the existing valid-`Item Price` query; it must not calculate or substitute BOM cost.

- [ ] **Step 4: Add the optional native Warehouse link to settings**

Add `sales_warehouse` to `field_order` and `fields` in `smule_store_settings.json` as a Link to `Warehouse`, displayed even while online orders are off so the owner can configure it safely. In `SmuleStoreSettings.validate`, if a Warehouse is selected require it to exist, be a leaf (`is_group == 0`), and belong to the selected Company; if online orders are enabled, require a Warehouse. Do not create or select a Warehouse automatically.

- [ ] **Step 5: Test the catalog uses Item Price rather than BOM cost for finished products**

Use the `product_price_fields` test from Step 1 to prove the exact native rate and currency pass through unchanged. In the API code, verify the finished-product branch obtains that row from the existing `_get_prices(item_codes, price_list)` query (which filters active selling `Item Price` records by Price List, date, and Item stock UOM), not `_get_ready_product_price`. Keep BOM-based calculation only for builder components, which are outside this subproject.

- [ ] **Step 6: Wire the API to native Item Price and Bin records**

In `api/storefront.py`, retain explicit-publication filtering, additionally require `is_sales_item == 1` for products, read `is_stock_item`, `item_group`, and `description`, and reuse `_get_prices` for finished products. Query `Bin` only for `settings.sales_warehouse`; pass `actual_qty` and `reserved_qty` through `get_stock_status`. Return product availability fields and the native `itemCode`. If the Warehouse is unset/invalid or the Item has no valid Item Price, return an honest unavailable/unpriced state rather than a sample value.

- [ ] **Step 7: Rerun backend tests and commit Task 2**

Run: `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_catalog`

Expected: PASS for all stock-status and catalog-price assertions. Confirm the test does not alter any ERPNext Item, Item Price, Warehouse, or Bin record.

Run: `git add smule_store/domain/storefront_catalog.py smule_store/tests/test_storefront_catalog.py smule_store/api/storefront.py smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.json smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.py && git commit -m "feat: read Smule catalog price and stock from ERPNext"`

Expected: one commit containing only the five Task 2 files.

---

### Task 3: Render Only Live Catalog Data in the Existing Storefront

**Files:**
- Modify: `storefront/lib/smule/frappe-client.ts`
- Modify: `storefront/lib/smule/products.ts`
- Create: `storefront/lib/smule/catalog.ts`
- Create: `storefront/tests/smule/catalog.test.mjs`
- Modify: `storefront/tests/smule/products.test.mjs`
- Modify: `storefront/components/smule/StorefrontDataProvider.tsx`
- Modify: `storefront/components/smule/MenuProductLookup.tsx`
- Modify: `storefront/components/smule/MenuCatalog.tsx`
- Modify: `storefront/components/smule/MenuCatalog.module.css`
- Modify: `storefront/components/smule/ProductDetail.module.css`
- Modify: `storefront/app/page.tsx`
- Modify: `storefront/app/globals.css`
- Modify: `storefront/app/menu/[slug]/page.tsx`
- Modify: `storefront/components/smule/AddProductButton.tsx`
- Modify: `storefront/components/smule/ProductDetail.tsx`
- Modify: `storefront/components/smule/ProductHero.tsx`

**Interfaces:**
- Consumes: catalog response fields `itemCode`, `isAvailable`, `availableQty`, and `availabilityReason`.
- Produces: live `SmuleProduct` rows whose cart/detail identity remains tied to the ERPNext Item; orderability requires online orders enabled, a verified positive price, a non-sample recipe state, and available stock.

- [ ] **Step 1: Add an empty mapper module, then write failing catalog-mapping tests**

Create `catalog.ts` with only a module comment, then import its namespace in tests and first assert that `mapCatalogProducts` is callable; this produces an expected assertion failure before behavior exists. Add assertions for mapping `itemCode` and native availability, an empty API response mapping to an empty list, and a missing price staying unpriced without a sample-price substitution. Verify the network-error path in the provider by code-path test/review: its initial and error state must both contain zero products, never `SMULE_PRODUCTS`.

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import * as catalog from "../../lib/smule/catalog.ts";
import { formatProductPrice, isProductOrderable } from "../../lib/smule/products.ts";

test("maps native Item Code and warehouse availability", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;
  const [product] = catalog.mapCatalogProducts([{
    itemCode: "COOKIE-001",
    slug: "COOKIE-001",
    name: "کوکی واقعی",
    price: 2_500_000,
    currency: "IRR",
    isAvailable: false,
    availableQty: 0,
    availabilityReason: "warehouse_not_configured",
  }], "IRR");
  assert.equal(product.itemCode, "COOKIE-001");
  assert.equal(product.isAvailable, false);
  assert.equal(product.availabilityReason, "warehouse_not_configured");
  assert.equal(product.price, 250_000);
});

test("an empty live ERPNext catalog remains empty", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;
  assert.deepEqual(catalog.mapCatalogProducts([], "IRR"), []);
});

test("a product with no valid ERPNext selling rate never receives a sample rate", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;
  const [product] = catalog.mapCatalogProducts([{
    itemCode: "COOKIE-002",
    slug: "COOKIE-002",
    name: "کوکی بی‌قیمت",
    isAvailable: false,
    availableQty: 0,
    availabilityReason: "warehouse_not_configured",
  }], "IRR");
  assert.equal(product.price, 0);
  assert.equal(formatProductPrice(product), "قیمت هنوز تأیید نشده");
});

test("a stock-unavailable product is not orderable even when online orders are enabled", () => {
  assert.equal(isProductOrderable({ price: 250_000, isSample: false, isAvailable: false }, true), false);
  assert.equal(isProductOrderable({ price: 250_000, isSample: false, isAvailable: true }, true), true);
});
```

- [ ] **Step 2: Run the focused storefront tests and verify the failure**

Run: `npm test -- --test-name-pattern="catalog|availability"`

Expected: FAIL because the catalog mapper and availability contract are not implemented.

- [ ] **Step 3: Implement the pure live-catalog mapper and product eligibility**

Implement `mapCatalogProducts(rows, currency)` in `catalog.ts` to convert API records into `SmuleProduct` rows, preserving `itemCode` and stock status. Extend `SmuleProduct` with optional `itemCode`, `isAvailable`, `availableQty`, and `availabilityReason`. Update `isProductOrderable` so it rejects unavailable stock as well as samples and invalid prices.

- [ ] **Step 4: Remove production sample fallbacks**

Set `previewState.products` to `[]`; in `mapCatalog`, use the mapped ERPNext products even when the result is empty; on a failed request, keep products/components empty and retain the API error. Remove the disconnected `SMULE_PRODUCTS` lookup from `MenuProductLookup`. Keep the existing static sample data available only to the separate builder/test code, which this task does not connect or publish.

- [ ] **Step 5: Show stock and catalog states without redesigning the UI**

- In `MenuCatalog` and the homepage `ProductCard`, retain the current card, typography, color, spacing, and navigation. Add concise status text for `warehouse_not_configured` and `out_of_stock`, and distinguish API failure, a truly empty enabled catalog, and a search with no matches. In `ProductHero`/`ProductDetail`, show the same availability status. In `AddProductButton`, keep the native disabled state and show the cause (warehouse not selected, no stock, or online orders disabled). Change the homepage's unconditional sample-data notice to an honest ERPNext/availability message based on provider state. Ensure messages are Persian, RTL-compatible, screen-reader readable (`role="status"`), and do not rely on color alone.

- [ ] **Step 6: Remove the server-rendered sample product route**

In `storefront/app/menu/[slug]/page.tsx`, remove `SMULE_PRODUCTS`-based `generateStaticParams`, `generateMetadata`, and server-side `notFound` lookups. Keep only generic static page metadata and render the existing `MenuProductLookup` client component so the requested slug must resolve against the live ERPNext catalog. Direct old sample URLs must not reveal sample product details.

- [ ] **Step 7: Run focused storefront tests, then the full test suite**

Run: `npm test -- --test-name-pattern="catalog|availability|product"`

Expected: PASS; product ordering is rejected for no warehouse/zero stock and the UI catalog has no sample fallback.

Run: `npm test`

Expected: all existing Smule tests pass, including builder preview and cart draft tests.

- [ ] **Step 8: Commit Task 3**

Run: `git add storefront/lib/smule/frappe-client.ts storefront/lib/smule/products.ts storefront/lib/smule/catalog.ts storefront/tests/smule/catalog.test.mjs storefront/tests/smule/products.test.mjs storefront/components/smule/StorefrontDataProvider.tsx storefront/components/smule/MenuProductLookup.tsx storefront/components/smule/MenuCatalog.tsx storefront/components/smule/MenuCatalog.module.css storefront/components/smule/ProductDetail.module.css storefront/app/page.tsx storefront/app/globals.css 'storefront/app/menu/[slug]/page.tsx' storefront/components/smule/AddProductButton.tsx storefront/components/smule/ProductDetail.tsx storefront/components/smule/ProductHero.tsx && git commit -m "feat: show live ERPNext catalog availability"`

Expected: one commit containing only the Task 3 files.

---

### Task 4: Verify Build and Deployment Readiness

**Files:**
- Verify: `smule_store/api/storefront.py`
- Verify: `storefront/app/page.tsx`
- Verify: `storefront/app/menu/page.tsx`
- Verify: `storefront/app/menu/[slug]/page.tsx`
- Verify: `/desk` remains served by Frappe/ERPNext.

- [ ] **Step 1: Run Python syntax and Frappe tests**

Run: `python3 -m compileall -q smule_store`

Expected: exit code 0 and no syntax errors.

Run: `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_bootstrap` and `bench --site boller.ir run-tests --module smule_store.tests.test_storefront_catalog`

Expected: both focused test modules pass.

- [ ] **Step 2: Run storefront lint, tests, and production build**

Run from `storefront/`: `npm run lint`, `npm test`, and `npm run build`.

Expected: all checks pass without changing route behavior or the `/desk` mount.

- [ ] **Step 3: Verify backend/API contract before live publication**

On a non-production test site, call `smule_store.api.storefront.get_catalog` with (a) no enabled Items, (b) an explicitly enabled Item with Item Price but no Warehouse, and (c) a selected Warehouse with zero stock. Expect respectively an empty product list, an unpriced/stock-unavailable honest product record, and `out_of_stock`; online orders/payments/delivery remain false in all three cases.

- [ ] **Step 4: Stop before changing live ERPNext records**

Do not enable any Item, set a Warehouse, change quantities, publish sample images/recipes, or turn on checkout/payments/delivery during code deployment. First obtain the owner's exact mapping for the old site product labels and the correct sales Warehouse, then use a separate rollout checklist with a verified backup.

---

## Self-Review

- **Spec coverage:** Module-map failure is Task 1; Item Price and Bin source-of-truth plus the optional Warehouse Link are Task 2; empty/error states, no sample fallback, preserved UI, and disabled orderability are Task 3; build and acceptance gates are Task 4. BOM/builder, customer, Sales Order, payment, delivery, and content remain separate subprojects as required by the integration design.
- **Placeholder scan:** No `TODO`, `TBD`, or unassigned implementation step remains; all catalog mapping, stock rules, files, and commands are specified.
- **Type consistency:** API keys `itemCode`, `isAvailable`, `availableQty`, and `availabilityReason` map to the corresponding optional `SmuleProduct` properties; `get_stock_status` uses the same keys and reason strings asserted by its tests.
