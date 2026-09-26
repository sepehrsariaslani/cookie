"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation is required across the Frappe/Vinext boundary. */

import { useEffect, useState } from "react";
import { ArrowLeft, CircleAlert, Cookie, MailCheck, RefreshCw, ShieldCheck, UserRoundPlus } from "lucide-react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { fetchCustomerAccount, type SmuleAccountData } from "@/lib/smule/customer-account";
import styles from "./CustomerSignup.module.css";

const signupHref = "/login?redirect-to=%2Faccount#signup";
const loginHref = "/login?redirect-to=%2Faccount";

export function CustomerSignup() {
  const [data, setData] = useState<SmuleAccountData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerAccount(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "وضعیت ثبت‌نام دریافت نشد.");
      });
    return () => controller.abort();
  }, [attempt]);

  const signupReady = Boolean(data?.signupEnabled && data.signupEmailReady);

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="account" />
        <main id="main-content" className={styles.main}>
          <a className={styles.backLink} href="/account"><ArrowLeft size={16} aria-hidden="true" /> بازگشت به حساب کاربری</a>
          <section className={styles.card} aria-labelledby="signup-title">
            <span className={styles.icon} aria-hidden="true"><UserRoundPlus size={27} /></span>
            <p className={styles.eyebrow}>حساب مشتری اسموله</p>
            <h1 id="signup-title">سفارش‌هایت را <em>یک‌جا</em> نگه دار.</h1>
            <p className={styles.description}>با حساب مشتری می‌توانی سفارش‌ها، وضعیت پرداخت و نشانی‌های ذخیره‌شده‌ات را در یک جای امن ببینی.</p>

            {!data && !error && <div className={styles.status} role="status"><span className={styles.spinner} />در حال بررسی امکان ساخت حساب…</div>}

            {error && <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
              <CircleAlert size={19} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }} aria-label="بررسی دوبارهٔ وضعیت ثبت‌نام"><RefreshCw size={17} aria-hidden="true" /> دوباره تلاش کن</button>
            </div>}

            {data?.authenticated && <div className={styles.notice} role="status">
              <ShieldCheck size={19} aria-hidden="true" />
              <span>همین حالا وارد حساب اسموله هستی.</span>
            </div>}

            {data && !data.authenticated && signupReady && <div className={styles.notice} role="note">
              <MailCheck size={19} aria-hidden="true" />
              <span>ثبت‌نام با ایمیل فعال است؛ برای تأیید حساب، ایمیل معتبرت را وارد کن.</span>
            </div>}

            {data && !data.authenticated && data.signupEnabled && !data.signupEmailReady && <div className={styles.notice} role="status">
              <ShieldCheck size={19} aria-hidden="true" />
              <span>ثبت‌نام پس از تنظیم ایمیل خروجی فروشگاه در Frappe فعال می‌شود.</span>
            </div>}

            {data && !data.authenticated && !data.signupEnabled && <div className={styles.notice} role="status">
              <ShieldCheck size={19} aria-hidden="true" />
              <span>ساخت حساب جدید فعلاً از تنظیمات امن فروشگاه غیرفعال است؛ سفارش‌ها و ترکیب کوکی‌ها را می‌توانی ببینی.</span>
            </div>}

            <div className={styles.actions}>
              {data?.authenticated ? (
                <a className={styles.primaryAction} href="/account">رفتن به حساب من <ArrowLeft size={17} aria-hidden="true" /></a>
              ) : signupReady ? (
                <a className={styles.primaryAction} href={signupHref}>ساخت حساب با ایمیل <ArrowLeft size={17} aria-hidden="true" /></a>
              ) : (
                <a className={styles.primaryAction} href={loginHref}>ورود به حساب موجود <ArrowLeft size={17} aria-hidden="true" /></a>
              )}
              {!data?.authenticated && <a className={styles.secondaryAction} href="/menu"><Cookie size={17} aria-hidden="true" /> دیدن منوی کوکی‌ها</a>}
            </div>

            {signupReady && <p className={styles.loginHint}>قبلاً حساب ساخته‌ای؟ <a href={loginHref}>وارد شو</a></p>}
          </section>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
