"use client";

import { useEffect, useRef, useState } from "react";
import { CookieCanvas } from "./CookieCanvas";
export { CookieCanvas } from "./CookieCanvas";

const storySteps = [
  {
    number: "۰۱",
    eyebrow: "شروع ماجرا",
    title: "یک شروع ساده، هزار ترکیب ممکن.",
    text: "قصه‌ی این کوکی با خمیر وانیلی شروع می‌شود. این فقط یکی از پایه‌هایی است که می‌توانیم برای ترکیب دلخواهت آماده کنیم.",
    note: "پایه‌ی وانیلی",
  },
  {
    number: "۰۲",
    eyebrow: "وقتِ ترکیب",
    title: "وانیل و کاکائو، یک رقصِ ماربل.",
    text: "دو خمیر در هم می‌پیچند؛ نه کاملاً وانیلی، نه کاملاً شکلاتی. رگه‌های ماربل، هر گاز را کمی متفاوت می‌کنند.",
    note: "دو خمیر، یک کوکی",
  },
  {
    number: "۰۳",
    eyebrow: "نقطه‌ی شیطنت",
    title: "شکلات باید تکه‌های واقعی داشته باشد.",
    text: "نه قطره‌ی بی‌هویت؛ تکه‌های بزرگ شکلات تلخ که داخل فر آرام آب می‌شوند و گوشه‌هایشان کمی برشته می‌ماند.",
    note: "شکلات تلخ واقعی",
  },
  {
    number: "۰۴",
    eyebrow: "یک لایه‌ی تازه",
    title: "حالا نوبتِ گردوست.",
    text: "تکه‌های گردو میان شکلات‌ها می‌نشینند؛ کمی عطر، کمی تردی و یک بافت تازه. برای ترکیب تو، می‌توانیم سراغ مغزها و تاپینگ‌های دیگری هم برویم.",
    note: "گردو، با بافت طبیعی",
  },
  {
    number: "۰۵",
    eyebrow: "لحظه‌ی اسموله",
    title: "این قصه، می‌تواند سلیقه‌ی تو باشد.",
    text: "ماربلِ شکلات و گردو، با لبه‌های برشته و چند دانه نمک؛ فقط یک نمونه از کوکی‌هایی که می‌توانیم بسازیم. ترکیب مخصوصت را با ما در میان بگذار.",
    note: "ماربل شکلات و گردو",
  },
];

export function CookieStorySection() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const first = stepRefs.current[0]?.getBoundingClientRect();
      const last = stepRefs.current[storySteps.length - 1]?.getBoundingClientRect();
      if (!first || !last) return;
      // The reading line sits below the pinned model on compact screens.
      const line = window.innerHeight * (window.innerWidth <= 980 ? .75 : .55);
      const progress = Math.max(0, Math.min(1, (line - first.top - 90) / Math.max(last.top - first.top, 1)));
      progressRef.current = progress;
      setActiveStep(Math.round(progress * (storySteps.length - 1)));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const layout = new ResizeObserver(schedule);
    stepRefs.current.forEach((element) => element && layout.observe(element));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      layout.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section id="story" className="story-section" aria-label="داستان ساخته‌شدن کوکی اسموله">
      <div className="container story-grid">
        <div className="story-visual">
          <div className="story-sticky">
            <div className="story-visual-label">
              <span className="story-live-dot" aria-hidden="true" />
              ماربل شکلات و گردو
            </div>
            <CookieCanvas variant="marble-walnut" progressRef={progressRef} />
            <p className="story-current-flavor">{storySteps[activeStep].note}</p>
            <div className="story-progress" aria-label={`مرحله ${activeStep + 1} از ${storySteps.length}`}>
              {storySteps.map((step, index) => (
                <span key={step.number} className={index === activeStep ? "is-active" : ""} />
              ))}
            </div>
          </div>
        </div>
        <div className="story-steps">
          <div className="story-heading">
            <p className="eyebrow eyebrow-dark"><span /> با اسکرول ساخته می‌شود</p>
            <h2>هر کوکی،<br /><em>یک مسیر دارد.</em></h2>
            <p className="story-heading-copy">این فقط یک کوکی آماده نیست؛ اسموله می‌تواند ترکیب هر سلیقه را از پایه تا تاپینگ برایت بسازد.</p>
            <a className="story-heading-link" href="/build-cookie">کوکی مخصوص خودت را بساز <span aria-hidden="true">←</span></a>
          </div>
          {storySteps.map((step, index) => (
            <article
              className={`story-step ${activeStep === index ? "is-active" : ""}`}
              data-step={index}
              key={step.number}
              ref={(element) => { stepRefs.current[index] = element; }}
            >
              <span className="story-step-number">{step.number}</span>
              <div>
                <p className="story-step-eyebrow">{step.eyebrow}</p>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="story-step-note">{step.note}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="container story-capability" aria-label="امکان ساخت کوکی سفارشی">
        <div>
          <span className="story-capability-kicker">سفارشی، به سبک اسموله</span>
          <strong>پایه، ترکیب، تاپینگ و طعم‌دهنده را تو می‌گویی؛ ما می‌پزیم.</strong>
        </div>
        <div className="story-capability-tags" aria-label="گزینه‌های قابل سفارش">
          <span>آرد و خمیر</span><span>ترکیب‌های خاص</span><span>تاپینگ</span><span>رژیمی</span>
        </div>
      </div>
    </section>
  );
}
