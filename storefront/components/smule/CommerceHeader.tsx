"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the broken Vinext Link client transition. */

import { Cookie, ShoppingBasket, UserRound } from "lucide-react";
import { useCookieCart } from "@/components/smule/CartProvider";
import { formatPersianNumber } from "@/lib/smule/products";
import styles from "./CommerceHeader.module.css";

export function CommerceHeader({ current }: { current?: "menu" | "builder" | "cart" | "account" }) {
  const { itemCount, ready } = useCookieCart();
  return (
    <>
    <a className={styles.skipLink} href="#main-content">رفتن به محتوای اصلی</a>
    <header className={styles.header}>
      <a className={styles.brand} href="/" aria-label="اسموله، صفحهٔ اصلی">
        <span className={styles.mark} aria-hidden="true"><Cookie size={20} strokeWidth={2.2} /></span>
        <span><strong>smule</strong><small>اسموله</small></span>
      </a>
      <nav className={styles.navigation} aria-label="ناوبری اصلی">
        <a className={current === "menu" ? styles.active : ""} href="/menu">منو</a>
        <a href="/account?tab=orders">سفارش‌ها</a>
        <a className={`${styles.cartLink} ${current === "cart" ? styles.active : ""}`} href="/cart" aria-label={`سبد خرید، ${formatPersianNumber(itemCount)} عدد`}>
          <ShoppingBasket size={18} aria-hidden="true" />
          <span>سبد</span>
          {ready && itemCount > 0 && <span className={styles.cartCount} aria-label={`${formatPersianNumber(itemCount)} عدد`}>{formatPersianNumber(itemCount)}</span>}
        </a>
        <a className={`${styles.buildLink} ${current === "builder" ? styles.activeBuild : ""}`} href="/build-cookie">
          کوکی‌ات را بساز
        </a>
        <a className={`${styles.accountLink} ${current === "account" ? styles.active : ""}`} href="/account" aria-label="حساب کاربری">
          <UserRound size={18} aria-hidden="true" /><span>حساب</span>
        </a>
      </nav>
    </header>
    </>
  );
}
