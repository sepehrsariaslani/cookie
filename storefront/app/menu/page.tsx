import type { Metadata } from "next";
import { MenuCatalog } from "@/components/smule/MenuCatalog";

export const metadata: Metadata = {
  title: "منوی کوکی‌ها و شیرینی‌ها | اسموله",
  description: "طعم‌های آمادهٔ اسموله را ببین، ترکیبات را بررسی کن و مستقیم به سبدت اضافه کن.",
};

export default function MenuPage() {
  return <MenuCatalog />;
}
