import type { Metadata } from "next";
import { MenuProductLookup } from "@/components/smule/MenuProductLookup";

export const metadata: Metadata = {
  title: "جزئیات کوکی | اسموله",
  description: "ترکیبات و اطلاعات کوکی را از منوی اسموله ببین.",
};

export default function MenuProductRoute() {
  return <MenuProductLookup />;
}
