import type { Metadata } from "next";
import { CookieBuilder } from "@/components/smule/CookieBuilder";

export const metadata: Metadata = {
  title: "کوکی خودت را بساز | اسموله",
  description: "اندازه، خمیر و افزودنی‌های کوکی اسموله را انتخاب کن، پیش‌نمایش زنده و برآورد ارزش غذایی را ببین و به سبدت اضافه کن.",
};

export default function BuildCookiePage() {
  return <CookieBuilder />;
}
