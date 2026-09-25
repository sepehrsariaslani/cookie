import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "روش‌های دریافت سفارش | اسموله",
  description: "اطلاعات تحویل حضوری، ارسال و پرداخت سفارش‌های اسموله.",
};

export default function PickupPage() {
  return <StoreInfoPage kind="pickup" />;
}
