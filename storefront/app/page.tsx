"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native anchors avoid broken Vinext client transitions in this preview. */

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Cookie,
  ShoppingBasket,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useCookieCart } from "@/components/smule/CartProvider";
import { useStorefrontData } from "@/components/smule/StorefrontDataProvider";
import { CookieCanvas, CookieStorySection } from "@/components/smule/CookieStory";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { formatPersianNumber, formatToman, type SmuleProduct } from "@/lib/smule/products";

const ingredients = [
  { label: "کره‌ی خالص", note: "نرم و طلایی", className: "ingredient-butter", tx: "190px", ty: "210px" },
  { label: "شکلات تلخ", note: "تکه‌های بزرگ", className: "ingredient-chocolate", tx: "-190px", ty: "170px" },
  { label: "شکر قهوه‌ای", note: "عطر کاراملی", className: "ingredient-sugar", tx: "210px", ty: "-145px" },
  { label: "آرد", note: "بافت نرم", className: "ingredient-flour", tx: "-190px", ty: "-120px" },
];

function BrandMark() {
  return (
    <a className="brand-mark" href="#top" aria-label="اسموله، صفحه اصلی">
      <span className="brand-icon" aria-hidden="true">
        <Cookie size={20} strokeWidth={2.4} />
      </span>
      <span>
        <strong>smule</strong>
        <small>اسموله</small>
      </span>
    </a>
  );
}

function IngredientChip({ item }: { item: (typeof ingredients)[number] }) {
  const style = {
    "--tx": item.tx,
    "--ty": item.ty,
  } as CSSProperties;

  return (
    <div className={`ingredient-chip ${item.className}`} style={style}>
      <span className="ingredient-dot" aria-hidden="true" />
      <span>
        <strong>{item.label}</strong>
        <small>{item.note}</small>
      </span>
    </div>
  );
}

function ProductCard({ product }: { product: SmuleProduct }) {
  return (
    <article className={`product-card ${product.className}`}>
      <div className="product-card-topline">
        <span>{product.number}</span>
        <span className="product-tag">{product.isSample ? "نمونهٔ نمایشی" : "طعم اسموله"}</span>
      </div>
      <div className="product-art" aria-hidden="true">
        <span className="product-glow" />
        <img src={product.image} alt="" style={{ filter: product.imageFilter }} />
      </div>
      <div className="product-info">
        <div>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
        <div className="product-bottom">
          <strong>{formatToman(product.price)}</strong>
          <div className="product-actions">
            <a className="product-detail-link" href={`/menu/product?slug=${encodeURIComponent(product.slug)}`}>جزئیات</a>
            <a className="text-link" href={`/menu/product?slug=${encodeURIComponent(product.slug)}`}>سفارش <ArrowLeft size={17} aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { itemCount, ready } = useCookieCart();
  const { products, connected, loading } = useStorefrontData();
  const [replayKey, setReplayKey] = useState(0);
  const [assembled, setAssembled] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setAssembled(true), 2500);
    return () => window.clearTimeout(timeout);
  }, [replayKey]);

  const replayAssembly = () => {
    setAssembled(false);
    setReplayKey((current) => current + 1);
  };

  return (
    <div id="top" className="site-shell">
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <main id="main-content">
      <section className="hero-section">
        <div className="container">
          <header className="site-header">
            <BrandMark />
            <nav className="desktop-nav" aria-label="ناوبری اصلی">
              <a href="/menu">طعم‌ها</a>
              <a href="#story">داستان اسموله</a>
              <a href="/build-cookie">ساخت کوکی</a>
              <a href="#order">سفارش</a>
            </nav>
            <div className="header-actions">
              <a className="header-account" href="/account" aria-label="حساب کاربری">
                <UserRound size={18} aria-hidden="true" />
                <span>حساب</span>
              </a>
              <a className="header-order" href="/menu">
                منوی کوکی‌ها <ArrowLeft size={16} aria-hidden="true" />
              </a>
              <a className="header-cart" href="/cart" aria-label={`سبد خرید، ${formatPersianNumber(itemCount)} عدد`}>
                <ShoppingBasket size={18} aria-hidden="true" />
                <span>سبد</span>
                {ready && itemCount > 0 && <b>{formatPersianNumber(itemCount)}</b>}
              </a>
            </div>
          </header>

          <div className="hero-grid">
            <div className="hero-stage-wrap">
              <div className="assembly-stage" aria-label="انیمیشن ساخت کوکی از مواد اولیه">
                <div className="stage-orbit orbit-one" />
                <div className="stage-orbit orbit-two" />
                <div key={replayKey} className="assembly-motion">
                  {ingredients.map((item) => <IngredientChip key={item.label} item={item} />)}
                  <div className="cookie-puff puff-one" />
                  <div className="cookie-puff puff-two" />
                  <CookieCanvas variant="chocolate" className="hero-cookie-canvas" />
                </div>
                <div className="stage-caption">
                  <span className="stage-dot" aria-hidden="true" />
                  <span>{assembled ? "آماده‌ی اولین گاز" : "مواد اولیه کنار هم می‌آیند"}</span>
                </div>
              </div>
              <button className="replay-button" type="button" onClick={replayAssembly}>
                <Sparkles size={17} aria-hidden="true" />
                دوباره بساز
              </button>
            </div>

            <div className="hero-copy">
              <p className="eyebrow"><span /> منوی کوکی و ترکیب دلخواه</p>
              <h1>کوکی‌ای که<br /><em>خودش را می‌سازد.</em></h1>
              <p className="hero-description">
                طعم آماده‌ات را از منو پیدا کن یا وزن، خمیر و افزودنی‌های کوکی دلخواهت را انتخاب کن؛ پیش‌نمایش زنده ترکیبت را نشان می‌دهد.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="/menu">
                  طعم‌ها را ببین <ArrowLeft size={19} aria-hidden="true" />
                </a>
                <a className="button button-ghost" href="/build-cookie">
                  کوکی‌ام را بساز <Sparkles size={18} aria-hidden="true" />
                </a>
              </div>
              <div className="hero-note">
                <span className="note-check"><Check size={14} aria-hidden="true" /></span>
                <span>ترکیبات، قیمت‌ها و ارزش غذایی تا زمان تأیید فروشگاه نمونه‌اند.</span>
              </div>
            </div>
          </div>
        </div>
        <a className="scroll-cue" href="#products" aria-label="رفتن به طعم‌های اسموله">
          <span>پایین‌تر، طعم‌ها منتظرند</span>
          <ChevronDown size={18} aria-hidden="true" />
        </a>
      </section>

      <CookieStorySection />

      <section className="trust-strip" aria-label="ویژگی‌های اسموله">
        <div className="container trust-grid">
          <div><strong>۰۱</strong><span>منوی طعم‌های آماده</span></div>
          <div><strong>۰۲</strong><span>پیش‌نمایش زندهٔ ترکیب</span></div>
          <div><strong>۰۳</strong><span>مرور روش دریافت</span></div>
        </div>
      </section>

      <section id="products" className="products-section section-light">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow-dark"><span /> منوی اسموله</p>
              <h2>کدام طعم،<br /><em>امروزت را بهتر می‌کند؟</em></h2>
            </div>
            <p>هر کوکی با همان ترکیب ساده‌ای شروع می‌شود که دوستش داریم: مواد خوب، زمان کافی و یک فرِ داغ.</p>
            <small className="product-data-note">قیمت و ارزش غذاییِ منو در این نسخه نمونه است.</small>
          </div>
          <div className="product-grid">
            {products.length ? products.map((product) => <ProductCard key={product.slug} product={product} />) : (
              <div className="catalog-empty" role="status">
                <strong>{loading ? "منوی اسموله را می‌آوریم…" : connected ? "هنوز طعمی برای نمایش فعال نشده" : "فهرست فروشگاه در دسترس نیست"}</strong>
                <span>{connected ? "پس از ثبت کالا و قیمت تأییدشده در ERPNext، طعم‌ها همین‌جا نمایش داده می‌شوند." : "اتصال فروشگاه را بررسی کن؛ فعلاً جزئیات سفارش در دسترس نیست."}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="process" className="process-section">
        <div className="container process-layout">
          <div className="process-intro">
            <p className="eyebrow"><span /> راه سادهٔ انتخاب</p>
            <h2>از منو،<br /><em>تا ترکیب تو.</em></h2>
            <p>طعم آماده را بررسی کن، یا مرحله‌به‌مرحله خمیر و افزودنی‌های ترکیب دلخواهت را انتخاب کن.</p>
            <a className="button button-light" href="/build-cookie">کوکی خودت را بساز <ArrowLeft size={18} aria-hidden="true" /></a>
          </div>
          <div className="process-list">
            <article className="process-item">
              <span className="process-number">۰۱</span>
              <div><h3>از منو انتخاب کن</h3><p>ترکیبات و اطلاعات هر طعم آماده را پیش از افزودن به سبد ببین.</p></div>
              <Sparkles size={24} aria-hidden="true" />
            </article>
            <article className="process-item">
              <span className="process-number">۰۲</span>
              <div><h3>یا ترکیب خودت را بساز</h3><p>وزن بیس، نوع خمیر و افزودنی‌ها را انتخاب کن و پیش‌نمایش را زنده ببین.</p></div>
              <Clock3 size={24} aria-hidden="true" />
            </article>
            <article className="process-item">
              <span className="process-number">۰۳</span>
              <div><h3>سبد را مرور کن</h3><p>اقلام و روش دریافت را بررسی کن؛ سفارش واقعی پس از اتصال فروشگاه فعال می‌شود.</p></div>
              <Check size={24} aria-hidden="true" />
            </article>
          </div>
        </div>
      </section>

      <section id="order" className="order-section">
        <div className="container order-card">
          <div>
            <p className="eyebrow eyebrow-dark"><span /> یک جعبه برای امروز</p>
            <h2>کوکی دلخواهت،<br /><em>در یک نگاه.</em></h2>
          </div>
          <div className="order-copy">
            <p>از منوی کوکی‌ها شروع کن یا ترکیب دلخواهت را بساز و نتیجه را در پیش‌نمایش ببین.</p>
            <a className="button button-dark" href="/build-cookie">کوکی خودم را بساز <ArrowLeft size={19} aria-hidden="true" /></a>
            <small>اطلاعات نهایی فروش و سفارش پس از تکمیل تنظیمات فروشگاه فعال می‌شود.</small>
          </div>
        </div>
      </section>

      </main>
      <CommerceFooter />
    </div>
  );
}
