import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "شرایط استفاده | اسموله",
  description: "وضعیت و شرایط استفاده از نسخهٔ پیش‌نمایش فروشگاه اسموله.",
};

export default function TermsPage() {
  return <StoreInfoPage kind="terms" />;
}
