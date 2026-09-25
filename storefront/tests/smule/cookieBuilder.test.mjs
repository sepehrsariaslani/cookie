import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddTopping,
  calculateCookieNutrition,
  DOUGHS,
  getToppingAmountForBase,
  getToppingCapacity,
  MAX_TOPPING_COUNT,
  TOPPINGS,
} from "../../lib/smule/cookie-builder.ts";

test("catalog doughs and toppings have unique ids", () => {
  const doughIds = DOUGHS.map(({ id }) => id);
  const toppingIds = TOPPINGS.map(({ id }) => id);

  assert.equal(new Set(doughIds).size, doughIds.length);
  assert.equal(new Set(toppingIds).size, toppingIds.length);
  assert.ok(doughIds.length >= 8);
  assert.ok(toppingIds.length >= 18);
});

test("custom-cookie nutrition includes topping mass and macros", () => {
  const nutrition = calculateCookieNutrition("oat", ["banana", "milk-chocolate", "walnut"], 50);

  assert.deepEqual(
    {
      baseWeight: nutrition.baseWeight,
      doughWeight: nutrition.doughWeight,
      toppingWeight: nutrition.toppingWeight,
      weight: nutrition.weight,
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbohydrates: nutrition.carbohydrates,
      fat: nutrition.fat,
      sugar: nutrition.sugar,
    },
    {
      baseWeight: 50,
      doughWeight: 50,
      toppingWeight: 16,
      weight: 66,
      calories: 288,
      protein: 5.1,
      carbohydrates: 36,
      fat: 13.4,
      sugar: 16,
    },
  );
  assert.deepEqual(nutrition.toppingAmounts, { banana: 6, "milk-chocolate": 6, walnut: 4 });
});

test("topping quantities scale with the selected base weight", () => {
  assert.equal(getToppingAmountForBase("banana", 30), 3.6);
  assert.equal(getToppingAmountForBase("banana", 100), 12);
  assert.equal(getToppingCapacity(50), 20);
  assert.equal(getToppingCapacity(150), 60);

  const nutrition = calculateCookieNutrition("vanilla", ["banana"], 100);
  assert.equal(nutrition.baseWeight, 100);
  assert.equal(nutrition.weight, 112);
  assert.equal(nutrition.toppingAmounts.banana, 12);
});

test("topping selection respects both the gram limit and six-item limit", () => {
  const selected = ["banana", "milk-chocolate", "walnut"];
  assert.equal(canAddTopping(selected, "cinnamon", 50), true);
  assert.equal(canAddTopping(selected, "caramel", 50), false);
  assert.equal(canAddTopping(selected, "banana", 50), true);

  const sixLightToppings = ["cinnamon", "sea-salt", "vanilla", "orange-zest", "walnut", "pistachio"];
  assert.equal(sixLightToppings.length, MAX_TOPPING_COUNT);
  assert.equal(canAddTopping(sixLightToppings, "sesame", 50), false);
});

test("base dough weight is clamped to the supported range", () => {
  const tooSmall = calculateCookieNutrition("vanilla", [], 1);
  const tooLarge = calculateCookieNutrition("vanilla", [], 1000);

  assert.equal(tooSmall.baseWeight, 30);
  assert.equal(tooSmall.weight, 30);
  assert.equal(tooLarge.baseWeight, 150);
  assert.equal(tooLarge.weight, 150);
});
