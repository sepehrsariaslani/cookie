"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid the broken Vinext Link client transition. */

import { useMemo, useState } from "react";
import { ArrowLeft, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useCookieCart } from "@/components/smule/CartProvider";
import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES } from "@/lib/smule/cart-limits";
import { CookieCanvas } from "@/components/smule/CookieStory";
import {
  calculateCookiePrice,
  COOKIE_GRAM_STEP,
  COOKIE_SIZES,
  getToppingCapacity,
  MAX_TOPPING_COUNT,
  MAX_COOKIE_GRAMS,
  MIN_COOKIE_GRAMS,
  type DoughId,
  type ToppingId,
} from "@/lib/smule/cookie-builder";
import {
  calculateLiveCookieNutrition,
  canAddLiveTopping,
  getBuilderVisual,
  getLiveToppingAmount,
  getLiveToppingGroupTitle,
  mapLiveCookieComponents,
} from "@/lib/smule/live-cookie-builder";
import { formatPersianNumber, formatToman, toDisplayTomans } from "@/lib/smule/products";
import { CommerceHeader } from "./CommerceHeader";
import { CommerceFooter } from "./CommerceFooter";
import { useStorefrontData } from "./StorefrontDataProvider";
import styles from "./CookieBuilder.module.css";

export function CookieBuilder() {
  const { addCookie, itemCount, ready } = useCookieCart();
  const { components, loading, error, connected, ordersEnabled, currency, pricingMarkupPercent, customCookieFixedCost, priceRoundingIncrement } = useStorefrontData();
  const [dough, setDough] = useState<DoughId>("");
  const [sizeGrams, setSizeGrams] = useState(50);
  const [toppings, setToppings] = useState<ToppingId[]>([]);
  const [cartLimitMessage, setCartLimitMessage] = useState("");
  const liveOptions = useMemo(() => mapLiveCookieComponents(connected ? components : []), [components, connected]);
  const doughOptions = liveOptions.doughs;
  const toppingOptions = liveOptions.toppings;
  const activeDough = doughOptions.some((option) => option.id === dough) ? dough : doughOptions[0]?.id ?? "";
  const selectedDough = doughOptions.find((option) => option.id === activeDough);
  const activeToppings = useMemo(
    () => toppings.filter((id) => toppingOptions.some((option) => option.id === id)),
    [toppingOptions, toppings],
  );
  const calculatedNutrition = useMemo(
    () => activeDough ? calculateLiveCookieNutrition(activeDough, activeToppings, sizeGrams, components) : null,
    [activeDough, activeToppings, components, sizeGrams],
  );
  const nutrition = calculatedNutrition ?? {
    baseWeight: 0, weight: 0, doughWeight: 0, toppingWeight: 0, toppingAmounts: {},
    calories: 0, protein: 0, carbohydrates: 0, fat: 0, sugar: 0,
  };
  const selectedToppings = toppingOptions.filter(({ id }) => activeToppings.includes(id));
  const selectedNames = selectedToppings.map(({ name }) => name);
  const allergenNames = [...new Set([...(selectedDough?.allergens ?? []), ...selectedToppings.flatMap(({ allergens }) => allergens)])];
  const toppingCapacity = getToppingCapacity(sizeGrams);
  const remainingCapacity = Math.max(0, Number((toppingCapacity - nutrition.toppingWeight).toFixed(1)));
  const hasBlockedToppings = toppingOptions.some(({ id }) => !activeToppings.includes(id) && !canAddLiveTopping(activeToppings, id, sizeGrams, components));
  const toppingGroups = [...new Set(toppingOptions.map((option) => option.group || ""))];
  const cookiePrice = useMemo(
    () => connected && activeDough && calculatedNutrition
      ? calculateCookiePrice(activeDough, activeToppings, sizeGrams, components, currency, pricingMarkupPercent, customCookieFixedCost, priceRoundingIncrement)
      : null,
    [activeDough, activeToppings, calculatedNutrition, connected, components, currency, customCookieFixedCost, priceRoundingIncrement, pricingMarkupPercent, sizeGrams],
  );
  const displayCookiePrice = cookiePrice === null ? null : Math.round(toDisplayTomans(cookiePrice, currency));

  function toggleTopping(id: ToppingId, enabled: boolean) {
    setCartLimitMessage("");
    setToppings((current) => {
      const available = current.filter((item) => toppingOptions.some((option) => option.id === item));
      if (!enabled) return available.filter((item) => item !== id);
      return canAddLiveTopping(available, id, sizeGrams, components) ? [...available, id] : available;
    });
  }

  function buildAndAddCookie() {
    if (!activeDough || !calculatedNutrition) return;
    const result = addCookie({ doughId: activeDough, sizeGrams, toppingIds: activeToppings, nutrition: calculatedNutrition });
    if (result !== "added") {
      setCartLimitMessage(result === "quantity-limit"
        ? `از این ترکیب حداکثر ${MAX_CART_LINE_QUANTITY} عدد می‌توانی در سبد داشته باشی.`
        : `سبد حداکثر ${MAX_CART_LINES} ترکیب متفاوت می‌پذیرد؛ برای افزودن این کوکی، یک قلم را حذف کن.`);
      return;
    }
    setCartLimitMessage("");
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- The cart is persisted synchronously before this full navigation.
    window.location.assign("/cart");
  }

  function resetBuilder() {
    setCartLimitMessage("");
    setDough(doughOptions[0]?.id ?? "");
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
                onClick={() => {
                  setCartLimitMessage("");
                  setSizeGrams(preset.grams);
                }}
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
              onValueChange={(value) => {
                setCartLimitMessage("");
                setSizeGrams(value[0] ?? 50);
              }}
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
                value={activeDough}
                onValueChange={(value) => {
                  setCartLimitMessage("");
                  setDough(value as DoughId);
                }}
              >
                {loading && <p role="status">در حال دریافت خمیرها و افزودنی‌های فعال از ERPNext…</p>}
                {!loading && (!connected || error) && <p role="status">ارتباط کاتالوگ برقرار نیست؛ برای جلوگیری از نمایش اطلاعات نمونه، فعلاً امکان ساخت کوکی وجود ندارد.</p>}
                {!loading && connected && doughOptions.length === 0 && <p role="status">هنوز خمیر فعالی در کاتالوگ ERPNext برای سازنده منتشر نشده است.</p>}
                {doughOptions.map((option) => (
                  <label className={`${styles.doughOption} ${activeDough === option.id ? styles.selectedDough : ""}`} key={option.id} htmlFor={`dough-${encodeURIComponent(option.id)}`}>
                    {option.image || getBuilderVisual("Dough", option.id).imagePath
                      ? <img className={styles.doughSwatch} src={option.image || getBuilderVisual("Dough", option.id).imagePath!} alt="" width={48} height={48} loading="lazy" />
                      : <span className={styles.doughSwatch} style={{ backgroundColor: option.visualColor }} aria-hidden="true" />}
                    <span className={styles.optionCopy}>
                      <strong>{option.name}</strong>
                      <small>{option.note}</small>
                      <span className={styles.baseIngredients}>{option.ingredients.join(" · ")}</span>
                    </span>
                    <RadioGroupItem className={styles.radio} id={`dough-${encodeURIComponent(option.id)}`} value={option.id} aria-label={option.name} />
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
                  <strong>{formatPersianNumber(activeToppings.length)} از {formatPersianNumber(MAX_TOPPING_COUNT)} افزودنی</strong>
                  <span>{formatPersianNumber(nutrition.toppingWeight)} از {formatPersianNumber(toppingCapacity)} گرم</span>
                </div>
                <progress value={nutrition.toppingWeight} max={toppingCapacity} aria-label="ظرفیت وزنی تاپینگ‌ها" />
                <p id="topping-capacity-help">{hasBlockedToppings
                  ? "برای انتخاب گزینه‌های غیرفعال، یکی از افزودنی‌های انتخابی را بردار."
                  : `${formatPersianNumber(remainingCapacity)} گرم ظرفیت افزودنی باقی مانده است.`}</p>
              </div>
              <div className={styles.groups}>
                {toppingGroups.map((group, groupIndex) => {
                  const options = toppingOptions.filter((option) => option.group === group);
                  const selectedCount = options.filter((option) => activeToppings.includes(option.id)).length;
                  return (
                    <section className={styles.toppingGroup} key={`${group}-${groupIndex}`} aria-labelledby={`group-${groupIndex}`}>
                      <div className={styles.groupHeading}>
                        <div><h3 id={`group-${groupIndex}`}>{getLiveToppingGroupTitle(group)}</h3></div>
                        <span className={styles.groupCount}>{formatPersianNumber(selectedCount)} انتخاب</span>
                      </div>
                      <div className={styles.toppingOptions}>
                        {options.map((option) => {
                          const checked = activeToppings.includes(option.id);
                          const inputId = `topping-${option.id}`;
                          const amount = checked
                            ? nutrition.toppingAmounts[option.id] ?? 0
                            : getLiveToppingAmount(option.id, sizeGrams, components) ?? 0;
                          const calories = Math.round(option.recipe.calories * amount / 100);
                          const blocked = !checked && !canAddLiveTopping(activeToppings, option.id, sizeGrams, components);
                          const visual = getBuilderVisual(option.kind, option.id);
                          return (
                            <div className={`${styles.toppingOption} ${checked ? styles.selectedTopping : ""} ${blocked ? styles.blockedTopping : ""}`} key={option.id}>
                              <Checkbox
                                className={styles.checkbox}
                                id={inputId}
                                checked={checked}
                                disabled={blocked}
                                aria-label={`${option.name}، افزودن به کوکی`}
                                aria-describedby={blocked ? "topping-capacity-help" : undefined}
                                onCheckedChange={(value) => toggleTopping(option.id, value === true)}
                              />
                              {option.image || visual.imagePath
                                ? <img className={styles.toppingSwatch} src={option.image || visual.imagePath!} alt="" width={32} height={32} loading="lazy" />
                                : <span className={styles.toppingSwatch} style={{ backgroundColor: option.visualColor, borderRadius: "50%" }} aria-hidden="true" />}
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
              <span>در اطلاعات ERPNext: {allergenNames.length ? allergenNames.join("، ") : "مادهٔ حساسیت‌زایی ثبت نشده"}. آلودگی متقاطع باید با آشپزخانه بررسی شود.</span>
            </div>
            <p className={styles.estimateDisclaimer}>کالری و مقدار مواد تخمینی‌اند و با دستور واقعی، وزن‌کشی و پخت تغییر می‌کنند. تخم‌مرغ جزو بعضی خمیرهاست، نه تاپینگ.</p>

            <div className={styles.formActions}>
              <Button className={styles.buildButton} type="button" onClick={buildAndAddCookie} disabled={!ready || !connected || !selectedDough || !calculatedNutrition || !ordersEnabled || cookiePrice === null}>
                <ShoppingBasket size={18} aria-hidden="true" /> {!ready ? "در حال آماده‌سازی سبد…" : loading ? "در حال دریافت کاتالوگ…" : !connected ? "اتصال ERPNext در دسترس نیست" : !selectedDough ? "خمیر قابل انتخابی در ERPNext منتشر نشده" : !ordersEnabled ? "پذیرش سفارش فعلاً غیرفعال است" : cookiePrice === null ? "قیمت این ترکیب هنوز آماده نیست" : "این کوکی را بساز و به سبد ببر"}
              </Button>
              <Button className={styles.resetButton} variant="ghost" type="button" onClick={resetBuilder}>از نو</Button>
            </div>
            {cartLimitMessage && <p className={styles.cartLimitMessage} role="alert">{cartLimitMessage}</p>}
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
                customDough={activeDough}
                customToppings={activeToppings}
                customSize={sizeGrams}
                customDoughName={selectedDough?.name}
                customDoughImage={selectedDough?.image}
                customToppingNames={selectedToppings.map(({ name }) => name)}
              />
              <div className={styles.cookieName}>
                <strong>{selectedDough?.name ?? "یک خمیر فعال از ERPNext انتخاب کن"} · بیس {formatPersianNumber(sizeGrams)} گرم</strong>
                <span>{selectedNames.length ? selectedNames.join(" · ") : "فقط خمیر پایه"}</span>
              </div>
              <p className={styles.previewEstimate}>مدل سه‌بعدی برای نمایش تقریبی رنگ و چیدمان مواد است.</p>
            </div>

            <div className={styles.calorieCard}>
              <div className={styles.priceEstimate} role="status" aria-live="polite">
                <div><span>قیمت این ترکیب</span><strong>{displayCookiePrice === null ? "در انتظار نرخ‌های فروشگاه" : formatToman(displayCookiePrice)}</strong></div>
                <p>{displayCookiePrice === null
                  ? "برای نمایش مبلغ دقیق، فروشگاه باید بهای واقعی خمیر و افزودنی‌ها، درصد افزوده و دستور تأییدشده را در ERPNext تکمیل کند."
                  : "بهای مواد + هزینهٔ ثابت ساخت و بسته‌بندی، سپس درصد افزودهٔ فروشگاه و گردکردن رو به بالا؛ هزینهٔ ارسال جداست."}</p>
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
                <p><strong>خمیر:</strong> {selectedDough?.ingredients.join("، ") || "از اطلاعات کاتالوگ انتخاب نشده"}</p>
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
