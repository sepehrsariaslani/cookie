"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation keeps the preview routes stable. */

import { ArrowLeft, Check, ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { CheckoutScheduleFields, type DeliveryCoordinates } from "@/components/smule/checkout/CheckoutScheduleFields";
import { calculateCookiePrice, DOUGHS } from "@/lib/smule/cookie-builder";
import { fetchCustomerAccount, type SmuleAccountAddress } from "@/lib/smule/customer-account";
import { sendOrderRequest } from "@/lib/smule/frappe-client";
import { getReadySubtotal } from "@/lib/smule/order-draft";
import { formatPersianNumber, formatToman, getSmuleProduct, toDisplayTomans } from "@/lib/smule/products";
import styles from "./CheckoutPage.module.css";

type CheckoutField = "name" | "phone" | "city" | "address" | "requestedForDate";
type CheckoutErrors = Partial<Record<CheckoutField, string>>;

function normalizePhoneNumber(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/\D/g, "");
}

function normalizeDeliveryCity(value: string) {
  return value.normalize("NFKC").replace(/ك/g, "ک").replace(/[يى]/g, "ی").replace(/\s+/g, " ").trim();
}

export function CheckoutPage() {
  const { items, ready, clearCart } = useCookieCart();
  const { products, components, currency, connected, loading, ordersEnabled, deliveryEnabled, pickupAddress, pickupHours } = useStorefrontData();
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [submittedOrderId, setSubmittedOrderId] = useState("");
  const [submittedTrackingHref, setSubmittedTrackingHref] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", city: "کرج", address: "", note: "" });
  const [scheduled, setScheduled] = useState(false);
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [coordinates, setCoordinates] = useState<DeliveryCoordinates | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SmuleAccountAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const canPickup = Boolean(pickupAddress);
  const canDeliver = deliveryEnabled;
  const activeDeliveryMethod = !canPickup && canDeliver ? "delivery" : deliveryMethod;
  const deliveryMethodAvailable = activeDeliveryMethod === "pickup" ? canPickup : canDeliver;
  const readySubtotal = getReadySubtotal(items, products);
  const customPrices = new Map(items.flatMap((item) => item.kind === "custom"
    ? [[item.id, calculateCookiePrice(item.doughId, item.toppingIds, item.sizeGrams, components, currency)] as const]
    : []));
  const customSubtotal = items.reduce((total, item) => {
    if (item.kind !== "custom") return total;
    const unitPrice = customPrices.get(item.id);
    return total + (unitPrice === null || unitPrice === undefined ? 0 : Math.round(toDisplayTomans(unitPrice, currency)) * item.quantity);
  }, 0);
  const unpricedCustomCount = [...customPrices.values()].filter((price) => price === null).length;
  const allItemsPriced = unpricedCustomCount === 0 && items.every((item) => {
    if (item.kind === "custom") return customPrices.get(item.id) !== null;
    const product = getSmuleProduct(item.productSlug, products);
    return Boolean(product && !product.isSample && product.price > 0);
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerAccount(controller.signal)
      .then((account) => {
        if (!account.authenticated) return;
        const karajAddresses = (account.addresses ?? []).filter((address) => normalizeDeliveryCity(address.city) === "کرج");
        setSavedAddresses(karajAddresses);
        setCustomer((current) => ({
          ...current,
          name: current.name || account.profile?.fullName || "",
          phone: current.phone || account.profile?.phone || "",
        }));
        const preferred = karajAddresses.find((address) => address.is_primary_address) ?? karajAddresses[0];
        if (preferred) {
          setSelectedAddress(preferred.name);
          setCustomer((current) => ({
            ...current,
            city: current.city || preferred.city || "",
            address: current.address || [preferred.address_line1, preferred.address_line2].filter(Boolean).join("، "),
          }));
        }
      })
      .catch(() => {
        // Checkout remains usable with manual contact and address entry if the account API is unavailable.
      });
    return () => controller.abort();
  }, []);

  function updateCustomer(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    if (field !== "note" && fieldErrors[field]) {
      clearFieldErrors(field);
    }
  }

  function clearFieldErrors(...fields: CheckoutField[]) {
    setFieldErrors((current) => {
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  }

  function validateCustomer() {
    const errors: CheckoutErrors = {};
    if (customer.name.trim().length < 2) errors.name = "نام را با دست‌کم دو نویسه وارد کن.";
    const phoneDigits = normalizePhoneNumber(customer.phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = "شمارهٔ تماس را با ۱۰ تا ۱۵ رقم وارد کن.";
    if (activeDeliveryMethod === "delivery" && normalizeDeliveryCity(customer.city) !== "کرج") errors.city = "ارسال اسموله فعلاً فقط در کرج انجام می‌شود.";
    if (activeDeliveryMethod === "delivery" && customer.address.trim().length < 8) errors.address = "نشانی کامل را وارد کن (حداقل ۸ نویسه).";
    if (scheduled && !requestedDate) errors.requestedForDate = "برای ثبت زمان دلخواه، تاریخ را انتخاب کن.";
    setFieldErrors(errors);
    const firstInvalid = (["name", "phone", "city", "address", "requestedForDate"] as CheckoutField[]).find((field) => errors[field]);
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
    if (!allItemsPriced) {
      setMessage("قیمت همهٔ اقلام هنوز در ERPNext کامل و تأیید نشده است؛ نرخ مواد یا کالای ناموجود را بررسی کن.");
      return;
    }
    setSubmitting(true);
    setMessage("");

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
          latitude: activeDeliveryMethod === "delivery" ? coordinates?.latitude : undefined,
          longitude: activeDeliveryMethod === "delivery" ? coordinates?.longitude : undefined,
        },
        schedule: {
          date: scheduled ? requestedDate : "",
          time: scheduled ? requestedTime : "",
        },
        deliveryMethod: activeDeliveryMethod,
        items: items.map((item) => item.kind === "product"
          ? { kind: "product", productSlug: item.productSlug, quantity: item.quantity }
          : { kind: "custom", doughId: item.doughId, sizeGrams: item.sizeGrams, toppingIds: item.toppingIds, quantity: item.quantity }),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "درخواست به ERPNext ثبت نشد. سبد خریدت حفظ شده؛ دوباره تلاش کن.");
      setSubmitting(false);
      return;
    }

    const trackingHref = result.trackingToken
      ? `/orders/view/#${result.trackingToken}`
      : "/account?tab=orders&submitted=1";
    setSubmittedOrderId(result.name);
    setSubmittedTrackingHref(trackingHref);
    setMessage("");
    clearCart();
    window.location.assign(trackingHref);
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
                <p>شمارهٔ درخواست: <strong>{submittedOrderId}</strong>. اطلاعات شخصی سفارش در مرورگر ذخیره نمی‌شود.</p>
                {submittedTrackingHref && <a href={submittedTrackingHref}>{submittedTrackingHref.startsWith("/orders/") ? "پیگیری وضعیت درخواست" : "دیدن سفارش‌ها در حساب"} <ArrowLeft size={16} aria-hidden="true" /></a>}
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
                  <label className={`${styles.deliveryOption} ${activeDeliveryMethod === "pickup" ? styles.deliveryOptionSelected : ""}`}>
                    <input type="radio" name="deliveryMethod" value="pickup" checked={activeDeliveryMethod === "pickup"} disabled={!canPickup} onChange={() => {
                      setDeliveryMethod("pickup");
                      clearFieldErrors("city", "address");
                    }} />
                    <span><strong>تحویل حضوری</strong><small>{canPickup ? `${pickupAddress}${pickupHours ? ` · ${pickupHours}` : ""}` : "نشانی تحویل هنوز در تنظیمات اسموله ثبت نشده"}</small></span>
                  </label>
                  <label className={`${styles.deliveryOption} ${activeDeliveryMethod === "delivery" ? styles.deliveryOptionSelected : ""}`}>
                    <input type="radio" name="deliveryMethod" value="delivery" checked={activeDeliveryMethod === "delivery"} disabled={!canDeliver} onChange={() => setDeliveryMethod("delivery")} />
                    <span><strong>ارسال با اسنپ‌پیک</strong><small>{canDeliver ? "فقط در کرج · هزینه براساس نرخ پیک، پیش از تأیید نهایی اعلام می‌شود" : "ارسال در تنظیمات اسموله فعال نشده"}</small></span>
                  </label>
                </fieldset>
                {Object.keys(fieldErrors).length > 0 && <div className={styles.errorSummary} role="alert">
                  <strong>چند مورد را بررسی کن:</strong>
                  <ul>{Object.values(fieldErrors).map((error) => error && <li key={error}>{error}</li>)}</ul>
                </div>}
                <div className={styles.fields}>
                  <label><span>نام و نام خانوادگی <b>*</b></span><input id="checkout-name" autoComplete="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "checkout-name-error" : undefined} value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} placeholder="نام گیرنده" />{fieldErrors.name && <small id="checkout-name-error" className={styles.fieldError}>{fieldErrors.name}</small>}</label>
                  <label><span>شمارهٔ تماس <b>*</b></span><input id="checkout-phone" autoComplete="tel" inputMode="tel" type="tel" required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "checkout-phone-error" : undefined} value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} placeholder="۰۹۱۲…" />{fieldErrors.phone && <small id="checkout-phone-error" className={styles.fieldError}>{fieldErrors.phone}</small>}</label>
                  {activeDeliveryMethod === "delivery" && <>
                    {savedAddresses.length > 0 && <label className={styles.fullField}><span>نشانی ذخیره‌شده</span><select value={selectedAddress} onChange={(event) => {
                      const selected = savedAddresses.find((address) => address.name === event.target.value);
                      setSelectedAddress(event.target.value);
                      if (selected) setCustomer((current) => ({
                        ...current,
                        city: selected.city || "",
                        address: [selected.address_line1, selected.address_line2].filter(Boolean).join("، "),
                      }));
                      else setCustomer((current) => ({ ...current, city: "کرج", address: "" }));
                    }}>
                      <option value="">واردکردن نشانی دیگر</option>
                      {savedAddresses.map((address) => <option key={address.name} value={address.name}>{address.address_title || address.city} · {address.city}</option>)}
                    </select></label>}
                    <label><span>محدودهٔ ارسال</span><input id="checkout-city" autoComplete="address-level2" value="کرج" readOnly aria-describedby={fieldErrors.city ? "checkout-city-error" : undefined} />{fieldErrors.city && <small id="checkout-city-error" className={styles.fieldError}>{fieldErrors.city}</small>}</label>
                    <label className={styles.fullField}><span>نشانی کامل <b>*</b></span><textarea id="checkout-address" autoComplete="street-address" required aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "checkout-address-error" : undefined} rows={3} value={customer.address} onChange={(event) => updateCustomer("address", event.target.value)} placeholder="خیابان، کوچه، پلاک و واحد" />{fieldErrors.address && <small id="checkout-address-error" className={styles.fieldError}>{fieldErrors.address}</small>}</label>
                  </>}
                  {activeDeliveryMethod === "pickup" && <p className={`${styles.fullField} ${styles.pickupNotice}`}>{pickupAddress ? `نشانی تحویل حضوری: ${pickupAddress}${pickupHours ? ` · ${pickupHours}` : ""}` : "تا وقتی نشانی تحویل در تنظیمات فروشگاه ثبت نشده باشد، امکان ثبت درخواست تحویل حضوری نیست."}</p>}
                  <CheckoutScheduleFields
                    deliveryMethod={activeDeliveryMethod}
                    scheduled={scheduled}
                    requestedDate={requestedDate}
                    requestedTime={requestedTime}
                    coordinates={coordinates}
                    dateError={fieldErrors.requestedForDate}
                    onScheduledChange={(next) => {
                      setScheduled(next);
                      if (!next) {
                        setRequestedDate("");
                        setRequestedTime("");
                        clearFieldErrors("requestedForDate");
                      }
                    }}
                    onScheduleChange={(date, time) => {
                      setRequestedDate(date);
                      setRequestedTime(time);
                      clearFieldErrors("requestedForDate");
                    }}
                    onCoordinatesChange={setCoordinates}
                  />
                  <label className={styles.fullField}><span>توضیح برای اسموله <small>اختیاری</small></span><textarea rows={2} value={customer.note} onChange={(event) => updateCustomer("note", event.target.value)} placeholder="زمان مناسب یا نکتهٔ دیگری هست؟" /></label>
                </div>
                {savedAddresses.length === 0 && <p className={styles.pickupNotice}>برای استفاده از نشانی‌های ذخیره‌شده، <a href="/login?redirect-to=%2Fcheckout">وارد حساب شو</a> یا آن‌ها را در <a href="/account?tab=addresses">حساب کاربری</a> ثبت کن.</p>}
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
                    return product && !product.isSample ? <div className={styles.summaryLine} key={item.id}><span>{product.name} × {formatPersianNumber(item.quantity)}</span><strong>{formatToman(product.price * item.quantity)}</strong></div> : <div className={styles.summaryLine} key={item.id}><span>محصول بدون قیمت تأییدشده</span><strong>نامشخص</strong></div>;
                  }
                  const dough = DOUGHS.find((option) => option.id === item.doughId) ?? DOUGHS[0];
                  const unitPrice = customPrices.get(item.id);
                  const displayPrice = unitPrice === null || unitPrice === undefined ? null : Math.round(toDisplayTomans(unitPrice * item.quantity, currency));
                  return <div className={styles.summaryLine} key={item.id}><span>{dough.name} · {formatPersianNumber(item.sizeGrams)} گرم × {formatPersianNumber(item.quantity)}</span><strong>{displayPrice === null ? "نرخ مواد ناقص" : formatToman(displayPrice)}</strong></div>;
                })}
                <div className={styles.total}><span>{allItemsPriced ? "جمع اقلام" : "جمع اقلام قیمت‌دار"}</span><strong>{formatToman(readySubtotal + customSubtotal)}</strong></div>
                <p>روش دریافت: {activeDeliveryMethod === "pickup" ? "تحویل حضوری" : "اسنپ‌پیک در کرج"}. هزینهٔ پیک در جمع بالا نیست و پیش از تأیید سفارش اعلام می‌شود؛ پرداخت آنلاین هنوز فعال نشده است.</p>
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
