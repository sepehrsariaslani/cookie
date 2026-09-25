import type { Metadata } from "next";
import { OrderConfirmationLookup } from "@/components/smule/OrderConfirmationLookup";

export const metadata: Metadata = {
  title: "پیگیری درخواست سفارش | اسموله",
  description: "وضعیت درخواست سفارش اسموله را ببین.",
};

export default function OrderViewRoute() {
  return <OrderConfirmationLookup />;
}
