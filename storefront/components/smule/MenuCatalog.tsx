"use client";

import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { AddProductButton } from "@/components/smule/AddProductButton";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { formatProductPrice } from "@/lib/smule/products";
import styles from "./MenuCatalog.module.css";

export function MenuCatalog() {
  const { products, connected, loading, error } = useStorefrontData();
  const [query, setQuery] = useState("");
  const categories = useMemo(() => ["همهٔ طعم‌ها", ...new Set(products.map((product) => product.category))], [products]);
  const [category, setCategory] = useState("همهٔ طعم‌ها");
  const shownProducts = products.filter((product) => {
    const matchesCategory = category === "همهٔ طعم‌ها" || product.category === category;
    const text = `${product.name} ${product.description} ${product.ingredients.join(" ")}`.toLocaleLowerCase("fa");
    return matchesCategory && text.includes(query.trim().toLocaleLowerCase("fa"));
  });

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="menu" />
        <main id="main-content">
          <div className={styles.intro}>
            <p className={styles.eyebrow}><span /> منوی اسموله</p>
            <h1>یک طعم برای <em>همین امروز.</em></h1>
            <p>ترکیبات و جزئیات هر کوکی را ببین، یا مستقیم به سبد خریدت اضافه‌اش کن.</p>
          </div>

          <section className={styles.controls} aria-label="جست‌وجو و دسته‌بندی منو">
            <label className={styles.search}>
              <Search size={19} aria-hidden="true" />
              <span className={styles.srOnly}>جست‌وجوی طعم یا مادهٔ اولیه</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی طعم یا مادهٔ اولیه" />
            </label>
            <div className={styles.categories} aria-label="دسته‌بندی محصولات">
              <SlidersHorizontal size={17} aria-hidden="true" />
              {categories.map((item) => (
                <button type="button" className={category === item ? styles.selectedCategory : ""} key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>
                  {item}
                </button>
              ))}
            </div>
          </section>
          <p className={styles.dataNotice} role="status">{loading
            ? "در حال اتصال به فهرست فروشگاه…"
            : !connected
              ? error || "فهرست منو از ERPNext دریافت نشد."
              : products.length
                ? "کالا، قیمت و موجودی از ERPNext می‌آیند؛ اطلاعات تغذیه‌ای فقط در صورت ثبت برای هر کالا نمایش داده می‌شود."
                : "فهرست به ERPNext وصل است؛ هنوز کالایی برای نمایش در فروشگاه منتشر نشده است."}</p>

          {shownProducts.length ? (
            <section className={styles.grid} aria-label="محصولات منو">
              {shownProducts.map((product) => (
                <article className={styles.card} key={product.slug}>
                  <a className={styles.visual} href={`/menu/product?slug=${encodeURIComponent(product.slug)}`} aria-label={`دیدن جزئیات ${product.name}`}>
                    <span className={styles.tag}>{product.isSample ? "نمونهٔ نمایشی" : "طعم اسموله"}</span>
                    <img src={product.image} alt={`کوکی ${product.name}`} style={{ filter: product.imageFilter }} loading="lazy" />
                  </a>
                  <div className={styles.cardContent}>
                    <div className={styles.titleRow}><h2>{product.name}</h2><span>{product.serving}</span></div>
                    <p>{product.description}</p>
                    <div className={styles.meta}><strong>{formatProductPrice(product)}</strong><span>{product.allergens.length} هشدار حساسیت</span></div>
                    <div className={styles.actions}>
                      <a href={`/menu/product?slug=${encodeURIComponent(product.slug)}`} className={styles.details}>جزئیات و ترکیبات <ArrowLeft size={15} aria-hidden="true" /></a>
                      <AddProductButton product={product} />
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className={styles.empty}>
              <h2>{loading ? "در حال بارگذاری منو" : !connected ? "دریافت منو ممکن نشد" : !products.length ? "منوی فروشگاه هنوز آماده نشده" : "این طعم را پیدا نکردیم"}</h2>
              <p>{loading
                ? "کالاهای منتشرشده و وضعیت انبار از ERPNext دریافت می‌شوند."
                : !connected
                  ? error || "اتصال به ERPNext را بررسی کن."
                  : !products.length
                    ? "برای نمایش محصول، آن را در ERPNext منتشر کن و قیمت و انبار فروش را تنظیم کن."
                    : "نام طعم یا یکی از مواد اولیه را کوتاه‌تر بنویس."}</p>
              {query && <button type="button" onClick={() => setQuery("")}>پاک‌کردن جست‌وجو</button>}
            </div>
          )}

          <aside className={styles.customBanner}>
            <div><span>دلت یک ترکیب متفاوت می‌خواهد؟</span><strong>کوکی خودت را بساز.</strong></div>
            <a href="/build-cookie">ساخت کوکی دلخواه <ArrowLeft size={17} aria-hidden="true" /></a>
          </aside>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
