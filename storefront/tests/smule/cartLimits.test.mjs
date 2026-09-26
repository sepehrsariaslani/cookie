import test from "node:test";
import assert from "node:assert/strict";
import {
  addCartLine,
  getCartAddResult,
  MAX_CART_LINE_QUANTITY,
  MAX_CART_LINES,
  normalizeCartQuantity,
} from "../../lib/smule/cart-limits.ts";

const line = (configKey, quantity = 1) => ({ configKey, quantity });

test("cart adds up to 20 of one configuration and reports the quantity cap", () => {
  const fullLine = line("product:classic", MAX_CART_LINE_QUANTITY);
  const items = [fullLine];

  assert.equal(getCartAddResult(items, fullLine.configKey), "quantity-limit");
  assert.deepEqual(addCartLine(items, line(fullLine.configKey)), {
    items,
    result: "quantity-limit",
  });
  assert.equal(addCartLine([line(fullLine.configKey, 19)], line(fullLine.configKey)).items[0].quantity, 20);
});

test("cart accepts 30 distinct configurations and blocks a 31st", () => {
  const items = Array.from({ length: MAX_CART_LINES }, (_, index) => line(`cookie:${index}`));

  assert.equal(getCartAddResult(items, "cookie:new"), "line-limit");
  assert.equal(addCartLine(items, line("cookie:new")).items.length, MAX_CART_LINES);
  assert.equal(getCartAddResult(items, "cookie:0"), "added");
});

test("restored quantities are kept within the server's accepted range", () => {
  assert.equal(normalizeCartQuantity(0), 1);
  assert.equal(normalizeCartQuantity(4.9), 4);
  assert.equal(normalizeCartQuantity(999), MAX_CART_LINE_QUANTITY);
  assert.equal(normalizeCartQuantity(Number.NaN), 1);
});
