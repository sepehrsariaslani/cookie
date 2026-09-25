import type { Metadata } from "next";
import { CheckoutPage } from "@/components/smule/CheckoutPage";

export const metadata: Metadata = {
  title: "اطلاعات سفارش | اسموله",
  description: "اطلاعات لازم برای مرور سفارش کوکی‌های اسموله را وارد کن.",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
