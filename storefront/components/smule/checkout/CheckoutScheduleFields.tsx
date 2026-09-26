"use client";

import { useState } from "react";
import { CalendarDays, Clock3, LocateFixed, MapPin, X } from "lucide-react";
import styles from "./CheckoutScheduleFields.module.css";

export type DeliveryCoordinates = { latitude: number; longitude: number };

type CheckoutScheduleFieldsProps = {
  deliveryMethod: "pickup" | "delivery";
  scheduled: boolean;
  requestedDate: string;
  requestedTime: string;
  coordinates: DeliveryCoordinates | null;
  dateError?: string;
  onScheduledChange: (scheduled: boolean) => void;
  onScheduleChange: (date: string, time: string) => void;
  onCoordinatesChange: (coordinates: DeliveryCoordinates | null) => void;
};

function getLocalDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function CheckoutScheduleFields({
  deliveryMethod,
  scheduled,
  requestedDate,
  requestedTime,
  coordinates,
  dateError,
  onScheduledChange,
  onScheduleChange,
  onCoordinatesChange,
}: CheckoutScheduleFieldsProps) {
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationError, setLocationError] = useState("");

  function chooseSchedule(next: boolean) {
    onScheduledChange(next);
    if (!next) onScheduleChange("", "");
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("مرورگر امکان دسترسی به موقعیت را فراهم نمی‌کند؛ نشانی را دستی وارد کن.");
      setLocationMessage("");
      return;
    }

    setLocating(true);
    setLocationError("");
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCoordinatesChange({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationMessage("موقعیت انتخاب شد؛ همراه نشانی برای فروشگاه ارسال می‌شود.");
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "دسترسی موقعیت تأیید نشد؛ می‌توانی نشانی را دستی وارد کنی."
          : error.code === error.TIMEOUT
            ? "دریافت موقعیت زمان‌بر شد؛ دوباره تلاش کن یا نشانی را دستی وارد کن."
            : "موقعیت دریافت نشد؛ دوباره تلاش کن یا نشانی را دستی وارد کن.";
        setLocationError(message);
        setLocationMessage("");
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  }

  function clearLocation() {
    onCoordinatesChange(null);
    setLocationError("");
    setLocationMessage("موقعیت برداشته شد.");
  }

  return (
    <section className={styles.planner} aria-labelledby="checkout-schedule-heading">
      <div className={styles.heading}>
        <span className={styles.icon}><CalendarDays size={18} aria-hidden="true" /></span>
        <div>
          <h3 id="checkout-schedule-heading">زمان دریافت</h3>
          <p>می‌توانی زمان دلخواهت را پیشنهاد بدهی؛ نهایی‌شدن آن با تأیید فروشگاه است.</p>
        </div>
      </div>

      <fieldset className={styles.scheduleOptions}>
        <legend className={styles.srOnly}>زمان دریافت سفارش</legend>
        <label className={`${styles.option} ${!scheduled ? styles.selected : ""}`}>
          <input type="radio" name="requestedSchedule" checked={!scheduled} onChange={() => chooseSchedule(false)} />
          <span><strong>نزدیک‌ترین زمان ممکن</strong><small>فروشگاه زمان دقیق را با تو هماهنگ می‌کند.</small></span>
        </label>
        <label className={`${styles.option} ${scheduled ? styles.selected : ""}`}>
          <input type="radio" name="requestedSchedule" checked={scheduled} onChange={() => chooseSchedule(true)} />
          <span><strong>زمان دلخواه</strong><small>تاریخ و ساعت پیشنهادی را انتخاب کن.</small></span>
        </label>
      </fieldset>

      {scheduled && <div className={styles.dateFields}>
        <label>
          <span>تاریخ پیشنهادی <b>*</b></span>
          <span className={styles.inputWrap}><CalendarDays size={17} aria-hidden="true" />
            <input id="checkout-requested-date" type="date" min={getLocalDateValue()} required aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "checkout-requested-date-error" : undefined} value={requestedDate} onChange={(event) => onScheduleChange(event.target.value, requestedTime)} />
          </span>
          {dateError && <small id="checkout-requested-date-error" className={styles.error} role="alert">{dateError}</small>}
        </label>
        <label>
          <span>ساعت ترجیحی <small>اختیاری</small></span>
          <span className={styles.inputWrap}><Clock3 size={17} aria-hidden="true" />
            <input type="time" value={requestedTime} disabled={!requestedDate} onChange={(event) => onScheduleChange(requestedDate, event.target.value)} />
          </span>
        </label>
      </div>}

      {deliveryMethod === "delivery" && <div className={styles.location}>
        <div className={styles.locationCopy}>
          <MapPin size={17} aria-hidden="true" />
          <p><strong>نشان‌کردن موقعیت روی دستگاه</strong><small>اختیاری است و نشانی نوشتاری را جایگزین نمی‌کند.</small></p>
        </div>
        <div className={styles.locationActions}>
          <button className={styles.locationButton} type="button" onClick={requestLocation} disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" />{locating ? "در حال دریافت موقعیت…" : coordinates ? "به‌روزرسانی موقعیت" : "انتخاب موقعیت فعلی"}
          </button>
          {coordinates && <button className={styles.clearButton} type="button" onClick={clearLocation} aria-label="برداشتن موقعیت انتخاب‌شده"><X size={17} aria-hidden="true" /></button>}
        </div>
        {coordinates && <small className={styles.coordinates} dir="ltr">{coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</small>}
        {locationMessage && <p className={styles.success} role="status">{locationMessage}</p>}
        {locationError && <p className={styles.error} role="alert">{locationError}</p>}
      </div>}
    </section>
  );
}
