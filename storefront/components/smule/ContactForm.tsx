"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { submitSupportRequest } from "@/lib/smule/frappe-client";
import styles from "./ContactForm.module.css";

const topics = [
  "محصول و ترکیبات",
  "حساسیت غذایی",
  "کوکی سفارشی",
  "سفارش و تحویل",
  "حریم خصوصی و اطلاعات من",
  "سایر پرسش‌ها",
];

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await submitSupportRequest({ name, email, topic, message, website });
      setSuccess(result.message);
      setName("");
      setEmail("");
      setTopic("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ارسال پیام انجام نشد؛ دوباره تلاش کن.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="contact-form-title">
      <div className={styles.heading}>
        <span className={styles.icon}><MessageCircle size={20} aria-hidden="true" /></span>
        <div>
          <p>پیام به پشتیبانی</p>
          <h2 id="contact-form-title">چطور کمکت کنیم؟</h2>
        </div>
      </div>
      <p className={styles.intro}>پیامت در ERPNext فروشگاه ثبت می‌شود. سفارش و پرداخت همچنان غیرفعال‌اند.</p>

      {success ? (
        <div className={styles.success} role="status">
          <ShieldCheck size={22} aria-hidden="true" />
          <div><strong>پیام ثبت شد</strong><p>{success}</p></div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.fields}>
            <label>
              <span>نام <b aria-hidden="true">*</b></span>
              <input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>ایمیل برای پاسخ <b aria-hidden="true">*</b></span>
              <input autoComplete="email" required maxLength={254} type="email" inputMode="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className={styles.fullField}>
              <span>موضوع پیام <b aria-hidden="true">*</b></span>
              <select required value={topic} onChange={(event) => setTopic(event.target.value)}>
                <option value="" disabled>یک موضوع انتخاب کن</option>
                {topics.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className={styles.fullField}>
              <span>پیامت <b aria-hidden="true">*</b></span>
              <textarea required minLength={10} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="جزئیات پرسشت را بنویس…" />
              <small className={styles.counter}>{message.length.toLocaleString("fa-IR")} از ۲٬۰۰۰ نویسه</small>
            </label>
          </div>
          <label className={styles.honeypot} aria-hidden="true">
            <span>وب‌سایت</span>
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </label>
          <div className={styles.formBottom}>
            <p><ShieldCheck size={16} aria-hidden="true" /> نام، ایمیل و پیام در ERPNext ذخیره می‌شوند؛ <a href="/privacy">حریم خصوصی</a>. اطلاعات حساس یا بانکی نفرست.</p>
            <button type="submit" disabled={pending}>
              {pending ? <LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> : <ArrowLeft size={17} aria-hidden="true" />}
              {pending ? "در حال ارسال…" : "ارسال پیام"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
