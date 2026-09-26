"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the broken Vinext Link client transition. */

import { useMemo, useState } from "react";
import { ArrowLeft, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useCookieCart } from "@/components/smule/CartProvider";
import { CookieCanvas } from "@/components/smule/CookieStory";
import {
  canAddTopping,
  calculateCookiePrice,
  calculateCookieNutrition,
  COOKIE_GRAM_STEP,
  COOKIE_SIZES,
  DOUGHS,
  getDoughImage,
  getToppingAmountForBase,
  getToppingCapacity,
  getToppingImage,
  MAX_TOPPING_COUNT,
  MAX_COOKIE_GRAMS,
  MIN_COOKIE_GRAMS,
  TOPPING_GROUPS,
  TOPPINGS,
  type DoughId,
  type ToppingId,
} from "@/lib/smule/cookie-builder";
import { formatPersianNumber, formatToman, toDisplayTomans } from "@/lib/smule/products";
import { CommerceHeader } from "./CommerceHeader";
import { CommerceFooter } from "./CommerceFooter";
import { useStorefrontData } from "./StorefrontDataProvider";
import styles from "./CookieBuilder.module.css";

export function CookieBuilder() {
  const { addCookie, itemCount, ready } = useCookieCart();
  const { components, connected, currency } = useStorefrontData();
  const [dough, setDough] = useState<DoughId>("marble");
  const [sizeGrams, setSizeGrams] = useState(50);
  const [toppings, setToppings] = useState<ToppingId[]>([]);
  const nutrition = useMemo(() => calculateCookieNutrition(dough, toppings, sizeGrams), [dough, toppings, sizeGrams]);
  const selectedDough = DOUGHS.find((option) => option.id === dough) ?? DOUGHS[0];
  const selectedNames = TOPPINGS.filter(({ id }) => toppings.includes(id)).map(({ name }) => name);
  const allergenNames = [...new Set([...selectedDough.allergens, ...TOPPINGS.filter(({ id }) => toppings.includes(id)).flatMap(({ allergens }) => allergens)])];
  const toppingCapacity = getToppingCapacity(sizeGrams);
  const remainingCapacity = Math.max(0, Number((toppingCapacity - nutrition.toppingWeight).toFixed(1)));
  const hasBlockedToppings = TOPPINGS.some(({ id }) => !toppings.includes(id) && !canAddTopping(toppings, id, sizeGrams));
  const cookiePrice = useMemo(
    () => connected ? calculateCookiePrice(dough, toppings, sizeGrams, components, currency) : null,
    [connected, components, currency, dough, toppings, sizeGrams],
  );
  const displayCookiePrice = cookiePrice === null ? null : Math.round(toDisplayTomans(cookiePrice, currency));

  function toggleTopping(id: ToppingId, enabled: boolean) {
    setToppings((current) => {
      if (!enabled) return current.filter((item) => item !== id);
      return canAddTopping(current, id, sizeGrams) ? [...current, id] : current;
    });
  }

  function buildAndAddCookie() {
    addCookie({ doughId: dough, sizeGrams, toppingIds: toppings, nutrition });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The cart is persisted synchronously before this full navigation.
    window.location.assign("/cart");
  }

  function resetBuilder() {
    setDough("marble");
    setSizeGrams(50);
    setToppings([]);
  }

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader current="builder" />
        <main id="main-content">
        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}><span /> سازندهٔ کوکی اسموله</p>
            <h1>اول اندازه؛ بعد طعم.</h1>
            <p className={styles.intro}>وزن را مشخص کن، خمیرت را بردار و ترکیب‌های دلخواهت را اضافه یا حذف کن.</p>
          </div>
          <a className={styles.backLink} href="/menu">بازگشت به منو <ArrowLeft size={16} aria-hidden="true" /></a>
        </div>

        <section className={styles.sizePanel} aria-labelledby="size-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.step}>۱</span>
            <div><h2 id="size-heading">وزن خمیر پایه</h2><p>این وزن فقط خمیر است؛ تاپینگ‌ها جداگانه به آن اضافه می‌شوند.</p></div>
            <output className={styles.sizeOutput} htmlFor="cookie-size-slider">{formatPersianNumber(sizeGrams)} <small>گرم بیس</small></output>
          </div>
          <div className={styles.sizePresets} role="group" aria-label="اندازه‌های آماده">
            {COOKIE_SIZES.map((preset) => (
              <button
                className={`${styles.sizePreset} ${sizeGrams === preset.grams ? styles.activeSize : ""}`}
                type="button"
                aria-pressed={sizeGrams === preset.grams}
                key={preset.grams}
                onClick={() => setSizeGrams(preset.grams)}
              >
                <strong>{preset.label}</strong><span>{formatPersianNumber(preset.grams)} گرم</span>
              </button>
            ))}
          </div>
          <div className={styles.sliderRow}>
            <span>{formatPersianNumber(MIN_COOKIE_GRAMS)} گرم</span>
            <Slider
              id="cookie-size-slider"
              className={styles.sizeSlider}
              aria-label="وزن تقریبی خمیر پایه"
              aria-valuetext={`${formatPersianNumber(sizeGrams)} گرم خمیر پایه`}
              min={MIN_COOKIE_GRAMS}
              max={MAX_COOKIE_GRAMS}
              step={COOKIE_GRAM_STEP}
              value={[sizeGrams]}
              onValueChange={(value) => setSizeGrams(value[0] ?? 50)}
            />
            <span>{formatPersianNumber(MAX_COOKIE_GRAMS)} گرم</span>
          </div>
        </section>

        <div className={styles.workspace}>
          <section className={styles.formPanel} aria-label="انتخاب خمیر و تاپینگ‌های کوکی">
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.step}>۲</span>
                <span><strong>خمیر پایه</strong><small>یک مدل خمیر انتخاب کن</small></span>
              </legend>
              <RadioGroup
                aria-label="نوع خمیر پایه"
                className={styles.doughOptions}
                value={dough}
                onValueChange={(value) => setDough(value as DoughId)}
              >
                {DOUGHS.map((option) => (
                  <label className={`${styles.doughOption} ${dough === option.id ? styles.selectedDough : ""}`} key={option.id} htmlFor={`dough-${option.id}`}>
                    <img className={styles.doughSwatch} src={getDoughImage(option.id)} alt="" width={48} height={48} loading="lazy" />
                    <span className={styles.optionCopy}>
                      <strong>{option.name}</strong>
                      <small>{option.note}</small>
                      <span className={styles.baseIngredients}>{option.ingredients.join(" · ")}</span>
                    </span>
                    <RadioGroupItem className={styles.radio} id={`dough-${option.id}`} value={option.id} />
                  </label>
                ))}
              </RadioGroup>
            </fieldset>

            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>
                <span className={styles.step}>۳</span>
                <span><strong>تاپینگ و مغزی‌ها</strong><small>تا {formatPersianNumber(MAX_TOPPING_COUNT)} افزودنی انتخاب کن؛ هر مورد به وزن بیس اضافه می‌شود</small></span>
              </legend>
              <div className={styles.toppingCapacity} aria-live="polite">
                <div className={styles.capacityHeading}>
                  <strong>{formatPersianNumber(toppings.length)} از {formatPersianNumber(MAX_TOPPING_COUNT)} افزودنی</strong>
                  <span>{formatPersianNumber(nutrition.toppingWeight)} از {formatPersianNumber(toppingCapacity)} گرم</span>
                </div>
                <progress value={nutrition.toppingWeight} max={toppingCapacity} aria-label="ظرفیت وزنی تاپینگ‌ها" />
                <p id="topping-capacity-help">{hasBlockedToppings
                  ? "برای انتخاب گزینه‌های غیرفعال، یکی از افزودنی‌های انتخابی را بردار."
                  : `${formatPersianNumber(remainingCapacity)} گرم ظرفیت افزودنی باقی مانده است.`}</p>
              </div>
              <div className={styles.groups}>
                {TOPPING_GROUPS.map((group) => {
                  const options = TOPPINGS.filter((option) => option.group === group.id);
                  const selectedCount = options.filter((option) => toppings.includes(option.id)).length;
                  return (
                    <section className={styles.toppingGroup} key={group.id} aria-labelledby={`group-${group.id}`}>
                      <div className={styles.groupHeading}>
                        <div><h3 id={`group-${group.id}`}>{group.title}</h3><p>{group.note}</p></div>
                        <span className={styles.groupCount}>{formatPersianNumber(selectedCount)} انتخاب</span>
                      </div>
                      <div className={styles.toppingOptions}>
                        {options.map((option) => {
                          const checked = toppings.includes(option.id);
                          const inputId = `topping-${option.id}`;
                          const amount = checked
                            ? nutrition.toppingAmounts[option.id] ?? 0
                            : getToppingAmountForBase(option.id, sizeGrams);
                          const calories = Math.round(option.recipe.calories * amount / 100);
                          const blocked = !checked && !canAddTopping(toppings, option.id, sizeGrams);
                          return (
                            <div className={`${styles.toppingOption} ${checked ? styles.selectedTopping : ""} ${blocked ? styles.blockedTopping : ""}`} key={option.id}>
                              <Checkbox
                                className={styles.checkbox}
                                id={inputId}
                                checked={checked}
                                disabled={blocked}
                                aria-describedby={blocked ? "topping-capacity-help" : undefined}
                                onCheckedChange={(value) => toggleTopping(option.id, value === true)}
                              />
                              <img className={styles.toppingSwatch} src={getToppingImage(option.id)} alt="" width={32} height={32} loading="lazy" />
                              <label htmlFor={inputId}>
                                <strong>{option.name}</strong>
                                <small>{option.note} · حدود {formatPersianNumber(amount)} گرم</small>
                              </label>
                              <span className={styles.toppingCalories}>+{formatPersianNumber(calories)} kcal</span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </fieldset>

            <div className={styles.allergenNotice}>
              <strong>برای حساسیت غذایی</strong>
              <span>در دستور نمونهٔ این خمیر: {allergenNames.length ? allergenNames.join("، ") : "مادهٔ حساسیت‌زای مشخصی ثبت نشده"}. آلودگی متقاطع و امکان حذف هر ماده باید با آشپزخانه بررسی شود.</span>
            </div>
            <p className={styles.estimateDisclaimer}>کالری و مقدار مواد تخمینی‌اند و با دستور واقعی، وزن‌کشی و پخت تغییر می‌کنند. تخم‌مرغ جزو بعضی خمیرهاست، نه تاپینگ.</p>

            <div className={styles.formActions}>
              <Button className={styles.buildButton} type="button" onClick={buildAndAddCookie} disabled={!ready || cookiePrice === null}>
                <ShoppingBasket size={18} aria-hidden="true" /> {!ready ? "در حال آماده‌سازی سبد…" : cookiePrice === null ? "قیمت این ترکیب هنوز آماده نیست" : "این کوکی را بساز و به سبد ببر"}
              </Button>
              <Button className={styles.resetButton} variant="ghost" type="button" onClick={resetBuilder}>از نو</Button>
            </div>
          </section>

          <aside className={styles.previewPanel} aria-label="پیش‌نمایش زنده و برآورد کوکی" aria-live="polite" aria-atomic="false">
            <div className={styles.previewCard}>
              <div className={styles.previewTopline}>
                <span className={styles.previewEyebrow}>پیش‌نمایش زنده</span>
                <span className={styles.previewStatus}><span /> با هر انتخاب عوض می‌شود</span>
              </div>
              <CookieCanvas
                variant="builder"
                className={styles.cookieCanvas}
                customDough={dough}
                customToppings={toppings}
                customSize={sizeGrams}
              />
              <div className={styles.cookieName}>
                <strong>{selectedDough.name} · بیس {formatPersianNumber(sizeGrams)} گرم</strong>
                <span>{selectedNames.length ? selectedNames.join(" · ") : "فقط خمیر پایه"}</span>
              </div>
              <p className={styles.previewEstimate}>مدل سه‌بعدی برای نمایش تقریبی رنگ و چیدمان مواد است.</p>
            </div>

            <div className={styles.calorieCard}>
              <div className={styles.priceEstimate} role="status" aria-live="polite">
                <div><span>قیمت این ترکیب</span><strong>{displayCookiePrice === null ? "در انتظار نرخ‌های فروشگاه" : formatToman(displayCookiePrice)}</strong></div>
                <p>{displayCookiePrice === null
                  ? "فروشگاه باید دستورهای واقعی را تأیید کند و نرخ هر گرم خمیر و افزودنی را در لیست قیمت ERPNext ثبت کند."
                  : "محاسبهٔ زنده بر پایهٔ وزن خمیر، مقدار افزودنی‌ها و نرخ فعال ERPNext است؛ هزینهٔ اسنپ‌پیک جداگانه محاسبه می‌شود."}</p>
              </div>
              <div className={styles.calorieTopline}><span>برآورد برای یک کوکی</span><strong>وزن نهایی حدود {formatPersianNumber(nutrition.weight)} گرم</strong></div>
              <div className={styles.calorieValue}><strong>{formatPersianNumber(nutrition.calories)}</strong><span>کیلوکالری</span></div>
              <dl className={styles.macroRow}>
                <div><dt>پروتئین</dt><dd>{formatPersianNumber(nutrition.protein)} گرم</dd></div>
                <div><dt>کربوهیدرات</dt><dd>{formatPersianNumber(nutrition.carbohydrates)} گرم</dd></div>
                <div><dt>چربی</dt><dd>{formatPersianNumber(nutrition.fat)} گرم</dd></div>
                <div><dt>قند</dt><dd>{formatPersianNumber(nutrition.sugar)} گرم</dd></div>
              </dl>
              <div className={styles.composition}>
                <p className={styles.weightEquation}><strong>وزن:</strong> خمیر پایه {formatPersianNumber(nutrition.doughWeight)} + افزودنی‌ها {formatPersianNumber(nutrition.toppingWeight)} = <b>{formatPersianNumber(nutrition.weight)} گرم</b></p>
                <p><strong>خمیر:</strong> {selectedDough.ingredients.join("، ")}</p>
                <p><strong>افزودنی‌ها:</strong> {selectedNames.length ? selectedNames.join("، ") : "بدون تاپینگ"}</p>
              </div>
              <p className={styles.calorieNote}>ارزش غذایی و وزن نهایی تقریبی است؛ ثبت سفارش نهایی پس از تأیید دستور انجام می‌شود.</p>
            </div>
            <a className={styles.cartShortcut} href="/cart"><ShoppingBasket size={17} aria-hidden="true" /> مشاهدهٔ سبد <span>{formatPersianNumber(itemCount)}</span></a>
          </aside>
        </div>
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
