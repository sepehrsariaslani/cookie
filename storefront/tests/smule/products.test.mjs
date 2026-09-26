import test from "node:test";
import assert from "node:assert/strict";
import { isProductOrderable } from "../../lib/smule/products.ts";

const product = { slug: "cinnamon-caramel", price: 190_000, isSample: false };

test("a product is orderable only when sales are enabled and its verified price is positive", () => {
  assert.equal(isProductOrderable(product, true), true);
  assert.equal(isProductOrderable(product, false), false);
  assert.equal(isProductOrderable({ ...product, isSample: true }, true), false);
  assert.equal(isProductOrderable({ ...product, price: 0 }, true), false);
  assert.equal(isProductOrderable({ ...product, price: Number.NaN }, true), false);
  assert.equal(isProductOrderable(undefined, true), false);
});
