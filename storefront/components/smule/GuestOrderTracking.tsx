"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors preserve the Frappe/Vinext route boundary. */

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock3, ClipboardList, Cookie, RefreshCw } from "lucide-react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { fetchGuestOrderStatus, type GuestOrderStatus } from "@/lib/smule/frappe-client";
import { formatPersianNumber, formatToman, toDisplayTomans } from "@/lib/smule/products";
import styles from "./OrderPages.module.css";

const statusLabels: Record<string, string> = {
  "جدید": "در صف بررسی فروشگاه",
  "نیازمند قیمت‌گذاری": "در انتظار اعلام قیمت",
  "قیمت‌گذاری‌شده": "قیمت‌گذاری انجام شده؛ منتظر تأیید فروشگاه",
  "تبدیل به سفارش فروش": "به پیش‌نویس سفارش ERPNext منتقل شد",
  "ردشده": "این درخواست از سوی فروشگاه پذیرفته نشده است",
};

function formatRequestedDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("fa-IR");
}

function TrackingActions({ retry }: { retry?: () => void }) {
  return (
    <div className={styles.trackingActions}>
      {retry && <button type="button" className={styles.trackingSecondary} onClick={retry}><RefreshCw size={16} aria-hidden="true" /> تلاش دوباره</button>}
      <a className={styles.trackingPrimary} href="/menu">بازگشت به منو <ArrowLeft size={16} aria-hidden="true" /></a>
      <a className={styles.trackingSecondary} href="/contact">تماس با اسموله</a>
    </div>
  );
}

export function GuestOrderTracking({ token }: { token: string }) {
  const [lookup, setLookup] = useState<{ token: string; order?: GuestOrderStatus; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchGuestOrderStatus(token, controller.signal)
      .then((order) => setLookup({ token, order }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLookup({ token, error: reason instanceof Error ? reason.message : "وضعیت سفارش دریافت نشد؛ دوباره تلاش کن." });
        }
      });
    return () => controller.abort();
  }, [token, attempt]);

  const currentLookup = lookup?.token === token ? lookup : null;
  const order = currentLookup?.order ?? null;
  const error = currentLookup?.error ?? "";
  const content = !order ? (
    error ? (
      <section className={styles.notFound}>
        <ClipboardList size={30} aria-hidden="true" />
        <h1>پیگیری سفارش در دسترس نیست</h1>
        <p>{error} اگر پیوند پیگیری را کامل باز نکرده‌ای، آن را از همان دستگاه یا پیام اصلی دوباره باز کن.</p>
        <TrackingActions retry={() => setAttempt((value) => value + 1)} />
      </section>
    ) : <div className={styles.loading} role="status" aria-live="polite">در حال دریافت آخرین وضعیت از فروشگاه…</div>
  ) : (
    <main id="main-content" className={styles.main}>
      <div className={styles.statusIcon}><Check size={27} aria-hidden="true" /></div>
      <p className={styles.kicker}>پیگیری درخواست از ERPNext</p>
      <h1>وضعیت درخواست <span>{order.name}</span></h1>
      <div className={styles.importantNotice} role="status">
        <strong><Clock3 size={18} aria-hidden="true" /> {statusLabels[order.status] ?? order.status}</strong>
        <p>این درخواست ثبت شده است؛ به‌تنهایی به معنی تأیید نهایی سفارش یا دریافت وجه نیست. برای تغییر یا هماهنگی تحویل، با فروشگاه تماس بگیر.</p>
      </div>
      <section className={styles.orderCard} aria-label="جزئیات عمومی درخواست">
        <h2>اقلام درخواست</h2>
        {order.items.map((item, index) => (
          <article className={styles.line} key={`${item.title}-${index}`}>
            <span className={styles.lineIcon}><Cookie size={19} aria-hidden="true" /></span>
            <div><strong>{item.title}</strong>{item.quoteRequired && <small>قیمت پس از بررسی فروشگاه اعلام می‌شود</small>}</div>
            <b>× {formatPersianNumber(item.quantity)}</b>
          </article>
        ))}
        <div className={styles.orderTotal}><span>جمع اقلامِ قیمت‌گذاری‌شده</span><strong>{formatToman(toDisplayTomans(order.readySubtotal, order.currency ?? undefined))}</strong></div>
        <div className={styles.contactDetails}>
          <strong>دریافت و زمان پیشنهادی</strong>
          <span>روش دریافت: {order.deliveryMethod === "تحویل حضوری" ? "تحویل حضوری" : "ارسال"}</span>
          {order.requestedForDate && <span>تاریخ: {formatRequestedDate(order.requestedForDate)}{order.requestedForTime ? ` · ساعت ${order.requestedForTime.slice(0, 5)}` : ""} — منتظر تأیید فروشگاه</span>}
          <span>پرداخت آنلاین از این صفحه انجام نمی‌شود.</span>
        </div>
      </section>
      <section className={styles.nextStep}>
        <h2>پیوند خصوصی پیگیری</h2>
        <p>این نشانی دسترسی به وضعیت همین درخواست را می‌دهد. آن را برای خودت نگه دار و فقط با فرد مورداعتماد به اشتراک بگذار.</p>
        <TrackingActions />
      </section>
    </main>
  );

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="cart" />
        {content}
      </div>
      <CommerceFooter />
    </div>
  );
}
