"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Keep native route transitions stable in the preview. */

import {
  ArrowLeft,
  BadgeInfo,
  Clock3,
  ClipboardList,
  Cookie,
  CreditCard,
  FileText,
  HardDrive,
  HelpCircle,
  MapPin,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { CommerceFooter } from "@/components/smule/CommerceFooter";
import { CommerceHeader } from "@/components/smule/CommerceHeader";
import { PrivacyDataControls } from "@/components/smule/PrivacyDataControls";
import { STORE_INFO_CONTENT } from "@/lib/smule/site-content";
import styles from "./StoreInfoPage.module.css";

type InfoPageKind = keyof typeof STORE_INFO_CONTENT;

const icons = {
  about: [Cookie, Sparkles, BadgeInfo],
  pickup: [MapPin, ArrowLeft, BadgeInfo],
  faq: [],
  contact: [HelpCircle, Cookie, MapPin],
  privacy: [ShieldCheck, HardDrive, Trash2, UserRound],
  terms: [BadgeInfo, Cookie, CreditCard],
  returns: [ClipboardList, Clock3, CreditCard],
} satisfies Record<InfoPageKind, typeof Cookie[]>;

const pageIcons = {
  about: Cookie,
  pickup: MapPin,
  faq: HelpCircle,
  contact: MessageCircle,
  privacy: ShieldCheck,
  terms: FileText,
  returns: RotateCcw,
} satisfies Record<InfoPageKind, LucideIcon>;

export function StoreInfoPage({ kind }: { kind: InfoPageKind }) {
  const content = STORE_INFO_CONTENT[kind];
  const Icon = pageIcons[kind];
  const sectionIcons = icons[kind];

  return (
    <div className={`${styles.page} commerce-page`}>
      <div className={styles.shell}>
        <CommerceHeader />
        <main id="main-content" className={styles.main}>
          <a className={styles.backLink} href="/menu"><ArrowLeft size={16} aria-hidden="true" /> بازگشت به منو</a>
          <section className={styles.hero}>
            <div className={styles.heroIcon}><Icon size={26} strokeWidth={1.8} aria-hidden="true" /></div>
            <p>{content.eyebrow}</p>
            <h1>{content.title.split("\n").map((line, index) => <span key={line}>{index ? <em>{line}</em> : line}<br /></span>)}</h1>
            <div className={styles.lead}>{content.lead}</div>
          </section>

          <aside className={styles.notice} role="note">
            <BadgeInfo size={20} aria-hidden="true" />
            <p>{content.notice}</p>
          </aside>

          {content.questions ? (
            <section className={styles.questions} aria-label="پرسش‌های پرتکرار">
              {content.questions.map((item, index) => (
                <details className={styles.question} key={item.question} open={index === 0}>
                  <summary><span>{item.question}</span><b aria-hidden="true">+</b></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          ) : (
            <section className={styles.cards} aria-label={content.eyebrow}>
              {content.sections.map((section, index) => {
                const CardIcon = sectionIcons[index] ?? Cookie;
                return <article className={styles.card} key={section.title}>
                  <span className={styles.cardIcon}><CardIcon size={20} aria-hidden="true" /></span>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                  {section.detail && <small>{section.detail}</small>}
                </article>;
              })}
            </section>
          )}

          {kind === "privacy" && <PrivacyDataControls />}

          {content.action && <a className={styles.action} href={content.action.href}>{content.action.label}<ArrowLeft size={18} aria-hidden="true" /></a>}
        </main>
      </div>
      <CommerceFooter />
    </div>
  );
}
