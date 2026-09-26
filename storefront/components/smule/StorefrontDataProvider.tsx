"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { smuleAsset } from "@/lib/smule/assets";
import { fetchStorefrontCatalog, type FrappeStorefrontCatalog } from "@/lib/smule/frappe-client";
import { formatPersianNumber, SMULE_PRODUCTS, type SmuleProduct } from "@/lib/smule/products";

export type StorefrontComponent = {
  itemCode: string;
  id: string;
  slug: string;
  kind: string;
  name: string;
  description: string;
  ingredients: string[];
  group: string;
  gramsPer50: number;
  baseWeightGrams: number;
  nutrition: { calories: number; protein: number; carbohydrates: number; fat: number; sugar: number };
  allergens: string[];
  visualGroup: string;
  visualColor: string;
  isSample: boolean;
  costPerGram: number | null;
  costCurrency: string | null;
};

type StorefrontData = {
  products: SmuleProduct[];
  components: StorefrontComponent[];
  loading: boolean;
  connected: boolean;
  error: string;
  ordersEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFee: number;
  deliveryFeeCollection: string;
  pickupAddress: string;
  pickupHours: string;
  currency: string | null;
  pricingMarkupPercent: number | null;
  customCookieFixedCost: number | null;
  priceRoundingIncrement: number;
  customPricingReady: boolean;
};

const previewState: StorefrontData = {
  products: SMULE_PRODUCTS,
  components: [],
  loading: true,
  connected: false,
  error: "",
  ordersEnabled: false,
  deliveryEnabled: false,
  deliveryFee: 0,
  deliveryFeeCollection: "",
  pickupAddress: "",
  pickupHours: "",
  currency: null,
  pricingMarkupPercent: null,
  customCookieFixedCost: null,
  priceRoundingIncrement: 0,
  customPricingReady: false,
};

const StorefrontContext = createContext<StorefrontData>(previewState);

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapComponents(rows: FrappeStorefrontCatalog["components"]): StorefrontComponent[] {
  return rows.map((row) => {
    const nutrition = row.nutrition && typeof row.nutrition === "object" ? row.nutrition as Record<string, unknown> : {};
    return {
      itemCode: asString(row.itemCode),
      id: asString(row.id, asString(row.slug)),
      slug: asString(row.slug),
      kind: asString(row.kind),
      name: asString(row.name),
      description: asString(row.description),
      ingredients: asList(row.ingredients),
      group: asString(row.group),
      gramsPer50: asNumber(row.gramsPer50),
      baseWeightGrams: asNumber(row.baseWeightGrams),
      nutrition: {
        calories: asNumber(nutrition.calories),
        protein: asNumber(nutrition.protein),
        carbohydrates: asNumber(nutrition.carbohydrates),
        fat: asNumber(nutrition.fat),
        sugar: asNumber(nutrition.sugar),
      },
      allergens: asList(row.allergens),
      visualGroup: asString(row.visualGroup, "crumb"),
      visualColor: asString(row.visualColor, "#c98955"),
      isSample: Boolean(row.isSample),
      costPerGram: typeof row.costPerGram === "number" && Number.isFinite(row.costPerGram) && row.costPerGram > 0
        ? row.costPerGram
        : null,
      costCurrency: typeof row.costCurrency === "string" ? row.costCurrency : null,
    };
  });
}

function mapProducts(rows: FrappeStorefrontCatalog["products"], currency: string | null): SmuleProduct[] {
  return rows.map((row, index) => {
    const nutrition = row.nutrition && typeof row.nutrition === "object" ? row.nutrition as Record<string, unknown> : {};
    const itemPrice = asNumber(row.price);
    // ERPNext stores Iranian rial; the customer-facing Smule UI uses toman.
    const displayPrice = currency === "IRR" ? Math.round(itemPrice / 10) : itemPrice;
    const image = asString(row.image);
    return {
      category: asString(row.category, "کوکی"),
      slug: asString(row.slug),
      number: formatPersianNumber(index + 1).padStart(2, "۰"),
      name: asString(row.name),
      shortName: asString(row.shortName, asString(row.name)),
      description: asString(row.description),
      price: displayPrice,
      className: ["product-classic", "product-salt", "product-caramel", "product-mini"][index % 4],
      image: image ? smuleAsset(image) : smuleAsset("/images/smule-cookie.png"),
      imageIsSample: !image,
      imageFilter: "none",
      serving: asString(row.serving, "یک عدد"),
      nutrition: {
        calories: asNumber(nutrition.calories),
        protein: asNumber(nutrition.protein),
        carbohydrates: asNumber(nutrition.carbohydrates),
        fat: asNumber(nutrition.fat),
        sugar: asNumber(nutrition.sugar),
      },
      ingredients: asList(row.ingredients),
      notIncluded: asList(row.notIncluded),
      allergens: asList(row.allergens),
      isSample: Boolean(row.isSample),
    };
  });
}

export function StorefrontDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(previewState);

  useEffect(() => {
    const controller = new AbortController();
    fetchStorefrontCatalog(controller.signal).then((catalog) => {
      setData(mapCatalog(catalog));
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setData({ ...previewState, loading: false, error: error instanceof Error ? error.message : "فروشگاه در دسترس نیست." });
    });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => data, [data]);
  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

function mapCatalog(catalog: FrappeStorefrontCatalog): StorefrontData {
  const currency = typeof catalog.currency === "string" ? catalog.currency : null;
  const liveProducts = mapProducts(catalog.products, currency);
  return {
    // Keep the sample menu browsable until real Items and verified prices exist.
    // Every sample remains explicitly marked and cannot be added to an order.
    products: liveProducts.length ? liveProducts : SMULE_PRODUCTS,
    components: mapComponents(catalog.components),
    loading: false,
    connected: true,
    error: "",
    ordersEnabled: Boolean(catalog.ordersEnabled),
    deliveryEnabled: Boolean(catalog.deliveryEnabled),
    deliveryFee: asNumber(catalog.deliveryFee),
    deliveryFeeCollection: asString(catalog.deliveryFeeCollection),
    pickupAddress: asString(catalog.pickupAddress),
    pickupHours: asString(catalog.pickupHours),
    currency,
    pricingMarkupPercent: typeof catalog.pricingMarkupPercent === "number" && Number.isFinite(catalog.pricingMarkupPercent)
      ? catalog.pricingMarkupPercent
      : null,
    customCookieFixedCost: typeof catalog.customCookieFixedCost === "number" && Number.isFinite(catalog.customCookieFixedCost)
      ? catalog.customCookieFixedCost
      : null,
    priceRoundingIncrement: asNumber(catalog.priceRoundingIncrement),
    customPricingReady: Boolean(catalog.customPricingReady),
  };
}

export function useStorefrontData() {
  return useContext(StorefrontContext);
}
