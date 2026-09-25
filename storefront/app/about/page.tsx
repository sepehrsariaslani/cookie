import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "دربارهٔ اسموله",
  description: "با تجربهٔ کوکی‌های آماده و ترکیب کوکی دلخواه در اسموله آشنا شو.",
};

export default function AboutPage() {
  return <StoreInfoPage kind="about" />;
}
