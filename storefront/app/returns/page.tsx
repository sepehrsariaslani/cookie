import type { Metadata } from "next";
import { StoreInfoPage } from "@/components/smule/StoreInfoPage";

export const metadata: Metadata = {
  title: "لغو و بازپرداخت | اسموله",
  description: "اطلاع از وضعیت لغو و بازپرداخت در نسخهٔ فعلی فروشگاه اسموله.",
};

export default function ReturnsPage() {
  return <StoreInfoPage kind="returns" />;
}
