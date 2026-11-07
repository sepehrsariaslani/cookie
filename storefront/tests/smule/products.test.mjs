import test from "node:test";
import assert from "node:assert/strict";
import { getProductOrderBlockMessage, isProductOrderable } from "../../lib/smule/products.ts";

const product = { slug: "cinnamon-caramel", price: 190_000, isSample: false, isAvailable: true };

test("a product is orderable only when sales are enabled and its verified price is positive", () => {
  assert.equal(isProductOrderable(product, true), true);
  assert.equal(isProductOrderable(product, false), false);
  assert.equal(isProductOrderable({ ...product, isSample: true }, true), false);
  assert.equal(isProductOrderable({ ...product, price: 0 }, true), false);
  assert.equal(isProductOrderable({ ...product, price: Number.NaN }, true), false);
  assert.equal(isProductOrderable({ ...product, isAvailable: false }, true), false);
  assert.equal(isProductOrderable(undefined, true), false);
});

test("order block messages explain whether price, warehouse, stock, or checkout is missing", () => {
  assert.match(getProductOrderBlockMessage({ ...product, availabilityReason: "warehouse_not_configured", isAvailable: false }, true), /انبار فروش/);
  assert.match(getProductOrderBlockMessage({ ...product, availabilityReason: "out_of_stock", isAvailable: false }, true), /موجود نیست/);
  assert.match(getProductOrderBlockMessage({ ...product, price: 0 }, true), /قیمت فروش/);
  assert.match(getProductOrderBlockMessage(product, false), /پذیرش سفارش/);
});
