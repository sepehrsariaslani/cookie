"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid unreliable Vinext client transitions. */

import { ArrowLeft, Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { smuleAsset } from "@/lib/smule/assets";
import { getReadySubtotal, isCheckoutAvailable } from "@/lib/smule/order-draft";
import { CommerceFooter } from "./CommerceFooter";
import { CommerceHeader } from "./CommerceHeader";
import { calculateCookiePrice, DOUGHS, getToppingCapacity, getToppingName, MAX_TOPPING_COUNT } from "@/lib/smule/cookie-builder";
import { formatPersianNumber, formatToman, getSmuleProduct, toDisplayTomans } from "@/lib/smule/products";
import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES } from "@/lib/smule/cart-limits";
import styles from "./CartPage.module.css";

export function CartPage() {
  const { items, ready, itemCount, setQuantity, removeCookie } = useCookieCart();
  const { products, components, connected, ordersEnabled, currency, pricingMarkupPercent, customCookieFixedCost, priceRoundingIncrement } = useStorefrontData();
  const productItems = items.filter((item) => item.kind === "product");
  const customItems = items.filter((item) => item.kind === "custom");
  const readySubtotal = getReadySubtotal(items, products);
  const customPrices = new Map(customItems.map((item) => [
    item.id,
    calculateCookiePrice(item.doughId, item.toppingIds, item.sizeGrams, components, currency, pricingMarkupPercent, customCookieFixedCost, priceRoundingIncrement),
  ]));
  const unpricedCustomCount = [...customPrices.values()].filter((price) => price === null).length;
  const customSubtotal = unpricedCustomCount
    ? null
    : customItems.reduce((total, item) => {
      const unitPrice = customPrices.get(item.id);
      return total + (unitPrice === null || unitPrice === undefined ? 0 : Math.round(toDisplayTomans(unitPrice, currency)) * item.quantity);
    }, 0);
  const pricedSubtotal = (readySubtotal ?? 0) + (customSubtotal ?? 0);
  const allItemsPriced = readySubtotal !== null && customSubtotal !== null;
  const cartWithinServerLimits = items.length <= MAX_CART_LINES && items.every((item) => item.quantity <= MAX_CART_LINE_QUANTITY);
  const checkoutAvailable = cartWithinServerLimits && isCheckoutAvailable({ itemCount, allItemsPriced, ordersEnabled });
  const checkoutStatus = !connected
    ? "اتصال فروشگاه در دسترس نیست؛ پس از برقراری دوباره، قیمت‌ها را تازه‌سازی کن."
    : !ordersEnabled
      ? "پذیرش سفارش آنلاین هنوز در تنظیمات فروشگاه فعال نشده؛ سبدت را نگه دار تا آماده شود."
      : !cartWithinServerLimits
        ? `هر سبد حداکثر ${MAX_CART_LINES} ترکیب و هر ترکیب حداکثر ${MAX_CART_LINE_QUANTITY} عدد می‌پذیرد؛ چند قلم را حذف یا کم کن.`
        : !allItemsPriced
        ? "قیمت فروش یک یا چند قلم در ERPNext تأیید نشده؛ آن قلم‌ها را حذف کن یا پس از اصلاح کاتالوگ، صفحه را تازه کن."
        : "";
  const totalWeight = customItems.reduce((total, item) => total + item.nutrition.weight * item.quantity, 0);
  const totalCalories = customItems.reduce((total, item) => total + item.nutrition.calories * item.quantity, 0);

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        <main id="main-content">
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}><ShoppingBasket size={16} aria-hidden="true" /> سبد خرید اسموله</p>
              <h1>انتخاب‌هایت اینجاست.</h1>
              <p>طعم‌های آماده و ترکیب‌های اختصاصی را کنار هم مرور کن.</p>
            </div>
            <a href="/menu" className={styles.backLink}>بازگشت به منو <ArrowLeft size={16} aria-hidden="true" /></a>
          </div>

          {!ready ? (
            <div className={styles.emptyState} aria-busy="true">سبد را آماده می‌کنیم…</div>
          ) : items.length === 0 ? (
            <section className={styles.emptyState}>
              <span className={styles.emptyIcon}><ShoppingBasket size={25} aria-hidden="true" /></span>
              <h2>سبدت هنوز خالی است</h2>
              <p>از منو کوکی آماده بردار یا کوکی مخصوص خودت را بساز؛ هر دو در همین سبد جمع می‌شوند.</p>
              <div className={styles.emptyActions}>
                <Button asChild className={styles.primaryButton}><a href="/menu">دیدن منو</a></Button>
                <Button asChild variant="outline" className={styles.secondaryButton}><a href="/build-cookie">ساخت کوکی دلخواه</a></Button>
              </div>
            </section>
          ) : (
            <div className={styles.cartLayout}>
              <section className={styles.lines} aria-label="محصولات انتخاب‌شده">
                {items.map((item) => {
                  if (item.kind === "product") {
                    const product = getSmuleProduct(item.productSlug, products);
                    if (!product || product.isSample || !Number.isFinite(product.price) || product.price <= 0) return (
                      <article className={`${styles.line} ${styles.lineUnpriced}`} key={item.id}>
                        <div className={styles.lineDetails}>
                          <div className={styles.lineTitleRow}>
                            <div>
                              <h2>{product ? `${product.name} · قیمت فروش تأیید نشده` : "محصول دیگر در منوی فروش نیست"}</h2>
                              <p>قیمت یا دستور واقعی این کالا در ERPNext آماده نیست. سبدت را نگه دار تا پس از تأیید فروشگاه دوباره بررسی کنی، یا اگر نمی‌خواهی حذفش کن.</p>
                            </div>
                            <Button className={styles.removeButton} variant="ghost" size="icon" onClick={() => removeCookie(item.id)} aria-label={`حذف ${product?.name ?? "محصول ناموجود"} از سبد`}><Trash2 size={18} aria-hidden="true" /></Button>
                          </div>
                        </div>
                      </article>
                    );
                    return (
                      <article className={styles.line} key={item.id}>
                        <a className={styles.cookieMark} href={`/menu/product?slug=${encodeURIComponent(product.slug)}`} aria-label={`جزئیات ${product.name}`}>
                          <img src={product.image} alt="" style={{ filter: product.imageFilter }} />
                        </a>
                        <div className={styles.lineDetails}>
                          <div className={styles.lineTitleRow}>
                            <div><span className={styles.lineEyebrow}>کوکی آماده · {product.serving}</span><h2>{product.name}</h2></div>
                            <Button className={styles.removeButton} variant="ghost" size="icon" onClick={() => removeCookie(item.id)} aria-label={`حذف ${product.name} از سبد`}><Trash2 size={18} aria-hidden="true" /></Button>
                          </div>
                          <p className={styles.ingredients}><strong>ترکیبات:</strong> {product.ingredients.join("، ")}</p>
                          <div className={styles.lineMeta}>
                            <strong className={styles.linePrice}>{formatToman(product.price * item.quantity)}</strong>
                            <div className={styles.quantity} aria-label={`تعداد ${product.name}`}>
                              <button type="button" disabled={item.quantity <= 1} onClick={() => setQuantity(item.id, item.quantity - 1)} aria-label="کم‌کردن تعداد"><Minus size={15} aria-hidden="true" /></button>
                              <strong aria-live="polite">{formatPersianNumber(item.quantity)}</strong>
                              <button type="button" disabled={item.quantity >= MAX_CART_LINE_QUANTITY} onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label={item.quantity >= MAX_CART_LINE_QUANTITY ? `حداکثر ${MAX_CART_LINE_QUANTITY} عدد از ${product.name}` : "زیادکردن تعداد"}><Plus size={15} aria-hidden="true" /></button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }

                  const dough = DOUGHS.find((option) => option.id === item.doughId) ?? DOUGHS[0];
                  const names = item.toppingIds.map(getToppingName);
                  const overCapacity = item.toppingIds.length > MAX_TOPPING_COUNT || item.nutrition.toppingWeight > getToppingCapacity(item.sizeGrams);
                  const unitPrice = customPrices.get(item.id) ?? null;
                  return (
                    <article className={styles.line} key={item.id}>
                      <div className={styles.cookieMark} aria-hidden="true">
                        <img src={smuleAsset(item.doughId === "cocoa" ? "/images/smule-cookie-chocolate.png" : "/images/smule-cookie-marble-walnut.png")} alt="" />
                      </div>
                      <div className={styles.lineDetails}>
                        <div className={styles.lineTitleRow}>
                          <div><span className={styles.lineEyebrow}>کوکی سفارشی · بیس {formatPersianNumber(item.sizeGrams)} گرم · وزن نهایی حدود {formatPersianNumber(item.nutrition.weight)} گرم</span><h2>{dough.name}</h2></div>
                          <Button className={styles.removeButton} variant="ghost" size="icon" onClick={() => removeCookie(item.id)} aria-label="حذف این کوکی از سبد"><Trash2 size={18} aria-hidden="true" /></Button>
                        </div>
                        <p className={styles.weightBreakdown}>خمیر {formatPersianNumber(item.nutrition.doughWeight)} گرم + افزودنی‌ها {formatPersianNumber(item.nutrition.toppingWeight)} گرم</p>
                        {overCapacity && <p className={styles.capacityWarning}>این دستور از سقف فعلی سازنده بیشتر است؛ انتخاب ذخیره‌شده را نگه داشته‌ایم. ترکیب تازه را می‌توانی دوباره از سازنده تنظیم کنی.</p>}
                        <p className={styles.ingredients}><strong>ترکیب:</strong> {names.length ? names.join("، ") : "بدون تاپینگ"}</p>
                        <div className={styles.lineMeta}>
                          <span>{unitPrice === null ? "قیمت نهایی تا تنظیم نرخ مواد مشخص نیست" : formatToman(Math.round(toDisplayTomans(unitPrice * item.quantity, currency)))} · حدود {formatPersianNumber(item.nutrition.calories)} کیلوکالری برای هر کوکی</span>
                          <div className={styles.quantity} aria-label="تعداد کوکی از این ترکیب">
                            <button type="button" disabled={item.quantity <= 1} onClick={() => setQuantity(item.id, item.quantity - 1)} aria-label="کم‌کردن تعداد"><Minus size={15} aria-hidden="true" /></button>
                            <strong aria-live="polite">{formatPersianNumber(item.quantity)}</strong>
                            <button type="button" disabled={item.quantity >= MAX_CART_LINE_QUANTITY} onClick={() => setQuantity(item.id, item.quantity + 1)} aria-label={item.quantity >= MAX_CART_LINE_QUANTITY ? `حداکثر ${MAX_CART_LINE_QUANTITY} عدد از این کوکی` : "زیادکردن تعداد"}><Plus size={15} aria-hidden="true" /></button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>

              <aside className={styles.summary} aria-label="خلاصهٔ سبد">
                <h2>خلاصهٔ خرید</h2>
                <dl>
                  <div><dt>تعداد کل</dt><dd>{formatPersianNumber(itemCount)} عدد</dd></div>
                  {productItems.length > 0 && <div><dt>کوکی‌های آماده</dt><dd>{readySubtotal === null ? "قیمت تأیید نشده" : formatToman(readySubtotal)}</dd></div>}
                  {customItems.length > 0 && <div><dt>کوکی‌های سفارشی</dt><dd>{customSubtotal === null ? "قیمت تأیید نشده" : formatToman(customSubtotal)}</dd></div>}
                  {allItemsPriced && <div><dt>جمع اقلام</dt><dd>{formatToman(pricedSubtotal)}</dd></div>}
                  {totalWeight > 0 && <div><dt>وزن سفارشی تقریبی</dt><dd>{formatPersianNumber(totalWeight)} گرم</dd></div>}
                  {totalCalories > 0 && <div><dt>کالری سفارشی تقریبی</dt><dd>{formatPersianNumber(totalCalories)} kcal</dd></div>}
                </dl>
                <p className={styles.priceNotice}>{!connected
                  ? "اتصال ERPNext در دسترس نیست؛ قیمت‌های نمایشی صرفاً نمونه‌اند و سفارش ثبت نمی‌شود."
                  : !allItemsPriced
                    ? customItems.length
                      ? "برای قیمت زنده، بهای خرید هر گرم خمیر و افزودنی‌های انتخابی و تنظیم قانون قیمت‌گذاری باید در ERPNext کامل باشد."
                      : "قیمت واقعی این محصول و BOM تأییدشده هنوز در کاتالوگ فروشگاه موجود نیست."
                    : customItems.length
                      ? "قیمت سفارشی از بهای مواد و هزینهٔ ثابت، با درصد افزوده و گردکردن رو به بالا محاسبه می‌شود؛ هزینهٔ پیک جداست."
                      : "قیمت کوکی آماده بر اساس بهای BOM تأییدشده، درصد افزوده و گام گردکردن ERPNext محاسبه می‌شود."}</p>
                {checkoutAvailable
                  ? <a className={styles.continueButton} href="/checkout">ادامه و ثبت اطلاعات <ArrowLeft size={17} aria-hidden="true" /></a>
                  : <button className={styles.continueButton} type="button" disabled aria-describedby="cart-checkout-status">ثبت سفارش فعلاً در دسترس نیست</button>}
                {checkoutStatus && <p id="cart-checkout-status" className={styles.checkoutStatus} role="status">{checkoutStatus}</p>}
                <a className={styles.buildMoreLink} href="/build-cookie">یا ساخت یک کوکی دلخواه</a>
                <p className={styles.localNotice}>سبد روی همین مرورگر می‌ماند. اطلاعات سفارش و ارسال در مرحلهٔ بعد مرور می‌شود.</p>
              </aside>
            </div>
          )}
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
