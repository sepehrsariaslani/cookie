"use client";

import { useState } from "react";
import { useCookieCart } from "@/components/smule/CartProvider";
import { clearOrderDrafts } from "@/lib/smule/orders";
import styles from "./PrivacyDataControls.module.css";

export function PrivacyDataControls() {
  const { clearCart, ready } = useCookieCart();
  const [status, setStatus] = useState("");

  function clearLocalData() {
    const confirmed = window.confirm("سبد خرید و پیش‌نویس‌های ذخیره‌شدهٔ اسموله فقط از همین مرورگر پاک می‌شوند. این کار برگشت‌پذیر نیست. ادامه می‌دهی؟");
    if (!confirmed) return;

    const cartCleared = clearCart();
    const draftsCleared = clearOrderDrafts();
    setStatus(cartCleared && draftsCleared
      ? "سبد و پیش‌نویس‌های محلی این مرورگر پاک شدند."
      : "محتوا از صفحه خالی شد، اما مرورگر اجازهٔ پاک‌سازی کامل ذخیره‌سازی را نداد. داده‌های سایت را از تنظیمات مرورگر پاک کن.");
  }

  return (
    <section className={styles.panel} id="data-controls" aria-labelledby="data-controls-title">
      <div>
        <h2 id="data-controls-title">مدیریت اطلاعات این دستگاه</h2>
        <p>این گزینه فقط سبد خرید و پیش‌نویس‌های محلی اسموله را پاک می‌کند؛ روی سفارش ثبت‌شده در فروشگاه اثری ندارد.</p>
        {status && <p className={styles.status} role="status">{status}</p>}
      </div>
      <button type="button" onClick={clearLocalData} disabled={!ready}>
        پاک‌کردن اطلاعات محلی
      </button>
    </section>
  );
}
