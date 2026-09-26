"use client";

import { useEffect, useState } from "react";
import { OrderConfirmationPage, OrderLinkRequiredPage, OrderRouteLoadingPage } from "@/components/smule/OrderPages";
import { GuestOrderTracking } from "@/components/smule/GuestOrderTracking";

export function OrderConfirmationLookup() {
  const [orderId, setOrderId] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    const readLocation = () => {
      setOrderId(new URLSearchParams(window.location.search).get("id") ?? "");
      const urlToken = window.location.hash.slice(1);
      if (urlToken) {
        setTrackingToken(urlToken);
      } else {
        try {
          const pending = JSON.parse(sessionStorage.getItem("smule-payment-tracking") ?? "null") as { token?: unknown } | null;
          setTrackingToken(typeof pending?.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(pending.token) ? pending.token : "");
        } catch {
          setTrackingToken("");
        }
      }
      setLocationReady(true);
    };
    readLocation();
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, []);

  if (!locationReady) return <OrderRouteLoadingPage />;
  if (trackingToken) return <GuestOrderTracking token={trackingToken} />;
  if (!orderId) return <OrderLinkRequiredPage />;
  return <OrderConfirmationPage orderId={orderId} />;
}
