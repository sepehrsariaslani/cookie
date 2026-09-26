import { smuleAsset } from "./assets";

export type NutritionFacts = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  sugar: number;
};

export type SmuleProduct = {
  /** Extendable storefront category; future desserts use the same menu grouping. */
  category: string;
  slug: string;
  number: string;
  name: string;
  shortName: string;
  description: string;
  price: number;
  className: string;
  image: string;
  /** True when the storefront is showing its generic fallback rather than a saved product photo. */
  imageIsSample?: boolean;
  imageFilter: string;
  serving: string;
  nutrition: NutritionFacts;
  ingredients: string[];
  notIncluded: string[];
  allergens: string[];
  /** True when the value came from an unverified starter recipe. */
  isSample?: boolean;
};

/** Sample prices and nutrition figures; replace them with verified values before opening sales. */
export const SMULE_PRODUCTS: SmuleProduct[] = [
  {
    category: "کوکی",
    slug: "classic-chocolate",
    number: "۰۱",
    name: "کلاسیک شکلاتی",
    shortName: "کلاسیک شکلاتی",
    description: "خمیر کره‌ای با تکه‌های شکلات تلخ و قلب نرم.",
    price: 185_000,
    className: "product-classic",
    image: smuleAsset("/images/smule-cookie-chocolate.png"),
    imageIsSample: true,
    imageFilter: "none",
    serving: "یک عدد · حدود ۱۱۰ گرم",
    nutrition: { calories: 443, protein: 6, carbohydrates: 54, fat: 22, sugar: 27 },
    ingredients: ["آرد گندم", "کره", "شکر قهوه‌ای", "شکلات تلخ"],
    notIncluded: ["گردو", "دارچین"],
    allergens: ["گلوتن (آرد گندم)", "لبنیات (کره)"],
    isSample: true,
  },
  {
    category: "کوکی",
    slug: "sea-salt",
    number: "۰۲",
    name: "نمک دریا",
    shortName: "نمک دریا",
    description: "شیرینیِ کنترل‌شده، شکلات عمیق و چند کریستال نمک.",
    price: 195_000,
    className: "product-salt",
    image: smuleAsset("/images/smule-cookie-sea-salt.webp"),
    imageIsSample: true,
    imageFilter: "none",
    serving: "یک عدد · حدود ۱۱۲ گرم",
    nutrition: { calories: 451, protein: 6, carbohydrates: 53, fat: 23, sugar: 26 },
    ingredients: ["آرد گندم", "کره", "شکر قهوه‌ای", "شکلات تلخ", "نمک دریا"],
    notIncluded: ["گردو", "کارامل"],
    allergens: ["گلوتن (آرد گندم)", "لبنیات (کره)"],
    isSample: true,
  },
  {
    category: "کوکی",
    slug: "cinnamon-caramel",
    number: "۰۳",
    name: "دارچین کارامل",
    shortName: "دارچین کارامل",
    description: "عطر دارچین تازه با تکه‌های کارامل ترد و کش‌دار.",
    price: 190_000,
    className: "product-caramel",
    image: smuleAsset("/images/smule-cookie-cinnamon-caramel.webp"),
    imageIsSample: true,
    imageFilter: "none",
    serving: "یک عدد · حدود ۱۱۰ گرم",
    nutrition: { calories: 428, protein: 5, carbohydrates: 56, fat: 20, sugar: 30 },
    ingredients: ["آرد گندم", "کره", "شکر قهوه‌ای", "دارچین", "تکه‌های کارامل"],
    notIncluded: ["گردو", "شکلات تلخ"],
    allergens: ["گلوتن (آرد گندم)", "لبنیات (کره)"],
    isSample: true,
  },
  {
    category: "کوکی",
    slug: "mini-box",
    number: "۰۴",
    name: "پک مینی اسموله",
    shortName: "پک مینی اسموله",
    description: "چهار طعم کوچک برای وقتی که انتخاب‌کردن سخت است.",
    price: 345_000,
    className: "product-mini",
    image: smuleAsset("/images/smule-cookie-mini-box.webp"),
    imageIsSample: true,
    imageFilter: "none",
    serving: "یک پک چهارعددی · حدود ۱۸۰ گرم",
    nutrition: { calories: 748, protein: 10, carbohydrates: 96, fat: 34, sugar: 44 },
    ingredients: ["آرد گندم", "کره", "شکر قهوه‌ای", "شکلات", "گردو", "کارامل"],
    notIncluded: ["—"],
    allergens: ["گلوتن (آرد گندم)", "لبنیات (کره)", "مغزها (گردو)"],
    isSample: true,
  },
];

export function getSmuleProduct(slug: string, products: SmuleProduct[] = SMULE_PRODUCTS) {
  return products.find((product) => product.slug === slug);
}

export function isProductOrderable(product: SmuleProduct | undefined, ordersEnabled: boolean) {
  return Boolean(
    ordersEnabled
      && product
      && !product.isSample
      && Number.isFinite(product.price)
      && product.price > 0,
  );
}

export function formatPersianNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function formatToman(value: number) {
  return `${formatPersianNumber(value)} تومان`;
}

export function formatProductPrice(product: Pick<SmuleProduct, "price" | "isSample">) {
  if (product.isSample || !Number.isFinite(product.price) || product.price <= 0) {
    return "قیمت هنوز تأیید نشده";
  }
  return formatToman(product.price);
}

export function getProductDetailLabels(product: Pick<SmuleProduct, "isSample" | "imageIsSample">) {
  return {
    imageBadge: product.imageIsSample ?? Boolean(product.isSample) ? "نمای نمونه" : "تصویر ثبت‌شدهٔ محصول",
    notIncludedHeading: product.isSample ? "در دستور نمونه نیست" : "در دستور ثبت‌شده نیست",
    allergenGuidance: product.isSample
      ? "ترکیبات و هشدار حساسیت باید پیش از فروش با دستور واقعی آشپزخانه تطبیق داده شوند."
      : "این اطلاعات از داده‌های ثبت‌شدهٔ همین محصول در ERPNext آمده است؛ برای حساسیت جدی پیش از خرید تأیید نهایی بگیر.",
  };
}

export function toDisplayTomans(value: number, currency: string | null | undefined) {
  return currency === "IRR" ? Math.round(value / 10) : value;
}
