import type { Metadata } from "next";
import { OrderHistoryPage } from "@/components/smule/OrderPages";

export const metadata: Metadata = {
  title: "پیش‌نویس‌های من | اسموله",
  description: "پیش‌نویس‌هایی که روی همین دستگاه ساخته‌ای را مرور کن.",
};

export default function OrdersPage() {
  return <OrderHistoryPage />;
}
