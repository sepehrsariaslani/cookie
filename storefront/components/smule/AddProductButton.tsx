"use client";

import { Check, ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import type { SmuleProduct } from "@/lib/smule/products";
import { isProductOrderable } from "@/lib/smule/products";
import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES } from "@/lib/smule/cart-limits";
import styles from "./AddProductButton.module.css";

export function AddProductButton({ product, className }: { product: SmuleProduct; className?: string }) {
  const { addProduct, items, ready } = useCookieCart();
  const { ordersEnabled } = useStorefrontData();
  const [added, setAdded] = useState(false);
  const canOrder = isProductOrderable(product, ordersEnabled);
  const existingLine = items.find((item) => item.configKey === `product:${product.slug}`);
  const atQuantityLimit = (existingLine?.quantity ?? 0) >= MAX_CART_LINE_QUANTITY;
  const atLineLimit = !existingLine && items.length >= MAX_CART_LINES;
  const [message, setMessage] = useState("");
  const limitMessage = atQuantityLimit
    ? `از این ترکیب حداکثر ${MAX_CART_LINE_QUANTITY} عدد می‌توانی در سبد داشته باشی.`
    : atLineLimit
      ? `سبد حداکثر ${MAX_CART_LINES} ترکیب متفاوت می‌پذیرد؛ برای افزودن این محصول، یک قلم را حذف کن.`
      : "";
  const statusMessage = message || limitMessage;

  useEffect(() => {
    if (!added) return;
    const timeout = window.setTimeout(() => setAdded(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [added]);

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${className ?? ""}`.trim()}
        disabled={!ready || !canOrder || atQuantityLimit || atLineLimit}
        aria-describedby={statusMessage ? `add-product-status-${product.slug}` : undefined}
        onClick={() => {
          const result = addProduct(product.slug, product.price);
          if (result === "added") {
            setAdded(true);
            setMessage("");
          } else {
            setMessage(result === "quantity-limit"
              ? `از این ترکیب حداکثر ${MAX_CART_LINE_QUANTITY} عدد می‌توانی در سبد داشته باشی.`
              : `سبد حداکثر ${MAX_CART_LINES} ترکیب متفاوت می‌پذیرد؛ برای افزودن این محصول، یک قلم را حذف کن.`);
          }
        }}
        aria-live="polite"
      >
        {added ? <Check size={17} aria-hidden="true" /> : <ShoppingBasket size={17} aria-hidden="true" />}
        {!ready ? "در حال آماده‌سازی…" : product.isSample ? "نمونه · سفارش فعال نیست" : !canOrder ? "پذیرش سفارش فعلاً غیرفعال است" : atQuantityLimit ? `حداکثر ${MAX_CART_LINE_QUANTITY} عدد در سبد` : atLineLimit ? "ظرفیت ترکیب‌های سبد پر است" : added ? "به سبد اضافه شد" : "افزودن به سبد"}
      </button>
      {statusMessage && <span id={`add-product-status-${product.slug}`} className={styles.status} role="status">{statusMessage}</span>}
    </>
  );
}
