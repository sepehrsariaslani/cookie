/* eslint-disable @next/next/no-html-link-for-pages -- Keep full-page navigation stable in the preview. */

import { ArrowLeft, CircleHelp, Cookie } from "lucide-react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader />
        <main id="main-content" className={styles.main}>
          <span className={styles.icon}><Cookie size={28} aria-hidden="true" /></span>
          <p className={styles.code}>۴۰۴ · خرده‌ای از مسیر گم شده</p>
          <h1>این صفحه را<br /><em>در منو پیدا نکردیم.</em></h1>
          <p className={styles.description}>ممکن است نشانی تغییر کرده باشد. از اینجا می‌توانی دوباره سراغ طعم‌ها یا راهنمای اسموله بروی.</p>
          <div className={styles.actions}>
            <a href="/menu">دیدن منو <ArrowLeft size={17} aria-hidden="true" /></a>
            <a href="/faq"><CircleHelp size={17} aria-hidden="true" /> راهنمای مشتری</a>
          </div>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
