"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation keeps the preview routes stable. */

import { ArrowLeft, Check, ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { DOUGHS } from "@/lib/smule/cookie-builder";
import { sendOrderRequest } from "@/lib/smule/frappe-client";
import { buildLocalOrderDraft, getReadySubtotal } from "@/lib/smule/order-draft";
import { ORDER_DRAFTS_STORAGE_KEY, readOrderDrafts } from "@/lib/smule/orders";
import { formatPersianNumber, formatToman, getSmuleProduct, toDisplayTomans } from "@/lib/smule/products";
import styles from "./CheckoutPage.module.css";

type CheckoutField = "name" | "phone" | "city" | "address";
type CheckoutErrors = Partial<Record<CheckoutField, string>>;

function normalizePhoneNumber(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
}

export function CheckoutPage() {
  const { items, ready, clearCart } = useCookieCart();
  const { products, connected, loading, ordersEnabled, deliveryEnabled, pickupAddress, pickupHours, currency } = useStorefrontData();
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", city: "", address: "", note: "" });
  const canPickup = Boolean(pickupAddress);
  const canDeliver = deliveryEnabled;
  const deliveryMethodAvailable = deliveryMethod === "pickup" ? canPickup : canDeliver;
  const readySubtotal = getReadySubtotal(items, products);

  useEffect(() => {
    if (connected && !canPickup && canDeliver) setDeliveryMethod("delivery");
  }, [connected, canPickup, canDeliver]);

  function updateCustomer(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    if (field !== "note" && fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function validateCustomer() {
    const errors: CheckoutErrors = {};
    if (customer.name.trim().length < 2) errors.name = "نام را با دست‌کم دو نویسه وارد کن.";
    const phoneDigits = normalizePhoneNumber(customer.phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = "شمارهٔ تماس را با ۱۰ تا ۱۵ رقم وارد کن.";
    if (deliveryMethod === "delivery" && customer.city.trim().length < 2) errors.city = "نام شهر را وارد کن.";
    if (deliveryMethod === "delivery" && customer.address.trim().length < 8) errors.address = "نشانی کامل را وارد کن (حداقل ۸ نویسه).";
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(errors) as CheckoutField[])[0];
    if (firstInvalid) {
      document.getElementById(`checkout-${firstInvalid}`)?.focus();
      return false;
    }
    return true;
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || submitting || !validateCustomer()) return;
    if (!connected || !ordersEnabled || !deliveryMethodAvailable) {
      setMessage("ثبت سفارش هنوز از طرف فروشگاه فعال نشده است. می‌توانی سبدت را نگه داری و بعداً دوباره تلاش کنی.");
      return;
    }
    setSubmitting(true);
    setMessage("");

    const order = buildLocalOrderDraft({ items, customer, deliveryMethod, products });
    if (!order) {
      setMessage("یکی از اقلام سبد دیگر در منو در دسترس نیست. سبد خرید را بررسی و دوباره تلاش کن.");
      setSubmitting(false);
      return;
    }

    let result: Awaited<ReturnType<typeof sendOrderRequest>>;
    try {
      result = await sendOrderRequest({
        website: "",
        customer: {
          name: customer.name.trim(),
          phone: normalizePhoneNumber(customer.phone),
          city: customer.city.trim(),
          address: customer.address.trim(),
          note: customer.note.trim(),
        },
        deliveryMethod,
        items: items.map((item) => item.kind === "product"
          ? { kind: "product", productSlug: item.productSlug, quantity: item.quantity }
          : { kind: "custom", doughId: item.doughId, sizeGrams: item.sizeGrams, toppingIds: item.toppingIds, quantity: item.quantity }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "درخواست به ERPNext ثبت نشد. سبد خریدت حفظ شده؛ دوباره تلاش کن.");
      setSubmitting(false);
      return;
    }

    order.id = result.name;
    order.erpRequestName = result.name;
    order.status = "sent-to-frappe";
    order.readySubtotal = toDisplayTomans(result.readySubtotal, result.currency ?? currency);
    const drafts = readOrderDrafts();
    try {
      localStorage.setItem(ORDER_DRAFTS_STORAGE_KEY, JSON.stringify([order, ...drafts]));
      clearCart();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The site uses full document navigation for its static Frappe export.
      window.location.assign(`/orders/view/?id=${encodeURIComponent(order.id)}`);
    } catch {
      setSubmittedOrderId(result.name);
      setMessage("");
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        <main id="main-content">
          <nav className={styles.steps} aria-label="مراحل خرید">
            <a href="/cart"><span><Check size={14} aria-hidden="true" /></span> سبد</a>
            <i aria-hidden="true" />
            <span className={styles.currentStep}><span>۲</span> اطلاعات تحویل</span>
            <i aria-hidden="true" />
            <span className={styles.futureStep}><span>۳</span> بررسی درخواست</span>
          </nav>
          <div className={styles.heading}>
            <p className={styles.eyebrow}><MapPin size={16} aria-hidden="true" /> پیش از هماهنگی تحویل</p>
            <h1>جزئیات را یک‌بار وارد کن.</h1>
            <p>درخواستت در ERPNext ثبت می‌شود؛ پرداخت آنلاین تا معرفی و راه‌اندازی درگاه انجام نمی‌شود.</p>
          </div>

          {!ready ? <div className={styles.empty}>سبد خرید در حال بارگذاری است…</div> : !items.length ? (
            <section className={styles.empty}>
              <ClipboardList size={26} aria-hidden="true" />
              {submittedOrderId ? <>
                <h2>درخواست در ERPNext ثبت شد</h2>
                <p>شمارهٔ پیگیری: <strong>{submittedOrderId}</strong>. نسخهٔ محلی جزئیات در مرورگر ذخیره نشد؛ این شماره را نگه دار.</p>
                <a href="/menu">بازگشت به منو <ArrowLeft size={16} aria-hidden="true" /></a>
              </> : <>
                <h2>چیزی برای بررسی نیست</h2>
                <p>اول یک طعم از منو انتخاب کن یا کوکی سفارشی‌ات را بساز.</p>
                <a href="/menu">رفتن به منو <ArrowLeft size={16} aria-hidden="true" /></a>
              </>}
            </section>
          ) : (
            <div className={styles.layout}>
              <form className={styles.formCard} onSubmit={createDraft} noValidate>
                <h2>روش دریافت سفارش</h2>
                <p className={styles.formIntro}>تحویل حضوری را انتخاب کن یا نشانی ارسال را وارد کن.</p>
                <fieldset className={styles.deliveryOptions}>
                  <legend className={styles.srOnly}>روش دریافت</legend>
                  <label className={`${styles.deliveryOption} ${deliveryMethod === "pickup" ? styles.deliveryOptionSelected : ""}`}>
                    <input type="radio" name="deliveryMethod" value="pickup" checked={deliveryMethod === "pickup"} disabled={!canPickup} onChange={() => {
                      setDeliveryMethod("pickup");
                      setFieldErrors((current) => ({ ...current, city: undefined, address: undefined }));
                    }} />
                    <span><strong>تحویل حضوری</strong><small>{canPickup ? `${pickupAddress}${pickupHours ? ` · ${pickupHours}` : ""}` : "نشانی تحویل هنوز در تنظیمات اسموله ثبت نشده"}</small></span>
                  </label>
                  <label className={`${styles.deliveryOption} ${deliveryMethod === "delivery" ? styles.deliveryOptionSelected : ""}`}>
                    <input type="radio" name="deliveryMethod" value="delivery" checked={deliveryMethod === "delivery"} disabled={!canDeliver} onChange={() => setDeliveryMethod("delivery")} />
                    <span><strong>ارسال</strong><small>{canDeliver ? "هزینه و محدوده پس از بررسی درخواست هماهنگ می‌شود" : "ارسال در تنظیمات اسموله فعال نشده"}</small></span>
                  </label>
                </fieldset>
                {Object.keys(fieldErrors).length > 0 && <div className={styles.errorSummary} role="alert">
                  <strong>چند مورد را بررسی کن:</strong>
                  <ul>{Object.values(fieldErrors).map((error) => error && <li key={error}>{error}</li>)}</ul>
                </div>}
                <div className={styles.fields}>
                  <label><span>نام و نام خانوادگی <b>*</b></span><input id="checkout-name" autoComplete="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined} value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} placeholder="نام گیرنده" />{fieldErrors.name && <small id="checkout-name-error" className={styles.fieldError}>{fieldErrors.name}</small>}</label>
                  <label><span>شمارهٔ تماس <b>*</b></span><input id="checkout-phone" autoComplete="tel" inputMode="tel" type="tel" required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined} value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} placeholder="۰۹۱۲…" />{fieldErrors.phone && <small id="checkout-phone-error" className={styles.fieldError}>{fieldErrors.phone}</small>}</label>
                  {deliveryMethod === "delivery" && <>
                    <label><span>شهر <b>*</b></span><input id="checkout-city" autoComplete="address-level2" required aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? "checkout-city-error" : undefined} value={customer.city} onChange={(event) => updateCustomer("city", event.target.value)} placeholder="نام شهر" />{fieldErrors.city && <small id="checkout-city-error" className={styles.fieldError}>{fieldErrors.city}</small>}</label>
                    <label className={styles.fullField}><span>نشانی کامل <b>*</b></span><textarea id="checkout-address" autoComplete="street-address" required aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "checkout-address-error" : undefined} rows={3} value={customer.address} onChange={(event) => updateCustomer("address", event.target.value)} placeholder="خیابان، کوچه، پلاک و واحد" />{fieldErrors.address && <small id="checkout-address-error" className={styles.fieldError}>{fieldErrors.address}</small>}</label>
                  </>}
                  {deliveryMethod === "pickup" && <p className={`${styles.fullField} ${styles.pickupNotice}`}>{pickupAddress ? `نشانی تحویل حضوری: ${pickupAddress}${pickupHours ? ` · ${pickupHours}` : ""}` : "تا وقتی نشانی تحویل در تنظیمات فروشگاه ثبت نشده باشد، امکان ثبت درخواست تحویل حضوری نیست."}</p>}
                  <label className={styles.fullField}><span>توضیح برای اسموله <small>اختیاری</small></span><textarea rows={2} value={customer.note} onChange={(event) => updateCustomer("note", event.target.value)} placeholder="زمان مناسب یا نکتهٔ دیگری هست؟" /></label>
                </div>
                <div className={styles.privacyNotice}><ShieldCheck size={19} aria-hidden="true" /><p>با ثبت درخواست، نام، شماره تماس و جزئیات سفارش برای پیگیری در ERPNext فروشگاه اسموله ذخیره می‌شود. پرداخت آنلاین انجام نمی‌شود و سفارش بعد از بررسی فروشگاه قطعی خواهد شد. <a href="/privacy">جزئیات حریم خصوصی</a> و <a href="/terms">شرایط استفاده</a> را بخوان.</p></div>
                {connected && !ordersEnabled && <p className={styles.pickupNotice} role="status">ثبت سفارش آنلاین هنوز فعال نشده است؛ مدیر فروشگاه باید کالاها، قیمت و روش دریافت را تکمیل کند.</p>}
                {message && <p className={styles.error} role="alert">{message}</p>}
                {submittedOrderId && <p role="status">درخواست {submittedOrderId} در ERPNext ثبت شد؛ شماره را برای پیگیری نگه دار.</p>}
                <button className={styles.submitButton} type="submit" disabled={submitting || Boolean(submittedOrderId) || loading || !connected || !ordersEnabled || !deliveryMethodAvailable}>{submitting ? "در حال ثبت در فروشگاه…" : "ثبت درخواست سفارش"}<ArrowLeft size={18} aria-hidden="true" /></button>
              </form>

              <aside className={styles.summary}>
                <h2>مرور سریع سبد</h2>
                {items.map((item) => {
                  if (item.kind === "product") {
                    const product = getSmuleProduct(item.productSlug, products);
                    return product ? <div className={styles.summaryLine} key={item.id}><span>{product.name} × {formatPersianNumber(item.quantity)}</span><strong>{formatToman(product.price * item.quantity)}</strong></div> : null;
                  }
                  const dough = DOUGHS.find((option) => option.id === item.doughId) ?? DOUGHS[0];
                  return <div className={styles.summaryLine} key={item.id}><span>{dough.name} · {formatPersianNumber(item.sizeGrams)} گرم × {formatPersianNumber(item.quantity)}</span><strong>قیمت پس از بررسی</strong></div>;
                })}
                <div className={styles.total}><span>جمعِ قیمت‌های مشخص</span><strong>{formatToman(readySubtotal)}</strong></div>
                <p>روش دریافت: {deliveryMethod === "pickup" ? "تحویل حضوری" : "ارسال"}. هزینهٔ ارسال، قیمت کوکی سفارشی و پرداخت هنوز تنظیم نشده است.</p>
                <a href="/cart">ویرایش سبد خرید</a>
                <a className={styles.deliveryLink} href="/pickup">جزئیات روش‌های دریافت</a>
              </aside>
            </div>
          )}
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
