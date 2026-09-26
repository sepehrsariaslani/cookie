/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the broken Vinext Link client transition. */

import { Cookie, MapPin, MessageCircle } from "lucide-react";
import styles from "./CommerceFooter.module.css";
import { MobileBottomNav } from "./MobileBottomNav";

export function CommerceFooter() {
  return (
    <>
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <a className={styles.brand} href="/" aria-label="اسموله، صفحهٔ اصلی">
          <span className={styles.mark} aria-hidden="true"><Cookie size={19} strokeWidth={2.2} /></span>
          <span><strong>smule</strong><small>اسموله</small></span>
        </a>
        <p className={styles.promise}>یک کوکی خوب، نقطهٔ شروع یک حال خوب است.</p>
        <nav className={styles.links} aria-label="پیوندهای پایین صفحه">
          <a href="/menu">منوی کوکی‌ها</a>
          <a href="/build-cookie">ساخت کوکی دلخواه</a>
          <a href="/cart">سبد خرید</a>
          <a href="/account">حساب کاربری و سفارش‌های من</a>
          <a href="/my-orders">پیش‌نویس‌های این دستگاه</a>
          <a href="/pickup">روش‌های دریافت</a>
          <a href="/faq">پرسش‌های پرتکرار</a>
          <a href="/about">دربارهٔ اسموله</a>
          <a href="/contact">تماس با اسموله</a>
          <a href="/privacy">حریم خصوصی</a>
          <a href="/terms">شرایط استفاده</a>
          <a href="/returns">لغو و بازپرداخت</a>
        </nav>
        <div className={styles.contact}>
          <span><MapPin size={15} aria-hidden="true" /> ارسال با اسنپ‌پیک · فقط کرج</span>
          <span><MessageCircle size={15} aria-hidden="true" /> راه ارتباطی فروشگاه هنوز ثبت نشده</span>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>© اسموله</span>
        <span>با کره و عشق پخته شده</span>
      </div>
    </footer>
    <MobileBottomNav />
    </>
  );
}
