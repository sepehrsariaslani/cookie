"use client";

import { useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { retryZarinpalPayment } from "@/lib/smule/frappe-client";
import { getSafeZarinpalPaymentUrl } from "@/lib/smule/payment";
import styles from "./RetryPaymentButton.module.css";

type RetryPaymentButtonProps = {
  className?: string;
} & (
  | { trackingToken: string; orderRequestName?: never }
  | { trackingToken?: never; orderRequestName: string }
);

export function RetryPaymentButton({ trackingToken, orderRequestName, className }: RetryPaymentButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retryPayment() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await retryZarinpalPayment(
        trackingToken ? { trackingToken } : { orderRequestName: orderRequestName! },
      );
      const paymentUrl = getSafeZarinpalPaymentUrl(result.paymentUrl);
      if (!result.paymentRequired || !paymentUrl) {
        throw new Error("پیوند امن پرداخت آماده نشد؛ وضعیت سفارش را تازه‌سازی کن یا با اسموله تماس بگیر.");
      }
      window.location.assign(paymentUrl.toString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "پرداخت مجدد آماده نشد؛ دوباره تلاش کن.");
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <button className={styles.button} type="button" onClick={retryPayment} disabled={busy} aria-busy={busy}>
        {busy ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <CreditCard size={17} aria-hidden="true" />}
        {busy ? "در حال آماده‌کردن پرداخت…" : "تلاش دوباره برای پرداخت"}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
