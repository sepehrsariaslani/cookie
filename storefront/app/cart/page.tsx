import type { Metadata } from "next";
import { CartPage } from "@/components/smule/CartPage";

export const metadata: Metadata = {
  title: "سبد کوکی‌های تو | اسموله",
  description: "ترکیب‌های کوکی انتخاب‌شده را در سبد اسموله مرور کن.",
};

export default function ShoppingCartPage() {
  return <CartPage />;
}
