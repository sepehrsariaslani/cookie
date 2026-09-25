import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "حریم خصوصی | اسموله",
  description: "اطلاعاتی که نسخهٔ پیش‌نمایش اسموله در مرورگر نگه می‌دارد و راه پاک‌کردن آن.",
};

export default function PrivacyPage() {
  return <StoreInfoPage kind="privacy" />;
}
