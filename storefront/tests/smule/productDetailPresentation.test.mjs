import test from "node:test";
import assert from "node:assert/strict";
import { getProductDetailLabels } from "../../lib/smule/products.ts";

test("sample product details identify placeholder photos and unverified recipe data", () => {
  assert.deepEqual(getProductDetailLabels({ isSample: true, imageIsSample: true }), {
    imageBadge: "نمای نمونه",
    notIncludedHeading: "در دستور نمونه نیست",
    allergenGuidance: "ترکیبات و هشدار حساسیت باید پیش از فروش با دستور واقعی آشپزخانه تطبیق داده شوند.",
  });
});

test("verified product details use labels appropriate for ERPNext product data", () => {
  const labels = getProductDetailLabels({ isSample: false, imageIsSample: false });
  assert.equal(labels.imageBadge, "تصویر ثبت‌شدهٔ محصول");
  assert.equal(labels.notIncludedHeading, "در دستور ثبت‌شده نیست");
  assert.match(labels.allergenGuidance, /ERPNext/);
});

test("a verified product without its own photo still identifies the fallback image", () => {
  assert.equal(getProductDetailLabels({ isSample: false, imageIsSample: true }).imageBadge, "نمای نمونه");
});

test("legacy sample products default to the sample photo badge", () => {
  assert.equal(getProductDetailLabels({ isSample: true }).imageBadge, "نمای نمونه");
});
