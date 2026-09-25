import type { NutritionFacts } from "./products";
import { smuleAsset } from "./assets";

export type DoughId = "vanilla" | "cocoa" | "marble" | "oat" | "banana-oat" | "date-cinnamon" | "almond" | "whole-wheat" | "sugar";
export type ToppingGroupId = "fruit" | "chocolate" | "nuts" | "creams" | "flavor" | "crunch";
export type ToppingId =
  | "banana" | "raisin" | "date" | "cranberry"
  | "dark-chocolate" | "milk-chocolate" | "white-chocolate"
  | "walnut" | "pistachio" | "almond" | "hazelnut"
  | "peanut-butter" | "pistachio-cream" | "caramel"
  | "cinnamon" | "sea-salt" | "vanilla" | "orange-zest"
  | "oat-flakes" | "sesame";

export type IngredientVisualGroup = "chocolate" | "nut" | "crumb" | "salt";

export type DoughOption = {
  id: DoughId;
  name: string;
  note: string;
  ingredients: string[];
  allergens: string[];
  visualColor: string;
  recipe: NutritionFacts;
};

export type ToppingOption = {
  id: ToppingId;
  name: string;
  note: string;
  group: ToppingGroupId;
  /** Approximate grams per 50 g cookie; scaled to size and capped as a group. */
  gramsPer50: number;
  allergens: string[];
  visualGroup: IngredientVisualGroup;
  visualColor: string;
  recipe: NutritionFacts;
};

export const COOKIE_SIZES = [
  { grams: 30, label: "کوچک", note: "یک گازِ خوشمزه" },
  { grams: 50, label: "متوسط", note: "اندازهٔ روزمره" },
  { grams: 100, label: "بزرگ", note: "برای یک هوسِ جدی" },
] as const;

export const MIN_COOKIE_GRAMS = 30;
export const MAX_COOKIE_GRAMS = 150;
export const COOKIE_GRAM_STEP = 5;
export const MAX_TOPPING_COUNT = 6;
export const MAX_TOPPING_WEIGHT_RATIO = 0.4;

export const DOUGHS: DoughOption[] = [
  {
    id: "vanilla",
    name: "وانیلی کلاسیک",
    note: "آرد گندم سفید؛ بافت ریز و کره‌ای",
    ingredients: ["آرد گندم", "کره", "تخم‌مرغ", "وانیل"],
    allergens: ["گلوتن", "لبنیات", "تخم‌مرغ"],
    visualColor: "#fff3d8",
    recipe: { calories: 486, protein: 6, carbohydrates: 64, fat: 21, sugar: 30 },
  },
  {
    id: "cocoa",
    name: "کاکائویی خالص",
    note: "تمام خمیر، شکلاتی",
    ingredients: ["آرد گندم", "کره", "تخم‌مرغ", "کاکائو"],
    allergens: ["گلوتن", "لبنیات", "تخم‌مرغ"],
    visualColor: "#74412e",
    recipe: { calories: 498, protein: 7, carbohydrates: 62, fat: 24, sugar: 32 },
  },
  {
    id: "marble",
    name: "ماربل وانیل و کاکائو",
    note: "رگه‌های دو خمیر در هم",
    ingredients: ["آرد گندم", "کره", "تخم‌مرغ", "وانیل", "کاکائو"],
    allergens: ["گلوتن", "لبنیات", "تخم‌مرغ"],
    visualColor: "#d4a16d",
    recipe: { calories: 492, protein: 6, carbohydrates: 63, fat: 23, sugar: 31 },
  },
  {
    id: "oat",
    name: "جو دوسر و عسل",
    note: "بافت دانه‌دار و ملایم",
    ingredients: ["جو دوسر", "کره", "عسل", "تخم‌مرغ"],
    allergens: ["جو دوسر", "لبنیات", "تخم‌مرغ"],
    visualColor: "#d5b17a",
    recipe: { calories: 448, protein: 8, carbohydrates: 61, fat: 18, sugar: 24 },
  },
  {
    id: "banana-oat",
    name: "جو دوسر و موز",
    note: "موزِ رسیده در خود خمیر",
    ingredients: ["جو دوسر", "موز", "کره", "تخم‌مرغ"],
    allergens: ["جو دوسر", "لبنیات", "تخم‌مرغ"],
    visualColor: "#d9b76e",
    recipe: { calories: 402, protein: 7, carbohydrates: 63, fat: 13, sugar: 22 },
  },
  {
    id: "date-cinnamon",
    name: "خرما و دارچین",
    note: "گرم و میوه‌ای، با عطر ادویه",
    ingredients: ["آرد گندم", "خرما", "دارچین", "کره"],
    allergens: ["گلوتن", "لبنیات"],
    visualColor: "#bb8050",
    recipe: { calories: 435, protein: 6, carbohydrates: 67, fat: 16, sugar: 29 },
  },
  {
    id: "whole-wheat",
    name: "گندم کامل",
    note: "سبوس‌دار، دانه‌ریز و برشته",
    ingredients: ["آرد گندم کامل", "کره", "شکر قهوه‌ای", "تخم‌مرغ"],
    allergens: ["گلوتن", "لبنیات", "تخم‌مرغ"],
    visualColor: "#ac7e4e",
    recipe: { calories: 455, protein: 8, carbohydrates: 61, fat: 19, sugar: 24 },
  },
  {
    id: "sugar",
    name: "کره‌ای شکری",
    note: "خمیر لطیف با دانه‌های ریز شکر",
    ingredients: ["آرد گندم", "کره", "شکر", "تخم‌مرغ", "وانیل"],
    allergens: ["گلوتن", "لبنیات", "تخم‌مرغ"],
    visualColor: "#ead3a2",
    recipe: { calories: 498, protein: 5, carbohydrates: 68, fat: 23, sugar: 35 },
  },
  {
    id: "almond",
    name: "پایهٔ بادام",
    note: "آجیلی و لطیف؛ دستور نمونه",
    ingredients: ["آرد بادام", "تخم‌مرغ", "وانیل"],
    allergens: ["مغز بادام", "تخم‌مرغ"],
    visualColor: "#dfbd91",
    recipe: { calories: 524, protein: 12, carbohydrates: 45, fat: 34, sugar: 21 },
  },
];

export const TOPPING_GROUPS: Array<{ id: ToppingGroupId; title: string; note: string }> = [
  { id: "fruit", title: "میوه و شیرینی طبیعی", note: "موز، کشمش، خرما و کرنبری" },
  { id: "chocolate", title: "شکلات‌ها", note: "تلخ، شیری و سفید" },
  { id: "nuts", title: "مغزها", note: "گردو، پسته، بادام و فندق" },
  { id: "creams", title: "کرم و مغزیِ نرم", note: "کرهٔ بادام‌زمینی، کرم پسته و کارامل" },
  { id: "flavor", title: "طعم‌دهنده‌ها", note: "ادویه و عطرهای ظریف" },
  { id: "crunch", title: "دانه و بافت ترد", note: "جو دوسر و کنجد" },
];

/** Sample values per 100 g; recipe, bake loss, and allergen handling need kitchen verification. */
export const TOPPINGS: ToppingOption[] = [
  { id: "banana", name: "موز", note: "رسیده و نرم", group: "fruit", gramsPer50: 6, allergens: [], visualGroup: "chocolate", visualColor: "#e1bd5f", recipe: { calories: 89, protein: 1, carbohydrates: 23, fat: 0, sugar: 12 } },
  { id: "raisin", name: "کشمش", note: "شیرین و جویدنی", group: "fruit", gramsPer50: 5, allergens: [], visualGroup: "chocolate", visualColor: "#63372a", recipe: { calories: 299, protein: 3, carbohydrates: 79, fat: 1, sugar: 59 } },
  { id: "date", name: "خرمای خردشده", note: "شیرینیِ میوه‌ای", group: "fruit", gramsPer50: 6, allergens: [], visualGroup: "chocolate", visualColor: "#805037", recipe: { calories: 282, protein: 2, carbohydrates: 75, fat: 0, sugar: 63 } },
  { id: "cranberry", name: "کرنبری خشک", note: "کمی ترش و میوه‌ای", group: "fruit", gramsPer50: 4, allergens: [], visualGroup: "chocolate", visualColor: "#9d3340", recipe: { calories: 308, protein: 0, carbohydrates: 83, fat: 1, sugar: 72 } },
  { id: "dark-chocolate", name: "شکلات تلخ", note: "عمیق و کم‌شیرین", group: "chocolate", gramsPer50: 6, allergens: [], visualGroup: "chocolate", visualColor: "#3a1d17", recipe: { calories: 598, protein: 8, carbohydrates: 46, fat: 43, sugar: 24 } },
  { id: "milk-chocolate", name: "شکلات شیری", note: "نرم و خامه‌ای", group: "chocolate", gramsPer50: 6, allergens: ["لبنیات"], visualGroup: "chocolate", visualColor: "#80503b", recipe: { calories: 535, protein: 7, carbohydrates: 59, fat: 30, sugar: 52 } },
  { id: "white-chocolate", name: "شکلات سفید", note: "شیرین و لطیف", group: "chocolate", gramsPer50: 6, allergens: ["لبنیات"], visualGroup: "chocolate", visualColor: "#f2dfbd", recipe: { calories: 539, protein: 6, carbohydrates: 59, fat: 32, sugar: 59 } },
  { id: "walnut", name: "گردو", note: "کمی تلخ و ترد", group: "nuts", gramsPer50: 4, allergens: ["مغز گردو"], visualGroup: "nut", visualColor: "#9a6b43", recipe: { calories: 654, protein: 15, carbohydrates: 14, fat: 65, sugar: 3 } },
  { id: "pistachio", name: "پستهٔ خردشده", note: "سبز و خوش‌عطر", group: "nuts", gramsPer50: 4, allergens: ["مغز پسته"], visualGroup: "nut", visualColor: "#83924d", recipe: { calories: 562, protein: 20, carbohydrates: 28, fat: 45, sugar: 8 } },
  { id: "almond", name: "بادام", note: "ترد و ملایم", group: "nuts", gramsPer50: 4, allergens: ["مغز بادام"], visualGroup: "nut", visualColor: "#c29365", recipe: { calories: 579, protein: 21, carbohydrates: 22, fat: 50, sugar: 4 } },
  { id: "hazelnut", name: "فندق", note: "عطر آجیلیِ برشته", group: "nuts", gramsPer50: 4, allergens: ["مغز فندق"], visualGroup: "nut", visualColor: "#956341", recipe: { calories: 628, protein: 15, carbohydrates: 17, fat: 61, sugar: 4 } },
  { id: "peanut-butter", name: "کرهٔ بادام‌زمینی", note: "مغزی و کرمی", group: "creams", gramsPer50: 5, allergens: ["بادام‌زمینی"], visualGroup: "chocolate", visualColor: "#bd8550", recipe: { calories: 588, protein: 25, carbohydrates: 20, fat: 50, sugar: 9 } },
  { id: "pistachio-cream", name: "کرم پسته", note: "مرکز نرم و پسته‌ای", group: "creams", gramsPer50: 5, allergens: ["پسته", "احتمالاً لبنیات؛ دستور نهایی لازم است"], visualGroup: "chocolate", visualColor: "#a3a461", recipe: { calories: 560, protein: 12, carbohydrates: 45, fat: 38, sugar: 35 } },
  { id: "caramel", name: "کارامل", note: "مغزیِ شیرین و کش‌دار", group: "creams", gramsPer50: 6, allergens: ["آلرژن‌ها وابسته به دستور"], visualGroup: "crumb", visualColor: "#c47b3c", recipe: { calories: 390, protein: 2, carbohydrates: 79, fat: 8, sugar: 68 } },
  { id: "cinnamon", name: "دارچین", note: "گرم و ادویه‌ای", group: "flavor", gramsPer50: 0.5, allergens: [], visualGroup: "crumb", visualColor: "#a36d3d", recipe: { calories: 247, protein: 4, carbohydrates: 81, fat: 1, sugar: 2 } },
  { id: "sea-salt", name: "نمک دریا", note: "برای تعادل شیرینی", group: "flavor", gramsPer50: 0.3, allergens: [], visualGroup: "salt", visualColor: "#f2ecdf", recipe: { calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0 } },
  { id: "vanilla", name: "وانیل", note: "عطر لطیف", group: "flavor", gramsPer50: 0.4, allergens: [], visualGroup: "crumb", visualColor: "#e5c98f", recipe: { calories: 288, protein: 0, carbohydrates: 13, fat: 0, sugar: 13 } },
  { id: "orange-zest", name: "پوست پرتقال", note: "عطر مرکبات تازه", group: "flavor", gramsPer50: 1, allergens: [], visualGroup: "crumb", visualColor: "#df913e", recipe: { calories: 97, protein: 2, carbohydrates: 25, fat: 0, sugar: 0 } },
  { id: "oat-flakes", name: "پرک جو دوسر", note: "بافت دانه‌دار", group: "crunch", gramsPer50: 5, allergens: ["جو دوسر"], visualGroup: "nut", visualColor: "#d8bd91", recipe: { calories: 389, protein: 17, carbohydrates: 66, fat: 7, sugar: 1 } },
  { id: "sesame", name: "کنجد برشته", note: "ریز و خوش‌عطر", group: "crunch", gramsPer50: 3, allergens: ["کنجد"], visualGroup: "nut", visualColor: "#d9c291", recipe: { calories: 573, protein: 18, carbohydrates: 23, fat: 50, sugar: 1 } },
];

export type CookieNutrition = NutritionFacts & {
  /** The selected size is the base dough weight; additions are extra. */
  baseWeight: number;
  weight: number;
  doughWeight: number;
  toppingWeight: number;
  toppingAmounts: Partial<Record<ToppingId, number>>;
};

export function getToppingAmountForBase(toppingId: ToppingId, baseWeight: number) {
  const option = TOPPINGS.find((item) => item.id === toppingId);
  if (!option) return 0;
  return Number((option.gramsPer50 * baseWeight / 50).toFixed(1));
}

export function getToppingCapacity(baseWeight: number) {
  return Number((baseWeight * MAX_TOPPING_WEIGHT_RATIO).toFixed(1));
}

export function canAddTopping(toppingIds: ToppingId[], toppingId: ToppingId, baseWeight: number) {
  if (toppingIds.includes(toppingId)) return true;
  if (toppingIds.length >= MAX_TOPPING_COUNT) return false;
  const currentWeight = toppingIds.reduce((sum, id) => sum + getToppingAmountForBase(id, baseWeight), 0);
  return currentWeight + getToppingAmountForBase(toppingId, baseWeight) <= getToppingCapacity(baseWeight) + 0.001;
}

export function calculateCookieNutrition(doughId: DoughId, toppingIds: ToppingId[], sizeGrams: number): CookieNutrition {
  const dough = DOUGHS.find((option) => option.id === doughId) ?? DOUGHS[0];
  const requestedSize = Number.isFinite(sizeGrams) ? sizeGrams : MIN_COOKIE_GRAMS;
  const size = Math.min(MAX_COOKIE_GRAMS, Math.max(MIN_COOKIE_GRAMS, requestedSize));
  const selected = TOPPINGS.filter((option) => toppingIds.includes(option.id));
  const toppingAmounts = Object.fromEntries(selected.map((option) => [option.id, getToppingAmountForBase(option.id, size)])) as Partial<Record<ToppingId, number>>;
  const toppingWeight = Number(Object.values(toppingAmounts).reduce((sum, amount) => sum + (amount ?? 0), 0).toFixed(1));
  const doughWeight = size;
  const base = { calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0 };
  const nutrition = selected.reduce((total, option) => {
    const grams = toppingAmounts[option.id] ?? 0;
    return {
      calories: total.calories + option.recipe.calories * grams / 100,
      protein: total.protein + option.recipe.protein * grams / 100,
      carbohydrates: total.carbohydrates + option.recipe.carbohydrates * grams / 100,
      fat: total.fat + option.recipe.fat * grams / 100,
      sugar: total.sugar + option.recipe.sugar * grams / 100,
    };
  }, base);

  return {
    baseWeight: size,
    weight: Number((size + toppingWeight).toFixed(1)),
    doughWeight: Number(doughWeight.toFixed(1)),
    toppingWeight,
    toppingAmounts,
    calories: Math.round(nutrition.calories + dough.recipe.calories * doughWeight / 100),
    protein: Number((nutrition.protein + dough.recipe.protein * doughWeight / 100).toFixed(1)),
    carbohydrates: Number((nutrition.carbohydrates + dough.recipe.carbohydrates * doughWeight / 100).toFixed(1)),
    fat: Number((nutrition.fat + dough.recipe.fat * doughWeight / 100).toFixed(1)),
    sugar: Number((nutrition.sugar + dough.recipe.sugar * doughWeight / 100).toFixed(1)),
  };
}

export function getToppingName(id: ToppingId) {
  return TOPPINGS.find((option) => option.id === id)?.name ?? id;
}

export function getDoughImage(id: DoughId) {
  return smuleAsset(`/images/builder-dough/${id}.png`);
}

export function getToppingImage(id: ToppingId) {
  return smuleAsset(`/images/builder-ingredients/${id}.png`);
}
