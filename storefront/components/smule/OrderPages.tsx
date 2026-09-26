"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Local drafts are read after hydration to avoid a server/client storage mismatch. */

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation keeps the preview routes stable. */

import { ArrowLeft, Check, Clock3, ClipboardList, Cookie, MessageCircle, ShoppingBasket } from "lucide-react";
import { useEffect, useState } from "react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { formatPersianNumber, formatToman } from "@/lib/smule/products";
import { getWhatsAppHref, readOrderDrafts, type SmuleOrderDraft } from "@/lib/smule/orders";
import styles from "./OrderPages.module.css";

function useDraftOrders() {
  const [orders, setOrders] = useState<SmuleOrderDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setOrders(readOrderDrafts());
    setLoaded(true);
  }, []);
  return { orders, loaded };
}

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const { orders, loaded } = useDraftOrders();
  const order = orders.find((item) => item.id === orderId);
  const whatsappHref = order ? getWhatsAppHref(order) : null;

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        {!loaded ? <div className={styles.loading}>پیش‌نویس را پیدا می‌کنیم…</div> : !order ? (
          <section className={styles.notFound}>
            <ClipboardList size={30} aria-hidden="true" />
            <h1>این پیش‌نویس در این مرورگر پیدا نشد</h1>
            <p>پیش‌نویس‌های این سایت فقط روی دستگاهی در دسترس‌اند که آن‌ها را ساخته است.</p>
            <a href="/my-orders">دیدن فهرست پیش‌نویس‌ها <ArrowLeft size={16} aria-hidden="true" /></a>
          </section>
        ) : (
          <main id="main-content" className={styles.main}>
            <div className={styles.statusIcon}><Check size={27} aria-hidden="true" /></div>
            <p className={styles.kicker}>{order.status === "sent-to-frappe" ? "درخواست به فروشگاه رسیده است" : "پیش‌نویس آمادهٔ مرور است"}</p>
            <h1>درخواست سفارش <span>{order.id}</span></h1>
            <div className={styles.importantNotice}>
              <strong><Clock3 size={18} aria-hidden="true" /> {order.status === "sent-to-frappe" ? "در ERPNext ثبت شده؛ هنوز تأیید یا پرداخت نشده" : "هنوز به اسموله نرسیده"}</strong>
              <p>{order.status === "sent-to-frappe" ? "درخواست برای بررسی به فروشگاه رسیده است. پرداخت اینترنتی انجام نشده؛ اسموله برای تأیید قیمت نهایی و هماهنگی تحویل پیگیری می‌کند." : "این اطلاعات فقط روی همین مرورگر ذخیره شده است. برای ثبت واقعی، درخواست باید از راه دریافت سفارش اسموله ارسال شود."}</p>
            </div>
            <section className={styles.orderCard} aria-label="جزئیات پیش‌نویس سفارش">
              <h2>خلاصهٔ اقلام</h2>
              {order.lines.map((line, index) => (
                <article className={styles.line} key={`${line.kind}-${index}`}>
                  <span className={styles.lineIcon}><Cookie size={19} aria-hidden="true" /></span>
                  <div><strong>{line.title}</strong><small>{line.kind === "product" ? line.serving : `وزن نهایی حدود ${formatPersianNumber(line.finalWeight)} گرم · ${line.toppings.length ? line.toppings.join("، ") : "بدون تاپینگ"}`}</small></div>
                  <b>× {formatPersianNumber(line.quantity)}</b>
                </article>
              ))}
              <div className={styles.orderTotal}><span>جمعِ اقلام آماده</span><strong>{formatToman(order.readySubtotal)}</strong></div>
              {order.customQuoteRequired && <p className={styles.quoteNote}>قیمت ترکیب سفارشی پس از تأیید مواد و وزن اعلام می‌شود.</p>}
              <div className={styles.contactDetails}><strong>اطلاعات تحویل واردشده</strong><span>{order.customer.name} · {order.customer.phone}</span><span>روش دریافت: {order.deliveryMethod === "pickup" ? "تحویل حضوری" : "ارسال"}</span>{order.requestedForDate && <span>زمان پیشنهادی: {new Date(`${order.requestedForDate}T12:00:00`).toLocaleDateString("fa-IR")}{order.requestedForTime ? ` · ${order.requestedForTime.slice(0, 5)}` : ""} (در انتظار تأیید)</span>}{order.deliveryMethod !== "pickup" && <span>{order.customer.city}، {order.customer.address}</span>}{order.customer.note && <span>توضیحات: {order.customer.note}</span>}</div>
            </section>
            <section className={styles.nextStep}>
              <h2>قدم بعدی</h2>
              {whatsappHref ? (
                <>
                  <p>با لمس دکمه، متن سفارش در واتساپ آماده می‌شود؛ برای ارسال، پیام را در واتساپ خودت تأیید کن.</p>
                  <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> ادامه در واتساپ</a>
                </>
              ) : (
                <p>شمارهٔ واتساپ فروشگاه یا سرویس ثبت سفارش هنوز پیکربندی نشده است. تا آن زمان، این پیش‌نویس فقط روی این دستگاه می‌ماند.</p>
              )}
              <div className={styles.actions}><a href="/my-orders">پیش‌نویس‌های من</a><a href="/menu">بازگشت به منو</a><a href="/cart">سبد خرید <ShoppingBasket size={15} aria-hidden="true" /></a></div>
            </section>
          </main>
        )}
      </div>
      <CommerceFooter />
    </div>
  );
}

export function OrderRouteLoadingPage() {
  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        <main id="main-content" className={styles.main}>
          <div className={styles.loading} role="status" aria-live="polite">در حال بررسی پیوند پیگیری…</div>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}

export function OrderLinkRequiredPage() {
  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        <main id="main-content" className={styles.main}>
          <section className={styles.notFound} aria-labelledby="order-link-title">
            <ClipboardList size={30} aria-hidden="true" />
            <p className={styles.kicker}>پیگیری سفارش</p>
            <h1 id="order-link-title">پیوند پیگیری کامل نیست</h1>
            <p>برای دیدن وضعیت، نشانی خصوصی پیگیری را کامل باز کن؛ اگر از این صفحه وارد شدی، پیوند اصلی را از همان دستگاه یا پیام پس از پرداخت دوباره باز کن.</p>
            <div className={styles.emptyActions}>
              <a href="/menu">رفتن به منو <ArrowLeft size={16} aria-hidden="true" /></a>
              <a href="/account?tab=orders">سفارش‌های حساب من</a>
            </div>
          </section>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}

export function OrderHistoryPage() {
  const { orders, loaded } = useDraftOrders();

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        <main id="main-content" className={styles.history}>
          <p className={styles.kicker}>پیگیری روی همین دستگاه</p>
          <h1>پیش‌نویس‌های من</h1>
          <p className={styles.historyIntro}>این فهرست محلی است و وضعیت سفارش واقعی را از فروشگاه دریافت نمی‌کند.</p>
          {!loaded ? <div className={styles.loading}>در حال بارگذاری…</div> : orders.length ? (
            <div className={styles.historyList}>
              {orders.map((order) => <a href={`/orders/view/?id=${encodeURIComponent(order.id)}`} className={styles.historyItem} key={order.id}>
                <span><ClipboardList size={19} aria-hidden="true" /></span>
                <div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString("fa-IR")} · {formatPersianNumber(order.lines.reduce((count, line) => count + line.quantity, 0))} عدد</small></div>
                <b>{order.status === "sent-to-frappe" ? "ثبت‌شده برای بررسی" : order.customQuoteRequired ? "نیازمند بررسی" : formatToman(order.readySubtotal)}</b>
                <ArrowLeft size={17} aria-hidden="true" />
              </a>)}
            </div>
          ) : (
            <section className={styles.notFound}><ClipboardList size={28} aria-hidden="true" /><h2>هنوز پیش‌نویسی نداری</h2><p>بعد از مرور سبد می‌توانی یک پیش‌نویس روی همین دستگاه بسازی.</p><a href="/menu">انتخاب از منو <ArrowLeft size={16} aria-hidden="true" /></a></section>
          )}
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
