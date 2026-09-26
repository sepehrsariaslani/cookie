/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the broken Vinext Link client transition. */

import { ArrowLeft, Check, ChevronRight, Flame, Info } from "lucide-react";
import type { SmuleProduct } from "@/lib/smule/products";
import { formatPersianNumber, isProductOrderable } from "@/lib/smule/products";
import { CommerceHeader } from "./CommerceHeader";
import { CommerceFooter } from "./CommerceFooter";
import { ProductHero } from "./ProductHero";
import { AddProductButton } from "./AddProductButton";
import styles from "./ProductDetail.module.css";

const macroLabels = [
  ["protein", "پروتئین", "g"],
  ["carbohydrates", "کربوهیدرات", "g"],
  ["fat", "چربی", "g"],
  ["sugar", "قند", "g"],
] as const;

export function ProductDetail({ product, ordersEnabled = false }: { product: SmuleProduct; ordersEnabled?: boolean }) {
  const hasNutrition = Object.values(product.nutrition).some((value) => value > 0);
  const canOrder = isProductOrderable(product, ordersEnabled);
  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="menu" />
        <main id="main-content">
        <nav className={styles.breadcrumb} aria-label="مسیر صفحه">
          <a href="/">صفحهٔ اصلی</a><ChevronRight size={15} aria-hidden="true" />
          <a href="/menu">منوی کوکی‌ها</a><ChevronRight size={15} aria-hidden="true" />
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className={styles.productLayout}>
          <section className={styles.visualColumn} aria-label={`تصاویر ${product.name}`}>
            <figure className={styles.mainPhoto}>
              <span className={styles.photoBadge}>نمای نمونه</span>
              <img
                src={product.image}
                alt={`نمای کامل کوکی ${product.name}`}
                style={{ filter: product.imageFilter }}
                fetchPriority="high"
              />
            </figure>
            <figure className={styles.detailPhoto}>
              <img
                src={product.image}
                alt={`نمای نزدیک از بافت کوکی ${product.name}`}
                style={{ filter: product.imageFilter }}
              />
              <figcaption>نمای نزدیک از بافت کوکی</figcaption>
            </figure>
            <div className={styles.photoCaption}>
              <span className={styles.captionMark} aria-hidden="true"><Check size={15} /></span>
              <span>تصویر محصول برای نمایش بافت و ظاهر کوکی است.</span>
            </div>
          </section>

          <section className={styles.information} aria-labelledby="product-title">
            <ProductHero product={product} />

            {hasNutrition ? <section className={styles.nutrition} aria-labelledby="nutrition-title">
              <div className={styles.nutritionHeading}>
                <span className={styles.flame}><Flame size={19} aria-hidden="true" /></span>
                <div>
                  <h2 id="nutrition-title">ارزش غذاییِ تقریبی</h2>
                  <p>برای {product.serving}</p>
                </div>
                <strong className={styles.calories}>
                  {formatPersianNumber(product.nutrition.calories)}
                  <small>کیلوکالری</small>
                </strong>
              </div>
              <dl className={styles.macros}>
                {macroLabels.map(([key, label, unit]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{formatPersianNumber(product.nutrition[key])}<small>{unit}</small></dd>
                  </div>
                ))}
              </dl>
              <p className={styles.nutritionNote}>
                <Info size={15} aria-hidden="true" />
                {product.isSample ? "این اعداد نمونه‌اند و دستور و ارزش غذایی باید با آشپزخانه تطبیق داده شوند." : "ارزش غذایی بر اساس اطلاعات ثبت‌شدهٔ همین کالا در ERPNext است."}
              </p>
            </section> : <p className={styles.nutritionNote} role="status"><Info size={15} aria-hidden="true" />ارزش غذایی تأییدشدهٔ این محصول هنوز در ERPNext ثبت نشده است.</p>}

            <div className={styles.ingredientColumns}>
              <section aria-labelledby="included-title">
                <h2 id="included-title">ترکیبات</h2>
                <ul className={styles.ingredientList}>
                  {product.ingredients.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
                </ul>
              </section>
              <section aria-labelledby="not-included-title">
                <h2 id="not-included-title">در دستور نمونه نیست</h2>
                <ul className={styles.omittedList}>
                  {product.notIncluded.map((ingredient) => <li key={ingredient}>{ingredient}</li>)}
                </ul>
              </section>
            </div>

            <section className={styles.allergenNote} aria-labelledby="allergen-title">
              <h2 id="allergen-title">مواد حساسیت‌زا</h2>
              <p>{product.allergens.join("، ")}</p>
              <small>ترکیبات و هشدار حساسیت باید پیش از فروش با دستور واقعی آشپزخانه تطبیق داده شوند.</small>
            </section>

            <div className={styles.actions}>
              <AddProductButton product={product} />
              {canOrder && <a className={styles.primaryButton} href="/cart">رفتن به سبد <ArrowLeft size={18} aria-hidden="true" /></a>}
              <a className={styles.secondaryButton} href="/build-cookie">
                ترکیب خودم را بساز
              </a>
            </div>
          </section>
        </div>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
