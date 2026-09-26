"use client";

import { useSyncExternalStore } from "react";
import { NotFoundPage } from "@/components/smule/NotFoundPage";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { getSmuleProduct, SMULE_PRODUCTS, type SmuleProduct } from "@/lib/smule/products";
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
  const { products, loading, connected, ordersEnabled } = useStorefrontData();
  const slug = useSyncExternalStore(subscribeToLocation, getProductSlug, () => "");

  const product: SmuleProduct | undefined = getSmuleProduct(slug, products)
    ?? (!connected ? getSmuleProduct(slug, SMULE_PRODUCTS) : undefined);

  if (product) return <ProductDetail product={product} ordersEnabled={ordersEnabled} />;
  if (loading || !slug) return <div className={styles.loading} role="status">در حال دریافت جزئیات از منوی اسموله…</div>;
  return <NotFoundPage />;
}
