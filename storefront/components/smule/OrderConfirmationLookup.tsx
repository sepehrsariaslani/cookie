"use client";

import { useEffect, useState } from "react";
import { OrderConfirmationPage } from "@/components/smule/OrderPages";
import { GuestOrderTracking } from "@/components/smule/GuestOrderTracking";
import styles from "./MenuProductLookup.module.css";

export function OrderConfirmationLookup() {
  const [orderId, setOrderId] = useState("");
  const [trackingToken, setTrackingToken] = useState("");

  useEffect(() => {
    const readLocation = () => {
      setOrderId(new URLSearchParams(window.location.search).get("id") ?? "");
      const urlToken = window.location.hash.slice(1);
      if (urlToken) {
        setTrackingToken(urlToken);
        return;
      }
      try {
        const pending = JSON.parse(sessionStorage.getItem("smule-payment-tracking") ?? "null") as { token?: unknown } | null;
        setTrackingToken(typeof pending?.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(pending.token) ? pending.token : "");
      } catch {
        setTrackingToken("");
      }
    };
    readLocation();
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, []);

  if (trackingToken) return <GuestOrderTracking token={trackingToken} />;
  if (!orderId) return <div className={styles.loading} role="status">پیوند پیگیری کامل نیست؛ نشانی پیگیری را کامل باز کن.</div>;
  return <OrderConfirmationPage orderId={orderId} />;
}
