"use client";

/* eslint-disable react-hooks/set-state-in-effect -- The persisted browser cart is hydrated after SSR to avoid a hydration mismatch. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  calculateCookieNutrition,
  DOUGHS,
  MAX_COOKIE_GRAMS,
  MIN_COOKIE_GRAMS,
  TOPPINGS,
  type CookieNutrition,
  type DoughId,
  type ToppingId,
} from "@/lib/smule/cookie-builder";

const STORAGE_KEY = "smule-cookie-cart-v1";

export type CookieCartLine = {
  kind: "custom";
  id: string;
  configKey: string;
  doughId: DoughId;
  sizeGrams: number;
  toppingIds: ToppingId[];
  nutrition: CookieNutrition;
  quantity: number;
};

export type ProductCartLine = {
  kind: "product";
  id: string;
  configKey: string;
  productSlug: string;
  unitPrice: number;
  quantity: number;
};

export type CartLine = CookieCartLine | ProductCartLine;

type CartContextValue = {
  items: CartLine[];
  ready: boolean;
  itemCount: number;
  addCookie: (cookie: Omit<CookieCartLine, "kind" | "id" | "configKey" | "quantity">) => void;
  addProduct: (productSlug: string, unitPrice: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeCookie: (id: string) => void;
  clearCart: () => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const itemsRef = useRef<CartLine[]>([]);

  const commitItems = useCallback((update: (current: CartLine[]) => CartLine[]) => {
    const next = update(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch { /* The in-memory cart remains usable for this visit. */
      return false;
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const knownToppings = new Set(TOPPINGS.map(({ id }) => id));
          const restored = parsed.flatMap((entry): CartLine[] => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
            const savedKind = (entry as { kind?: unknown }).kind;
            if (savedKind === "product") {
              const productLine = entry as Partial<ProductCartLine>;
              if (typeof productLine.id !== "string" || typeof productLine.productSlug !== "string" || typeof productLine.unitPrice !== "number") return [];
              return [{
                kind: "product",
                id: productLine.id,
                configKey: `product:${productLine.productSlug}`,
                productSlug: productLine.productSlug,
                unitPrice: productLine.unitPrice,
                quantity: typeof productLine.quantity === "number" ? Math.max(1, Math.floor(productLine.quantity)) : 1,
              }];
            }
            const savedLine = entry as Partial<CookieCartLine>;
            if (typeof savedLine.id !== "string" || typeof savedLine.sizeGrams !== "number" || !Number.isFinite(savedLine.sizeGrams)) return [];
            const doughId = DOUGHS.some(({ id }) => id === savedLine.doughId) ? savedLine.doughId as DoughId : DOUGHS[0].id;
            const sizeGrams = Math.min(MAX_COOKIE_GRAMS, Math.max(MIN_COOKIE_GRAMS, Math.round(savedLine.sizeGrams / 5) * 5));
            const toppingIds = Array.isArray(savedLine.toppingIds)
              ? savedLine.toppingIds.filter((id): id is ToppingId => typeof id === "string" && knownToppings.has(id as ToppingId))
              : [];
            const quantity = typeof savedLine.quantity === "number" && Number.isFinite(savedLine.quantity)
              ? Math.max(1, Math.floor(savedLine.quantity))
              : 1;
            return [{
              ...savedLine,
              kind: "custom",
              id: savedLine.id,
              configKey: `${doughId}:${sizeGrams}:${[...toppingIds].sort().join(",")}`,
              doughId,
              sizeGrams,
              toppingIds,
              nutrition: calculateCookieNutrition(doughId, toppingIds, sizeGrams),
              quantity,
            }];
          });
          itemsRef.current = restored;
          setItems(restored);
        }
      }
    } catch {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be disabled by the browser. */ }
    } finally {
      setReady(true);
    }
  }, []);

  const addCookie = useCallback((cookie: Omit<CookieCartLine, "kind" | "id" | "configKey" | "quantity">) => {
    const configKey = `${cookie.doughId}:${cookie.sizeGrams}:${[...cookie.toppingIds].sort().join(",")}`;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    commitItems((current) => {
      const existing = current.find((item) => item.configKey === configKey);
      if (existing) return current.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...cookie, kind: "custom", id, configKey, quantity: 1 }];
    });
  }, [commitItems]);

  const addProduct = useCallback((productSlug: string, unitPrice: number) => {
    const configKey = `product:${productSlug}`;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    commitItems((current) => {
      const existing = current.find((item) => item.configKey === configKey);
      if (existing) return current.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { kind: "product", id, configKey, productSlug, unitPrice, quantity: 1 }];
    });
  }, [commitItems]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    commitItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.floor(quantity)) } : item));
  }, [commitItems]);

  const removeCookie = useCallback((id: string) => {
    commitItems((current) => current.filter((item) => item.id !== id));
  }, [commitItems]);

  const clearCart = useCallback(() => commitItems(() => []), [commitItems]);

  const value = useMemo(() => ({
    items,
    ready,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    addCookie,
    addProduct,
    setQuantity,
    removeCookie,
    clearCart,
  }), [items, ready, addCookie, addProduct, setQuantity, removeCookie, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCookieCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCookieCart must be used inside CartProvider");
  return value;
}
