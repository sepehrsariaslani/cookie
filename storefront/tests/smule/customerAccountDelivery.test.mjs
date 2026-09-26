import test from "node:test";
import assert from "node:assert/strict";
import { formatDeliveryMethod, formatDeliveryStatus } from "../../lib/smule/delivery-presentation.ts";

test("customer account names the configured Karaj courier delivery method", () => {
  assert.equal(formatDeliveryMethod("ارسال"), "اسنپ‌پیک · کرج");
  assert.equal(formatDeliveryMethod("تحویل حضوری"), "تحویل حضوری");
});

test("customer account translates native ERPNext delivery statuses", () => {
  assert.equal(formatDeliveryStatus("Not Delivered"), "هنوز ارسال یا تحویل نشده");
  assert.equal(formatDeliveryStatus("Partly Delivered"), "بخشی از سفارش تحویل شده");
  assert.equal(formatDeliveryStatus("Fully Delivered"), "سفارش کامل تحویل شده");
  assert.equal(formatDeliveryStatus("Custom status"), "Custom status");
});
