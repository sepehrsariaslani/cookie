import type { NutritionFacts } from "./products";
import type { CookieNutrition } from "./cookie-builder";
import {
  MAX_COOKIE_GRAMS,
  MAX_TOPPING_COUNT,
  MAX_TOPPING_WEIGHT_RATIO,
  MIN_COOKIE_GRAMS,
} from "./cookie-builder";
import { smuleAsset } from "./assets";

export type LiveCookieComponent = {
  itemCode: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  ingredients: string[];
  group: string;
  gramsPer50: number;
  baseWeightGrams: number;
  nutrition: NutritionFacts;
  allergens: string[];
  visualGroup: string;
  visualColor: string;
  image: string;
  isSample: boolean;
  costPerGram: number | null;
  costCurrency: string | null;
};

export type LiveDoughOption = Omit<LiveCookieComponent, "kind" | "group" | "gramsPer50"> & {
  kind: "Dough";
  id: string;
  note: string;
  recipe: NutritionFacts;
};

export type LiveToppingOption = Omit<LiveCookieComponent, "kind" | "baseWeightGrams"> & {
  kind: "Topping" | "Flavor";
  id: string;
  note: string;
  group: string;
  recipe: NutritionFacts;
};

const DOUGH_ASSETS = new Set([
  "vanilla", "cocoa", "marble", "oat", "banana-oat", "date-cinnamon", "almond", "whole-wheat", "sugar",
]);
const TOPPING_ASSETS = new Set([
  "banana", "raisin", "date", "cranberry", "dark-chocolate", "milk-chocolate", "white-chocolate", "walnut",
  "pistachio", "almond", "hazelnut", "peanut-butter", "pistachio-cream", "caramel", "cinnamon", "sea-salt",
  "vanilla", "orange-zest", "oat-flakes", "sesame",
]);

function validNutrition(value: NutritionFacts) {
  return value && [value.calories, value.protein, value.carbohydrates, value.fat, value.sugar]
    .every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

export function mapLiveCookieComponents(rows: LiveCookieComponent[]) {
  const usable = rows.filter((row) => row && row.itemCode.trim() && row.slug.trim() && row.name.trim() && !row.isSample);
  return {
    doughs: usable.filter((row) => row.kind === "Dough").map((row): LiveDoughOption => ({
      ...row,
      kind: "Dough",
      id: row.slug,
      note: row.description,
      recipe: row.nutrition,
    })),
    toppings: usable.filter((row) => row.kind === "Topping" || row.kind === "Flavor").map((row): LiveToppingOption => ({
      ...row,
      kind: row.kind as "Topping" | "Flavor",
      id: row.slug,
      note: row.description,
      group: row.group,
      recipe: row.nutrition,
    })),
  };
}

export function calculateLiveCookieNutrition(
  doughSlug: string,
  toppingSlugs: string[],
  sizeGrams: number,
  rows: LiveCookieComponent[],
): CookieNutrition | null {
  const dough = rows.find((row) => row.kind === "Dough" && row.slug === doughSlug && !row.isSample);
  if (!dough || !validNutrition(dough.nutrition)) return null;
  const toppings = toppingSlugs.map((slug) => rows.find((row) =>
    (row.kind === "Topping" || row.kind === "Flavor") && row.slug === slug && !row.isSample));
  if (toppings.some((row) => !row || !validNutrition(row.nutrition) || !Number.isFinite(row.gramsPer50) || row.gramsPer50 < 0)) return null;
  if (!Number.isFinite(sizeGrams)) return null;

  const baseWeight = Math.min(MAX_COOKIE_GRAMS, Math.max(MIN_COOKIE_GRAMS, sizeGrams));
  const toppingAmounts = Object.fromEntries(toppings.map((row) => [row!.slug, Number((row!.gramsPer50 * baseWeight / 50).toFixed(1))]));
  const toppingWeight = Number(Object.values(toppingAmounts).reduce((sum, amount) => sum + amount, 0).toFixed(1));
  const totals = toppings.reduce((sum, row) => {
    const grams = toppingAmounts[row!.slug] ?? 0;
    return {
      calories: sum.calories + row!.nutrition.calories * grams / 100,
      protein: sum.protein + row!.nutrition.protein * grams / 100,
      carbohydrates: sum.carbohydrates + row!.nutrition.carbohydrates * grams / 100,
      fat: sum.fat + row!.nutrition.fat * grams / 100,
      sugar: sum.sugar + row!.nutrition.sugar * grams / 100,
    };
  }, { calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0 });

  return {
    baseWeight,
    weight: Number((baseWeight + toppingWeight).toFixed(1)),
    doughWeight: baseWeight,
    toppingWeight,
    toppingAmounts,
    calories: Math.round(totals.calories + dough.nutrition.calories * baseWeight / 100),
    protein: Number((totals.protein + dough.nutrition.protein * baseWeight / 100).toFixed(1)),
    carbohydrates: Number((totals.carbohydrates + dough.nutrition.carbohydrates * baseWeight / 100).toFixed(1)),
    fat: Number((totals.fat + dough.nutrition.fat * baseWeight / 100).toFixed(1)),
    sugar: Number((totals.sugar + dough.nutrition.sugar * baseWeight / 100).toFixed(1)),
  };
}

export function getLiveToppingAmount(slug: string, baseWeight: number, rows: LiveCookieComponent[]) {
  const row = rows.find((component) =>
    (component.kind === "Topping" || component.kind === "Flavor") && component.slug === slug && !component.isSample);
  if (!row || !Number.isFinite(row.gramsPer50) || row.gramsPer50 < 0 || !Number.isFinite(baseWeight)) return null;
  const size = Math.min(MAX_COOKIE_GRAMS, Math.max(MIN_COOKIE_GRAMS, baseWeight));
  return Number((row.gramsPer50 * size / 50).toFixed(1));
}

export function canAddLiveTopping(slugs: string[], slug: string, baseWeight: number, rows: LiveCookieComponent[]) {
  if (slugs.includes(slug)) return true;
  if (slugs.length >= MAX_TOPPING_COUNT) return false;
  const current = slugs.map((id) => getLiveToppingAmount(id, baseWeight, rows));
  const candidate = getLiveToppingAmount(slug, baseWeight, rows);
  if (candidate === null || current.some((amount) => amount === null)) return false;
  return current.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) + candidate
    <= baseWeight * MAX_TOPPING_WEIGHT_RATIO + 0.001;
}

export function normalizeSavedCookieNutrition(value: unknown): CookieNutrition {
  const neutral: CookieNutrition = {
    baseWeight: 0, weight: 0, doughWeight: 0, toppingWeight: 0, toppingAmounts: {},
    calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return neutral;
  const candidate = value as Partial<CookieNutrition>;
  const numericKeys = ["baseWeight", "weight", "doughWeight", "toppingWeight", "calories", "protein", "carbohydrates", "fat", "sugar"] as const;
  if (numericKeys.some((key) => typeof candidate[key] !== "number" || !Number.isFinite(candidate[key]) || candidate[key]! < 0)) return neutral;
  if (!candidate.toppingAmounts || typeof candidate.toppingAmounts !== "object" || Array.isArray(candidate.toppingAmounts)) return neutral;
  const toppingAmounts = Object.fromEntries(Object.entries(candidate.toppingAmounts).map(([slug, amount]) => [slug, amount])) as Record<string, number>;
  if (Object.values(toppingAmounts).some((amount) => typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)) return neutral;
  return {
    baseWeight: candidate.baseWeight!,
    weight: candidate.weight!,
    doughWeight: candidate.doughWeight!,
    toppingWeight: candidate.toppingWeight!,
    toppingAmounts,
    calories: candidate.calories!,
    protein: candidate.protein!,
    carbohydrates: candidate.carbohydrates!,
    fat: candidate.fat!,
    sugar: candidate.sugar!,
  };
}

export function getLiveToppingGroupTitle(group: string) {
  const titles: Record<string, string> = {
    fruit: "میوه و شیرینی طبیعی",
    chocolate: "شکلات‌ها",
    nuts: "مغزها",
    creams: "کرم و مغزیِ نرم",
    flavor: "طعم‌دهنده‌ها",
    crunch: "دانه و بافت ترد",
    grains: "دانه و غلات",
  };
  return titles[group] ?? "سایر افزودنی‌ها";
}

export function getBuilderVisual(kind: "Dough" | "Topping" | "Flavor", slug: string) {
  if (kind === "Dough" && DOUGH_ASSETS.has(slug)) {
    return {
      imagePath: smuleAsset(`/images/builder-dough/${slug}.png`),
      modelId: slug,
    };
  }
  if ((kind === "Topping" || kind === "Flavor") && TOPPING_ASSETS.has(slug)) {
    return {
      imagePath: smuleAsset(`/images/builder-ingredients/${slug}.png`),
      modelId: slug,
    };
  }
  return { imagePath: null, modelId: null };
}
