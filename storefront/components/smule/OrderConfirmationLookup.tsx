"use client";

import { useEffect, useState } from "react";
import { OrderConfirmationPage } from "@/components/smule/OrderPages";
import styles from "./MenuProductLookup.module.css";

export function OrderConfirmationLookup() {
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    setOrderId(new URLSearchParams(window.location.search).get("id") ?? "");
  }, []);

  if (!orderId) return <div className={styles.loading} role="status">در حال بازکردن اطلاعات درخواست…</div>;
  return <OrderConfirmationPage orderId={orderId} />;
}
