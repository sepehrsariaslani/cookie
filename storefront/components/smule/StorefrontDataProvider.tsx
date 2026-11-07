"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { mapCatalogProducts } from "@/lib/smule/catalog";
import { fetchStorefrontCatalog, type FrappeStorefrontCatalog } from "@/lib/smule/frappe-client";
import type { SmuleProduct } from "@/lib/smule/products";

export type StorefrontComponent = {
  itemCode: string;
  image: string;
  stockUom: string;
  isStockItem: boolean;
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
  products: [],
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
      image: asString(row.image),
      stockUom: asString(row.stockUom),
      isStockItem: Boolean(row.isStockItem),
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
  return {
    products: mapCatalogProducts(catalog.products, currency),
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
