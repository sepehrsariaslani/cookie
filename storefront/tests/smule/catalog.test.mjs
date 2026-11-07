import test from "node:test";
import assert from "node:assert/strict";
import * as catalog from "../../lib/smule/catalog.ts";
import { getProductAvailabilityMessage, isProductOrderable } from "../../lib/smule/products.ts";

test("ERPNext catalog mapping preserves item identity, price, and warehouse availability", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;

  const [product] = catalog.mapCatalogProducts([{
    itemCode: "COOKIE-001",
    slug: "COOKIE-001",
    name: "کوکی گردویی",
    price: 250_000,
    image: "/files/walnut-cookie.png",
    isSample: false,
    isAvailable: false,
    availableQty: 0,
    availabilityReason: "out_of_stock",
  }], "IRR");

  assert.equal(product.itemCode, "COOKIE-001");
  assert.equal(product.slug, "COOKIE-001");
  assert.equal(product.price, 25_000);
  assert.equal(product.isAvailable, false);
  assert.equal(product.availableQty, 0);
  assert.equal(product.availabilityReason, "out_of_stock");
  assert.match(getProductAvailabilityMessage(product), /موجود نیست/);
  assert.equal(isProductOrderable(product, true), false);
});

test("an empty ERPNext catalog stays empty instead of falling back to sample products", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;
  assert.deepEqual(catalog.mapCatalogProducts([], "IRR"), []);
});

test("a missing ERPNext selling price stays unpriced and unorderable", () => {
  assert.equal(typeof catalog.mapCatalogProducts, "function");
  if (typeof catalog.mapCatalogProducts !== "function") return;
  const [product] = catalog.mapCatalogProducts([{
    itemCode: "COOKIE-002",
    slug: "COOKIE-002",
    name: "کوکی خرما",
    price: null,
    isSample: false,
    isAvailable: true,
    availableQty: 8,
    availabilityReason: "in_stock",
  }], "IRR");
  assert.equal(product.price, 0);
  assert.equal(isProductOrderable(product, true), false);
});

test("a published product with no configured warehouse is unorderable", () => {
  assert.equal(isProductOrderable({
    price: 25_000,
    isSample: false,
    isAvailable: false,
    availabilityReason: "warehouse_not_configured",
  }, true), false);
});
