import type { Metadata } from "next";
import { CustomerSignup } from "@/components/smule/CustomerSignup";

export const metadata: Metadata = {
  title: "ساخت حساب مشتری | اسموله",
  description: "ساخت حساب مشتری اسموله برای پیگیری سفارش‌ها، نشانی‌ها و پرداخت‌ها.",
};

export default function SignupPage() {
  return <CustomerSignup />;
}
