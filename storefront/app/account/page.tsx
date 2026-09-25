import type { Metadata } from "next";
import { CustomerAccount } from "@/components/smule/CustomerAccount";

export const metadata: Metadata = {
  title: "حساب من | اسموله",
  description: "سفارش‌ها، نشانی‌ها، اطلاعات مشتری و پرداخت‌های ثبت‌شدهٔ حساب اسموله.",
};

export default function AccountPage() {
  return <CustomerAccount />;
}
