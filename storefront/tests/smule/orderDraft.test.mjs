import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalOrderDraft, getReadySubtotal } from "../../lib/smule/order-draft.ts";
import { SMULE_PRODUCTS } from "../../lib/smule/products.ts";

const customer = { name: "  آزمایش  ", phone: "09120000000", city: "تهران", address: "نشانی آزمایشی", note: "  یادداشت  " };

test("ready subtotal and product line use the catalog price, not the stored cart price", () => {
  const items = [{ kind: "product", productSlug: "cinnamon-caramel", quantity: 2, unitPrice: 1 }];
  const verifiedProducts = SMULE_PRODUCTS.map((product) => ({ ...product, isSample: false }));
  const order = buildLocalOrderDraft({
    items,
    customer,
    deliveryMethod: "pickup",
    createdAt: new Date("2026-09-24T10:30:00.000Z"),
    id: "SM-TEST-001",
    products: verifiedProducts,
  });

  assert.equal(getReadySubtotal(items, verifiedProducts), 380_000);
  assert.equal(getReadySubtotal(items), 0);
  assert.ok(order);
  assert.equal(order.readySubtotal, 380_000);
  assert.equal(order.lines[0].kind, "product");
  assert.equal(order.lines[0].unitPrice, 190_000);
  assert.equal(order.lines[0].lineTotal, 380_000);
  assert.equal(order.customer.name, "آزمایش");
  assert.equal(order.customer.city, "");
  assert.equal(order.customer.address, "");
  assert.equal(order.customer.note, "یادداشت");
});

test("custom-cookie line is recalculated from its recipe and remains quote-required", () => {
  const order = buildLocalOrderDraft({
    items: [
      { kind: "custom", doughId: "oat", sizeGrams: 50, toppingIds: ["banana", "milk-chocolate", "walnut"], quantity: 1 },
    ],
    customer,
    deliveryMethod: "delivery",
    id: "SM-TEST-002",
  });

  assert.ok(order);
  assert.equal(order.readySubtotal, 0);
  assert.equal(order.customQuoteRequired, true);
  assert.equal(order.deliveryAndPaymentNeedConfirmation, true);
  assert.deepEqual(order.lines[0], {
    kind: "custom",
    title: "جو دوسر و عسل، بیس ۵۰ گرمی",
    doughId: "oat",
    baseWeight: 50,
    finalWeight: 66,
    calories: 288,
    toppings: ["موز", "شکلات شیری", "گردو"],
    quantity: 1,
    quoteRequired: true,
  });
  assert.equal(order.customer.city, "تهران");
  assert.equal(order.customer.address, "نشانی آزمایشی");
});

test("a customer-requested pickup or delivery schedule remains attached to the order", () => {
  const verifiedProducts = SMULE_PRODUCTS.map((product) => ({ ...product, isSample: false }));
  const order = buildLocalOrderDraft({
    items: [{ kind: "product", productSlug: "cinnamon-caramel", quantity: 1 }],
    customer,
    deliveryMethod: "delivery",
    requestedForDate: "2026-09-28",
    requestedForTime: "09:30",
    id: "SM-TEST-SCHEDULE",
    products: verifiedProducts,
  });

  assert.ok(order);
  assert.equal(order.requestedForDate, "2026-09-28");
  assert.equal(order.requestedForTime, "09:30");
});

test("empty carts, invalid products, and invalid quantities cannot become drafts", () => {
  assert.equal(buildLocalOrderDraft({ items: [], customer, deliveryMethod: "pickup" }), null);
  assert.equal(buildLocalOrderDraft({
    items: [{ kind: "product", productSlug: "missing", quantity: 1 }],
    customer,
    deliveryMethod: "pickup",
  }), null);
  assert.equal(buildLocalOrderDraft({
    items: [{ kind: "product", productSlug: "cinnamon-caramel", quantity: 0 }],
    customer,
    deliveryMethod: "pickup",
  }), null);
});
