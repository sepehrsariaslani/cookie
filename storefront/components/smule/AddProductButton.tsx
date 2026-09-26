"use client";

import { Check, ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import type { SmuleProduct } from "@/lib/smule/products";
import { isProductOrderable } from "@/lib/smule/products";
import styles from "./AddProductButton.module.css";

export function AddProductButton({ product, className }: { product: SmuleProduct; className?: string }) {
  const { addProduct, ready } = useCookieCart();
  const { ordersEnabled } = useStorefrontData();
  const [added, setAdded] = useState(false);
  const canOrder = isProductOrderable(product, ordersEnabled);

  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [added]);

  return (
    <button
      type="button"
      className={`${styles.button} ${className ?? ""}`.trim()}
      disabled={!ready || !canOrder}
      onClick={() => {
        addProduct(product.slug, product.price);
        setAdded(true);
      }}
      aria-live="polite"
    >
      {added ? <Check size={17} aria-hidden="true" /> : <ShoppingBasket size={17} aria-hidden="true" />}
      {!ready ? "در حال آماده‌سازی…" : product.isSample ? "نمونه · سفارش فعال نیست" : !canOrder ? "پذیرش سفارش فعلاً غیرفعال است" : added ? "به سبد اضافه شد" : "افزودن به سبد"}
    </button>
  );
}
