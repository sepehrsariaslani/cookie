import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "راهنما و پرسش‌های پرتکرار | اسموله",
  description: "راهنمای سفارش، کوکی سفارشی، ارزش غذایی و روش دریافت در اسموله.",
};

export default function FaqPage() {
  return <StoreInfoPage kind="faq" />;
}
