import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "تماس با اسموله | راهنمای مشتری",
  description: "راه‌های دریافت راهنمایی دربارهٔ محصولات و سفارش‌های اسموله.",
};

export default function ContactPage() {
  return <StoreInfoPage kind="contact" />;
}
