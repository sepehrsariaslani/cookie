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
  assert.equal(options.doughs[0].name, "خمیر اختصاصی");
  assert.equal(options.toppings[0].itemCode, "TOP-9");
});

test("live nutrition uses ERPNext grams and never falls back for missing or sample items", () => {
  assert.equal(typeof liveBuilder.calculateLiveCookieNutrition, "function");
  const nutrition = liveBuilder.calculateLiveCookieNutrition("house-dough-17", ["sesame-crunch-v2"], 50, rows);
  assert.equal(nutrition.toppingWeight, 3);
  assert.equal(nutrition.calories, 227);
  assert.equal(liveBuilder.calculateLiveCookieNutrition("not-published", [], 50, rows), null);
  assert.equal(liveBuilder.calculateLiveCookieNutrition("house-dough-17", [], 50, [{ ...rows[0], isSample: true }]), null);
  assert.deepEqual(liveBuilder.mapLiveCookieComponents([]), { doughs: [], toppings: [] });
});

test("live groups use stable Persian titles and visuals never interpolate unknown slugs", () => {
  assert.equal(typeof liveBuilder.getLiveToppingGroupTitle, "function");
  assert.equal(liveBuilder.getLiveToppingGroupTitle("grains"), "دانه و غلات");
  assert.equal(liveBuilder.getLiveToppingGroupTitle("unmapped-live-group"), "سایر افزودنی‌ها");
  assert.equal(typeof liveBuilder.getBuilderVisual, "function");
  assert.deepEqual(liveBuilder.getBuilderVisual("Dough", "house-dough-17"), { imagePath: null, modelId: null });
  assert.deepEqual(liveBuilder.getBuilderVisual("Topping", "sesame-crunch-v2"), { imagePath: null, modelId: null });
  assert.equal(liveBuilder.getBuilderVisual("Dough", "marble").modelId, "marble");
});

test("live topping capacity and saved nutrition never consult sample constants", () => {
  assert.equal(typeof liveBuilder.getLiveToppingAmount, "function");
  assert.equal(typeof liveBuilder.canAddLiveTopping, "function");
  assert.equal(liveBuilder.getLiveToppingAmount("sesame-crunch-v2", 50, rows), 3);
  assert.equal(liveBuilder.canAddLiveTopping([], "sesame-crunch-v2", 50, rows), true);
  assert.equal(liveBuilder.getLiveToppingAmount("missing", 50, rows), null);
  assert.equal(typeof liveBuilder.normalizeSavedCookieNutrition, "function");
  assert.deepEqual(liveBuilder.normalizeSavedCookieNutrition({ weight: "bad" }), {
    baseWeight: 0, weight: 0, doughWeight: 0, toppingWeight: 0, toppingAmounts: {},
    calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0,
  });
});
