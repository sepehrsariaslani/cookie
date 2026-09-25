"use client";

import { useEffect, useState } from "react";
import { NotFoundPage } from "@/components/smule/NotFoundPage";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { getSmuleProduct, SMULE_PRODUCTS, type SmuleProduct } from "@/lib/smule/products";
import { ProductDetail } from "@/components/smule/ProductDetail";
import styles from "./MenuProductLookup.module.css";

export function MenuProductLookup() {
  const { products, loading, connected } = useStorefrontData();
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const querySlug = new URLSearchParams(window.location.search).get("slug");
    const pathSlug = window.location.pathname.split("/").filter(Boolean).at(-1);
    setSlug(querySlug || pathSlug || "");
  }, []);

  const product: SmuleProduct | undefined = getSmuleProduct(slug, products)
    ?? (!connected ? getSmuleProduct(slug, SMULE_PRODUCTS) : undefined);

  if (product) return <ProductDetail product={product} />;
  if (loading || !slug) return <div className={styles.loading} role="status">در حال دریافت جزئیات از منوی اسموله…</div>;
  return <NotFoundPage />;
}
