import type { Metadata } from "next";
import { OrderConfirmationLookup } from "@/components/smule/OrderConfirmationLookup";

export const metadata: Metadata = {
  title: "وضعیت سفارش و پرداخت | اسموله",
  description: "وضعیت سفارش و پرداخت اسموله را ببین.",
};

export default function OrderConfirmationPage() {
  return <OrderConfirmationLookup />;
}
