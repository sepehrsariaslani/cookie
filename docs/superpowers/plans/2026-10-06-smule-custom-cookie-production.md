# Custom Cookie Sales-to-Work-Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Execute inline only; the user explicitly requested no agents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers configure cookies from live ERPNext Items, preserve the server-verified material recipe on Sales Order Items, and let staff create linked native BOMs, Work Orders, and material-transfer Stock Entries from a submitted Sales Order.

**Architecture:** Keep the existing storefront and use published ERPNext `Item` records as the only dough/topping/flavor source. Recalculate and snapshot each recipe on the server. A permission-checked Desk action previews the exact materials, then creates one non-default native BOM and Work Order per custom Sales Order Item and submits ERPNext's `Material Transfer for Manufacture` Stock Entry to the configured WIP Warehouse.

**Tech Stack:** Frappe/ERPNext 16, Python >=3.14, React 19, TypeScript 5.9, Node >=22.13, Node's built-in test runner, Python `unittest`.

## Global Constraints

- User requests solo execution; do not create or use agents.
- Preserve all pre-existing dirty files and generated storefront deployment assets; stage or commit only files created by this plan, and never include a pre-existing dirty file in a commit.
- Do not commit a tracked source file that was already dirty before this plan unless its staged patch is proven to contain only this task's hunks; leave overlapping user changes unstaged.
- Use native `Sales Order`, `Sales Order Item`, `BOM`, `BOM Item`, `Work Order`, and `Stock Entry`; never update `Bin` or stock-ledger tables directly.
- Submit only `Material Transfer for Manufacture` when staff explicitly confirms; final `Manufacture` stays in ERPNext's normal production flow.
- Never guess product mappings, recipes, UOM conversion factors, warehouses, prices, or stock, and never enable online orders/payment/delivery as a side effect.
- Live Builder, Cart, and Checkout must not display hard-coded sample recipes, component names, or ingredient photographs as ERPNext data.
- Keep the established Smule storefront visual design and `/desk` routing unchanged.
- Automated tests must use isolated mocks/fixtures and must not create or change live Items, BOMs, Work Orders, Stock Entries, Bins, or warehouse balances.

## File Responsibilities

- `storefront/lib/smule/live-cookie-builder.ts`: type and map the ERPNext component catalog; compute live-only amounts and nutrition without sample fallback.
- `storefront/components/smule/StorefrontDataProvider.tsx`: retain Item Code, image, stock UOM, and stock-managed state from the API.
- `smule_store/api/storefront.py`: expose live component stock UOM/stock-item metadata required by Builder and Checkout.
- `smule_store/tests/test_storefront_catalog.py`: prove native component metadata is returned without sample substitutions.
- `storefront/components/smule/CookieBuilder.tsx`, `CartProvider.tsx`, `CartPage.tsx`, `CheckoutPage.tsx`, `CookieCanvas.tsx`, and `three/cookieBuilderScene.ts`: keep builder/cart/order identity on arbitrary live slugs, use live labels, and show an honest unavailable/neutral preview when a model is not authored.
- `smule_store/api/orders.py`: snapshot canonical material Item Codes and grams on each custom Sales Order Item.
- `smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.json` and `.py`: store and validate raw-material source and WIP warehouses separately from the finished-goods sales warehouse.
- `smule_store/domain/custom_cookie_manufacturing.py`: pure recipe parsing, material aggregation, and exact gram-to-stock-UOM quantity validation.
- `smule_store/api/manufacturing.py`: permission-checked preview/idempotent create flow using only native ERPNext manufacturing and stock APIs.
- `smule_store/public/js/sales_order.js` and `smule_store/hooks.py`: add the staff preview/confirmation action to submitted Sales Orders.

---

### Task 1: Map arbitrary live ERPNext components without samples

**Files:**
- Create: `storefront/lib/smule/live-cookie-builder.ts`
- Create: `storefront/tests/smule/liveCookieBuilder.test.mjs`
- Modify: `storefront/lib/smule/cookie-builder.ts`

**Interfaces:**
- Consumes: live catalog rows with `itemCode`, `slug`, `kind`, `name`, `description`, `ingredients`, `group`, `gramsPer50`, `nutrition`, `allergens`, `visualGroup`, `visualColor`, `image`, `isSample`, `costPerGram`, and `costCurrency`.
- Produces: `mapLiveCookieComponents(rows) -> { doughs, toppings }`, where each option keeps `id=slug` and `itemCode`; `calculateLiveCookieNutrition(doughSlug, toppingSlugs, sizeGrams, rows) -> CookieNutrition | null`.
- Produces: `getBuilderVisual(kind, slug) -> {imagePath: string | null, modelId: string | null}` from an explicit authored-asset allowlist; arbitrary ERPNext slugs never become file paths.
- Produces: generic `string` component IDs for live cart data while retaining legacy static constants only for existing story/demo tests.

- [ ] **Step 1: Add failing tests for arbitrary item slugs and no live fallback**

Use a live dough slug `house-dough-17` and topping slug `sesame-crunch-v2`, neither present in the legacy arrays. Assert Item Codes and ERPNext names are preserved, `gramsPer50` drives topping weight, nutrition uses live metadata, same-slug Dough/Topping records remain distinct by `kind`, and `mapLiveCookieComponents([])` returns empty lists. Assert missing/sample components produce `null` live nutrition instead of a static recipe.

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import * as liveBuilder from "../../lib/smule/live-cookie-builder.ts";

const rows = [
  { itemCode: "DOUGH-17", slug: "house-dough-17", kind: "Dough", name: "خمیر اختصاصی", description: "", ingredients: ["آرد"], group: "", gramsPer50: 0, nutrition: { calories: 420, protein: 8, carbohydrates: 55, fat: 18, sugar: 12 }, allergens: ["گلوتن"], visualGroup: "crumb", visualColor: "#c98955", image: "", isSample: false, costPerGram: 100, costCurrency: "IRR" },
  { itemCode: "TOP-9", slug: "sesame-crunch-v2", kind: "Topping", name: "کنجد ترد", description: "", ingredients: [], group: "grains", gramsPer50: 3, nutrition: { calories: 573, protein: 18, carbohydrates: 23, fat: 50, sugar: 1 }, allergens: ["کنجد"], visualGroup: "nut", visualColor: "#d9c291", image: "", isSample: false, costPerGram: 200, costCurrency: "IRR" },
];

test("live options preserve arbitrary ERPNext identity and metadata", () => {
  assert.equal(typeof liveBuilder.mapLiveCookieComponents, "function");
  const options = liveBuilder.mapLiveCookieComponents(rows);
  assert.equal(options.doughs[0].id, "house-dough-17");
  assert.equal(options.doughs[0].itemCode, "DOUGH-17");
  assert.equal(options.toppings[0].itemCode, "TOP-9");
});

test("live nutrition uses ERPNext grams and never falls back for missing or sample items", () => {
  assert.equal(typeof liveBuilder.calculateLiveCookieNutrition, "function");
  assert.equal(liveBuilder.calculateLiveCookieNutrition("house-dough-17", ["sesame-crunch-v2"], 50, rows).toppingWeight, 3);
  assert.equal(liveBuilder.calculateLiveCookieNutrition("not-published", [], 50, rows), null);
  assert.deepEqual(liveBuilder.mapLiveCookieComponents([]), { doughs: [], toppings: [] });
});
```

- [ ] **Step 2: Create an empty module scaffold and run the focused test to verify RED**

Create `live-cookie-builder.ts` with only its module comment, then make the test import it as a namespace and assert the expected exports are functions before calling them. Run: `npm test`

Expected: only the new live-builder test fails because its behavior exports do not exist; the pre-existing 44 frontend tests remain green.

- [ ] **Step 3: Implement live-only mapping, grouping, and visual lookup**

Add `LiveCookieComponent`, `LiveDoughOption`, and `LiveToppingOption` types. Make `mapLiveCookieComponents` return only rows with non-empty `itemCode`, `slug`, and a supported kind; map all presentation/calculation fields directly from the row. Implement `calculateLiveCookieNutrition` by resolving Dough and Topping/Flavor from the supplied live rows only; reject missing/sample/invalid components with `null`, clamp base grams to the existing supported range, and calculate topping grams from the live `gramsPer50`. Implement `getLiveToppingGroupTitle(group)` with Persian titles for known groups and a «سایر افزودنی‌ها» fallback. Implement `getBuilderVisual(kind, slug)` from explicit existing-asset allowlists; never interpolate unknown slugs into a URL. Generalize exported live IDs in `cookie-builder.ts` to `string` without deleting legacy constants used by non-order story/tests.

- [ ] **Step 4: Re-run focused and existing cookie-builder tests**

Run: `npm test`

Expected: all frontend tests pass, including both new behaviors and existing static-story/pricing tests.

---

### Task 2: Use live component identity throughout Builder, Cart, and Checkout

**Files:**
- Modify: `storefront/components/smule/StorefrontDataProvider.tsx`
- Modify: `storefront/components/smule/CookieBuilder.tsx`
- Modify: `storefront/components/smule/CartProvider.tsx`
- Modify: `storefront/components/smule/CartPage.tsx`
- Modify: `storefront/components/smule/CheckoutPage.tsx`
- Modify: `storefront/components/smule/CookieCanvas.tsx`
- Modify: `storefront/components/smule/three/cookieBuilderScene.ts`
- Modify: `storefront/components/smule/CookieBuilder.module.css`
- Modify: `smule_store/api/storefront.py`
- Modify: `smule_store/tests/test_storefront_catalog.py`
- Test: `storefront/tests/smule/liveCookieBuilder.test.mjs`

**Interfaces:**
- Consumes: `mapLiveCookieComponents` and `calculateLiveCookieNutrition` from Task 1.
- Produces: Builder options, Cart labels, Checkout summaries, and 3D accessibility text derived from current `StorefrontComponent` rows; unsupported slugs never become asset paths or static sample recipes.

- [ ] **Step 1: Add failing tests for live metadata, groups, and unknown visual assets**

Extend the pure helper tests with a known live group omitted by the current UI (`grains`) and an unknown group; assert the known group gets a Persian label and the unknown group gets «سایر افزودنی‌ها». Test that arbitrary slugs are not returned as model or image paths unless they are in the authored asset allowlist. Extend the backend catalog test to assert `stockUom` and `isStockItem` are included on each component row.

- [ ] **Step 2: Run the frontend/backend focused suites and verify the expected failures**

Run from `storefront/`: `npm test`

Expected: the new group/asset tests fail while the existing frontend tests pass.

Run from repository root: `python3 -m unittest smule_store.tests.test_storefront_catalog`

Expected: the new catalog field assertion fails because `get_catalog` does not yet expose component stock fields.

- [ ] **Step 3: Replace fixed builder options with live rows**

Expose `image` (already read from the Item), `stockUom`, and `isStockItem` in each live component row from `api/storefront.py`; map them in the provider. In `CookieBuilder`, derive dough/toppings from live rows; initialize selection from the first live Dough only after load; represent API error, empty catalog, and missing Dough as distinct honest Persian states; render all configured groups, mapping unrecognized group codes to «سایر افزودنی‌ها»; disable Add unless a live Dough is selected, every selected component resolves, price is valid, and orders are enabled. Do not import `DOUGHS`, `TOPPINGS`, or a static fallback to populate live Builder choices.

- [ ] **Step 4: Preserve live slugs and snapshots in local cart state**

In `CartProvider`, restore string slug IDs without filtering against static arrays and without recalculating a saved live line from the legacy sample arrays. Preserve a validated saved nutrition object or replace malformed nutrition with a zero-valued neutral object. In Cart and Checkout, recompute/display nutrition and names from the current live rows; if a saved slug is no longer published, mark that line unavailable and block checkout while preserving the customer's ability to remove it. Pass live labels into `CookieCanvas`; known authored models may be used only for allowlisted slugs, and all other components use a neutral cookie preview with no ingredient-specific sample image or model request.

- [ ] **Step 5: Run Builder/cart focused tests, lint, and type/build checks**

Run: `npm test`

Expected: PASS with arbitrary slugs retained and no sample substitution.

Run: `npm run lint`

Expected: no ESLint errors; report any existing warnings separately.

Run: `npm run build`

Expected: successful production export.

---

### Task 3: Snapshot exact material Item Codes and gram amounts at checkout

**Files:**
- Modify: `smule_store/api/orders.py`
- Modify: `smule_store/tests/test_order_custom_line.py`

**Interfaces:**
- Consumes: current `Dough`, `Topping`, and `Flavor` Item records re-resolved by enabled slug and kind.
- Produces: `recipe_json.materials: list[{itemCode: str, slug: str, kind: str, name: str, grams: float, uom: "Gram"}]`, with Dough grams equal to base weight and each selected topping grams copied from the server's `calculate_custom_cookie` result. Each selected material must be a stock Item with a valid `stock_uom`; Gram conversion is revalidated by Task 5 before an order is accepted.

- [ ] **Step 1: Write a failing order-line test for exact material snapshots**

Extend `test_order_custom_line.py`'s isolated probe to include stock Dough/Topping Items with stock UOMs, a 50 g Dough, a topping whose live rule is 3 g per 50 g, and quantity 2. Assert the saved recipe contains Dough `DOUGH-1` at 50 g and the selected Topping Item Code at 3 g per cookie; assert the line quantity remains 2 and no client-supplied material quantities are read. Add a separate test that a non-stock Dough cannot become a real order line.

- [ ] **Step 2: Run the focused Python test and confirm RED**

Run: `python3 -m unittest smule_store.tests.test_order_custom_line`

Expected: FAIL only because the server recipe does not yet expose `materials`.

- [ ] **Step 3: Add the canonical server-side material snapshot**

Extend `_get_store_item`'s returned fields with `stock_uom`; in `_read_custom_line`, require each selected material to be an active stock Item with a stock UOM, then build `materials` from resolved Item records and the server calculation, not request-supplied amounts. Store the new list inside `recipe_json`; preserve existing recipe keys for Cart/Checkout compatibility. Reject duplicate/invalid slug selections through existing server validation. Gram conversion validation is added in Task 5 before checkout can create a Sales Order.

- [ ] **Step 4: Run order-line tests and the backend baseline**

Run: `python3 -m unittest smule_store.tests.test_order_custom_line`

Expected: PASS and exact Item Code/gram assertions.

Run: `python3 -m unittest discover -s smule_store/tests`

Expected: all backend tests pass.

---

### Task 4: Configure and validate manufacturing Warehouses

**Files:**
- Modify: `smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.json`
- Modify: `smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.py`
- Modify: `smule_store/tests/test_storefront_settings.py`

**Interfaces:**
- Consumes: existing `company` and `sales_warehouse` settings.
- Produces: optional Link settings `production_source_warehouse` and `production_wip_warehouse`; each configured value must be an active leaf Warehouse owned by the selected Company, and source must differ from WIP. They remain unselected unless the owner explicitly configures them.

- [ ] **Step 1: Add failing settings validation tests**

Extend the settings probe to assert both new values accept active leaf warehouses for the configured Company, reject a group/disabled/foreign-company Warehouse, reject identical source and WIP selections, and allow both values to remain blank while online orders are disabled.

- [ ] **Step 2: Run the focused settings test and confirm RED**

Run: `python3 -m unittest smule_store.tests.test_storefront_settings`

Expected: FAIL because the fields and validation do not exist.

- [ ] **Step 3: Add two native Warehouse Link fields and narrow validation**

Insert the two Link fields in the settings JSON next to `sales_warehouse`. Add a small helper in `SmuleStoreSettings.validate` to validate each non-empty warehouse's existence, `disabled == 0`, `is_group == 0`, and matching `company`; reject identical production source/WIP values. Do not make these fields mandatory merely to save settings or enable ready-product-only orders; the custom-cookie production endpoint will give the specific missing-configuration error.

- [ ] **Step 4: Verify the settings tests and JSON structure**

Run: `python3 -m unittest smule_store.tests.test_storefront_settings`

Expected: PASS for valid, blank, and invalid Warehouse cases.

Run: `python3 -m json.tool smule_store/smule_store/doctype/smule_store_settings/smule_store_settings.json`

Expected: valid formatted JSON, exit code 0.

---

### Task 5: Add pure recipe aggregation and exact UOM conversion helpers

**Files:**
- Create: `smule_store/domain/custom_cookie_manufacturing.py`
- Create: `smule_store/tests/test_custom_cookie_manufacturing.py`
- Modify: `smule_store/api/orders.py`
- Modify: `smule_store/tests/test_order_custom_line.py`

**Interfaces:**
- Produces: `build_material_quantities(recipe: dict, output_stock_qty: float) -> list[dict]`, aggregating duplicate Item Codes and returning `{item_code, qty_grams}` with finite positive amounts. `output_stock_qty` is `Sales Order Item.stock_qty`, because ERPNext Work Order quantities and BOM outputs use the Item stock UOM.
- Produces: `grams_to_stock_qty(qty_grams: float, conversion_factor: float) -> float`, accepting only finite non-negative grams and a finite positive ERPNext conversion factor.
- The API obtains an exact factor from an Item-specific UOM Conversion Detail or ERPNext's native global `UOM Conversion Factor`; it must not accept ERPNext's missing-conversion fallback of `1.0` when the stock UOM is not Gram.

- [ ] **Step 1: Write failing tests for material extraction and conversion**

Create tests for (a) scaling Dough and multiple toppings by `Sales Order Item.stock_qty`, (b) aggregating two recipe entries for the same Item Code, (c) parsing the stored legacy recipe shape as well as the new `materials` list, (d) rejecting missing Item Code/grams, negative/non-finite amounts and invalid output quantity, (e) converting 50 g with factor `0.001` to `0.05` stock UOM, and (f) rejecting zero/non-finite conversion factors.

```python
class TestCustomCookieManufacturing(unittest.TestCase):
	def test_recipe_materials_scale_to_sales_order_quantity(self):
		self.assertEqual(
			build_material_quantities(
				{"materials": [
					{"itemCode": "DOUGH", "grams": 50},
					{"itemCode": "TOP-1", "grams": 3},
				]},
				2,
			),
			[{"item_code": "DOUGH", "qty_grams": 100.0}, {"item_code": "TOP-1", "qty_grams": 6.0}],
		)

	def test_missing_conversion_is_not_treated_as_one(self):
		with self.assertRaises(ValueError):
			grams_to_stock_qty(50, 0)
```

- [ ] **Step 2: Run the new focused test and confirm RED**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing`

Expected: FAIL because the helper module/functions do not yet exist.

- [ ] **Step 3: Implement deterministic material aggregation/conversion**

Parse the stored `materials` list; for earlier server-created snapshots, derive the same list only from the saved Dough Item Code/base weight, saved Topping Item Codes, and saved server-calculated `topping_amounts` (never from the browser). Validate all numeric values with `math.isfinite`, require positive material grams and output quantity, merge equal Item Codes, sort by Item Code for deterministic BOM creation, and raise `ValueError` for invalid data. Keep this module independent of Frappe so tests run without a live site. In `_read_custom_line`, resolve the exact Gram conversion using Item `UOM Conversion Detail` or ERPNext's global `UOM Conversion Factor` and reject a missing factor before creating a Sales Order.

- [ ] **Step 4: Run the focused helper tests**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing`

Expected: PASS for all material and conversion cases.

---

### Task 6: Preview and create native BOM, Work Order, and transfer Stock Entry

**Files:**
- Create: `smule_store/api/manufacturing.py`
- Create: `smule_store/tests/test_custom_cookie_manufacturing_api.py`
- Consume: `smule_store/domain/custom_cookie_manufacturing.py`
- Consume: ERPNext `erpnext.stock.get_item_details.get_conversion_factor`, `erpnext.stock.doctype.item.item.get_uom_conv_factor`, and `erpnext.manufacturing.doctype.work_order.work_order.make_stock_entry`.

**Interfaces:**
- `get_custom_cookie_work_order_preview(sales_order: str) -> {salesOrder, ready, blockers, sourceWarehouse, wipWarehouse, fgWarehouse, lines}` is read-only and reports exact material grams, stock UOM quantities, availability, and existing Work Order/Stock Entry links. Missing setup/stock is returned as `ready=false` with Persian blockers so the Desk dialog can explain it; permission and invalid Sales Order failures remain errors.
- `create_custom_cookie_work_orders(sales_order: str) -> {salesOrder, workOrders}` accepts only the Sales Order identifier; it re-runs all validation, creates one BOM/Work Order per unconverted custom Sales Order Item, submits exactly one native `Material Transfer for Manufacture` Stock Entry per new Work Order, and returns existing linked documents on retries.

- [ ] **Step 1: Write failing API tests around a fake ERPNext document boundary**

Use the same isolated-subprocess Frappe stubbing pattern as `test_order_custom_line.py`. Assert preview rejects an unsubmitted Sales Order; missing warehouses return blockers; preview includes the correct scaled materials and availability after subtracting `reserved_qty`, `reserved_qty_for_production`, `reserved_qty_for_sub_contract`, and `reserved_qty_for_production_plan`; create links Work Order to the right Sales Order Item and uses `row.stock_qty` for Work Order quantity; BOM has `is_default=0`; the ERPNext `make_stock_entry(work_order.name, "Material Transfer for Manufacture")` result is inserted and submitted; a repeated call returns the existing Work Order/Stock Entry without submitting a second transfer; insufficient stock, a missing Gram conversion, a non-custom line, or a mismatched Item Code creates no BOM/Work Order/Stock Entry.

- [ ] **Step 2: Run the new API tests and confirm RED**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing_api`

Expected: FAIL because the manufacturing API does not exist.

- [ ] **Step 3: Implement shared authorization, snapshot validation, and preview**

Require a logged-in user with create permission for both `Work Order` and `Stock Entry`; call `Sales Order.check_permission("read")`. Require `docstatus == 1`; each candidate child row must belong to that Sales Order, match `settings.custom_cookie_item`, have a valid stored recipe, and not be a ready-product row. For each material, require an enabled stock Item and an exact Gram-to-stock-UOM factor. Use the Item's Gram `UOM Conversion Detail` factor when present, otherwise ERPNext's `get_uom_conv_factor`; reject a missing factor instead of assuming 1.0. Compute physical availability as `max(actual_qty - reserved_qty - reserved_qty_for_production - reserved_qty_for_sub_contract - reserved_qty_for_production_plan, 0)`; do not count incoming/ordered quantity. Return missing configuration, conversion, and stock as `ready=false` blockers in preview; the create endpoint must fail before writing if any blocker remains. Identify any existing linked Work Order/Stock Entry.

- [ ] **Step 4: Implement idempotent creation using ERPNext controllers**

Lock the submitted Sales Order with `frappe.get_doc("Sales Order", name, for_update=True)`, re-read its child rows/settings, and lock/re-check every source `Bin` row before creating documents. Prevalidate all unconverted lines together, including combined demand for repeated Item Codes, before writes. Scale each recipe by `row.stock_qty`, not transaction `qty`. Insert and submit an active, non-default BOM with output `quantity=1`, one BOM Item per aggregated material (`uom="Gram"`, exact `conversion_factor`, configured source Warehouse). Insert/submit the native Work Order with `production_item=settings.custom_cookie_item`, `sales_order`, exact `sales_order_item`, `qty=row.stock_qty`, BOM, source Warehouse, WIP Warehouse, and `fg_warehouse=settings.sales_warehouse`; keep `skip_transfer=0`. Call ERPNext `make_stock_entry(work_order.name, "Material Transfer for Manufacture")`, insert and submit that Stock Entry, and let exceptions abort the request transaction. Before writes, detect an existing non-cancelled Work Order by `(sales_order, sales_order_item)` and return its submitted transfer rather than creating duplicate stock movement.

- [ ] **Step 5: Run focused API/helper tests and backend suite**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing smule_store.tests.test_custom_cookie_manufacturing_api`

Expected: PASS, including idempotent retries and zero writes on validation errors.

Run: `python3 -m unittest discover -s smule_store/tests`

Expected: all backend tests pass.

---

### Task 7: Add the Sales Order Desk preview/confirmation action

**Files:**
- Create: `smule_store/public/js/sales_order.js`
- Modify: `smule_store/hooks.py`
- Test: `smule_store/tests/test_custom_cookie_manufacturing_api.py`

**Interfaces:**
- Consumes: the read-only preview and confirmed-create APIs from Task 6.
- Produces: a Persian Desk action on submitted Sales Orders containing custom-cookie lines. The dialog lists each Sales Order Item, selected materials, total quantities, source/WIP Warehouses, and any stock/configuration blockers; only an explicit final confirmation calls the create API.

- [ ] **Step 1: Add a failing hook/visibility contract test**

Extend the backend API test to assert a registered `doctype_js["Sales Order"]` path and the script contract: preview occurs before create, create is not invoked for a cancelled dialog, and read-only Sales Orders cannot call create.

- [ ] **Step 2: Verify the hook test fails before registration**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing_api`

Expected: FAIL because the Sales Order script is not registered.

- [ ] **Step 3: Register and implement the Desk action**

Register `doctype_js = {"Sales Order": "public/js/sales_order.js"}` in `hooks.py`. In the form refresh handler, show the action only for submitted Sales Orders with at least one custom recipe line. Call the preview API first; render server-returned values with `frappe.utils.escape_html`; display blockers without a create button; on explicit confirmation call the create API, then show links to each Work Order and submitted transfer Stock Entry and refresh the Sales Order.

- [ ] **Step 4: Run API tests and validate Desk script syntax**

Run: `python3 -m unittest smule_store.tests.test_custom_cookie_manufacturing_api`

Expected: PASS for hook path and preview-before-confirmation contract.

Run: `node --check smule_store/public/js/sales_order.js`

Expected: no syntax error.

---

### Task 8: Verify the complete path and safely deploy code only

**Files:**
- Modify only if required by verification: source files above.
- Generated: `smule_store/public/site/` static export, using the repository's existing sync script.

- [ ] **Step 1: Run all frontend and backend tests from fresh state**

Run from `storefront/`: `npm test`

Expected: all Node tests pass.

Run from repository root: `python3 -m unittest discover -s smule_store/tests`

Expected: all Python tests pass.

- [ ] **Step 2: Run lint, Python compilation, and production build**

Run from `storefront/`: `npm run lint && npm run build`

Expected: lint exits 0 (existing warnings may be listed, but no errors) and production export succeeds.

Run from repository root: `python3 -m compileall -q smule_store`

Expected: exit 0.

- [ ] **Step 3: Review migration and deploy boundaries**

Confirm `online_orders_enabled`, `delivery_enabled`, and `zarinpal_enabled` remain unchanged/off; confirm no Item, BOM, Work Order, Stock Entry, Warehouse, or Bin values have been written by tests. Back up site `boller.ir` before migration. Deploy the app/Desk hook and run migration/cache refresh only after backup. Synchronize the static export with `bash storefront/scripts/sync-frappe-site.sh`; do not run `seed_sample_catalog` or change product publication flags.

- [ ] **Step 4: Smoke-test runtime without creating production documents**

Verify `https://erpyar.ir/` and `/build-cookie` return 200; the builder uses only API components and shows an honest unavailable/configuration state while live components are empty; `/desk` still redirects to ERPNext login; the catalog API returns no samples; and the Desk action is absent for unsubmitted Sales Orders. Do not create BOM/Work Order/Stock Entry because the live raw-material Items and production Warehouses are not configured.

- [ ] **Step 5: Compare every acceptance criterion with evidence**

Check all eight acceptance criteria in `docs/superpowers/specs/2026-10-06-smule-custom-cookie-production-design.md` against focused test output, API behavior, Desk script, runtime smoke test, and current ERPNext records. Explicitly report any criterion that remains blocked by missing real Item/UOM/Warehouse configuration; do not claim the whole store objective complete while catalog publication, payment, delivery, or other integration phases remain unfinished.
