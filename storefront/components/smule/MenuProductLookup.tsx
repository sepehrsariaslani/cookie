"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors keep full-page storefront routes stable. */

import { useSyncExternalStore } from "react";
import { NotFoundPage } from "@/components/smule/NotFoundPage";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { getSmuleProduct, type SmuleProduct } from "@/lib/smule/products";
import { ProductDetail } from "@/components/smule/ProductDetail";
import styles from "./MenuProductLookup.module.css";

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

function getProductSlug() {
  const querySlug = new URLSearchParams(window.location.search).get("slug");
  const pathSlug = window.location.pathname.split("/").filter(Boolean).at(-1);
  return querySlug || pathSlug || "";
}

export function MenuProductLookup() {
  const { products, loading, connected, ordersEnabled, error } = useStorefrontData();
  const slug = useSyncExternalStore(subscribeToLocation, getProductSlug, () => "");

  const product: SmuleProduct | undefined = getSmuleProduct(slug, products);

  if (product) return <ProductDetail product={product} ordersEnabled={ordersEnabled} />;
  if (loading || !slug) return <div className={styles.loading} role="status">در حال دریافت جزئیات از منوی اسموله…</div>;
  if (!connected) return <div className={styles.loading} role="alert">{error || "فهرست فروشگاه در دسترس نیست."} <a href="/menu">بازگشت به منو</a></div>;
  return <NotFoundPage />;
}
