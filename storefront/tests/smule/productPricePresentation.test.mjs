import test from "node:test";
import assert from "node:assert/strict";
import { formatProductPrice } from "../../lib/smule/products.ts";

test("unverified sample products never display a numeric selling price", () => {
  assert.equal(formatProductPrice({ price: 190_000, isSample: true }), "قیمت هنوز تأیید نشده");
});

test("verified products display the ERP-provided selling price", () => {
  assert.match(formatProductPrice({ price: 190_000, isSample: false }), /۱۹۰٬۰۰۰ تومان/);
});

test("zero-priced products stay visibly unpriced", () => {
  assert.equal(formatProductPrice({ price: 0, isSample: false }), "قیمت هنوز تأیید نشده");
});
