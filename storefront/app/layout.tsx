import type { Metadata } from "next";
import { CartProvider } from "@/components/smule/CartProvider";
import { StorefrontDataProvider } from "@/components/smule/StorefrontDataProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "اسموله | منوی کوکی و ترکیب‌های سفارشی",
  description: "طعم‌های آمادهٔ اسموله را ببین یا ترکیب کوکی دلخواهت را با پیش‌نمایش زنده بساز.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/assets/smule_store/site/favicon.svg",
    shortcut: "/assets/smule_store/site/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        <StorefrontDataProvider>
          <CartProvider>{children}</CartProvider>
        </StorefrontDataProvider>
      </body>
    </html>
  );
}
