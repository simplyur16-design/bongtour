"use client";

import Link from "next/link";
import { useState } from "react";
import { simplyurPath } from "@/lib/simplyur/constants";
import { SIMPLYUR_GUIDE_DESIGN as D } from "@/lib/simplyur/guide-design";
import type { SimplyurGuideMessages, SimplyurGuideMockRow, SimplyurGuidePrecheckCard, SimplyurGuideStepCard } from "@/lib/simplyur/guide-types";
import {
  guideAndroidStepCards,
  guideFaqItems,
  guideIphoneStepCards,
  guidePhaseBanner,
  guidePrecheckCards,
} from "@/lib/simplyur/guide-view-model";
import { useSimplyurIntl } from "@/components/simplyur/SimplyurIntlProvider";

type TabKey = "precheck" | "iphone" | "android";

type Props = {
  guide: SimplyurGuideMessages;
};

function NoteCallout({ text }: { text: string }) {
  return (
    <div
      className="mt-1 flex gap-2 rounded-xl border px-3 py-2.5"
      style={{ backgroundColor: D.bannerBg, borderColor: D.bannerBorder }}
    >
      <span className="text-[13px]" aria-hidden>
        💡
      </span>
      <p className="text-[12.5px] leading-relaxed" style={{ color: D.navy }}>
        {text}
      </p>
    </div>
  );
}

function SettingsMockup({ rows }: { rows: SimplyurGuideMockRow[] }) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border p-2.5"
      style={{ backgroundColor: D.mockBg, borderColor: D.mockBorder }}
    >
      {rows.map((row) => (
        <div
          key={`${row.label}-${row.value}`}
          className="flex items-center justify-between rounded-lg px-2.5 py-2"
          style={{
            backgroundColor: row.highlight ? D.bg : "transparent",
            border: `1.5px solid ${row.highlight ? D.coral : "transparent"}`,
          }}
        >
          <span className="text-[12.5px] font-semibold" style={{ color: row.highlight ? D.navy : D.navy }}>
            {row.label}
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: D.faint }}>
            {row.value}
            <span style={{ color: D.mockChevron }}>›</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item} className="relative pl-3.5 text-sm leading-relaxed" style={{ color: D.muted }}>
          <span className="absolute left-0">–</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function PrecheckCard({
  card,
  devicesHref,
  devicesLabel,
}: {
  card: SimplyurGuidePrecheckCard;
  devicesHref: string;
  devicesLabel: string;
}) {
  return (
    <article
      className="flex flex-col gap-2 border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      <h3 className="text-[15px] font-bold" style={{ color: D.navy }}>
        {card.title}
      </h3>
      {card.body ? (
        <p className="text-sm leading-relaxed" style={{ color: D.muted }}>
          {card.body}
        </p>
      ) : null}
      {card.bullets?.length ? <BulletList items={card.bullets} /> : null}
      {card.linkLabel ? (
        <Link href={devicesHref} className="mt-0.5 text-[13px] font-semibold" style={{ color: D.coral }}>
          {devicesLabel} →
        </Link>
      ) : null}
      {card.note ? <NoteCallout text={card.note} /> : null}
    </article>
  );
}

function StepCard({ step }: { step: SimplyurGuideStepCard }) {
  return (
    <article
      className="flex flex-col gap-2 border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      <h3 className="text-base font-bold" style={{ color: D.navy }}>
        {step.title}
      </h3>
      {step.mockRows?.length ? <SettingsMockup rows={step.mockRows} /> : null}
      {step.bullets?.length ? <BulletList items={step.bullets} /> : null}
      {step.note ? <NoteCallout text={step.note} /> : null}
    </article>
  );
}

/** design_handoff_guide — Install guide tab (iOS + Android app + web). */
export function SimplyurGuidePanel({ guide }: Props) {
  const { locale } = useSimplyurIntl();
  const [tab, setTab] = useState<TabKey>("precheck");
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(() => new Set());

  const tabs: { key: TabKey; label: string }[] = [
    { key: "precheck", label: guide.tabs.precheck },
    { key: "iphone", label: guide.tabs.iphone },
    { key: "android", label: guide.tabs.android },
  ];

  const phaseBanner = guidePhaseBanner(guide);
  const precheck = guidePrecheckCards(guide);
  const iphoneSteps = guideIphoneStepCards(guide);
  const androidSteps = guideAndroidStepCards(guide);
  const faqs = guideFaqItems(guide);
  const devicesHref = simplyurPath(locale, "/devices");
  const devicesLabel = guide.devicesLinkLabel ?? "Compatible devices";

  function toggleFaq(index: number) {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const stepCards = tab === "iphone" ? iphoneSteps : androidSteps;

  return (
    <div className="flex flex-col" style={{ gap: D.sectionGap }}>
      <header className="flex flex-col gap-2.5">
        <h1 className="text-[26px] font-extrabold tracking-tight" style={{ color: D.navy }}>
          {guide.title}
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: D.muted }}>
          {guide.intro}
        </p>
        <p className="text-xs" style={{ color: D.faint }}>
          {guide.supportHint}
        </p>
      </header>

      {phaseBanner ? (
        <div
          className="flex gap-2.5 rounded-[14px] border px-4 py-3.5"
          style={{ backgroundColor: D.bannerBg, borderColor: D.bannerBorder }}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: D.coral }}
            aria-hidden
          >
            i
          </span>
          <p className="text-xs leading-relaxed" style={{ color: D.muted }}>
            {phaseBanner}
          </p>
        </div>
      ) : null}

      <div className="flex gap-2" role="tablist" aria-label={guide.title}>
        {tabs.map(({ key, label }) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(key)}
              className="flex-1 text-sm font-semibold transition"
              style={{
                height: D.segmentHeight,
                borderRadius: D.segmentRadius,
                border: `1.5px solid ${selected ? D.coral : D.border}`,
                backgroundColor: selected ? D.coral : "transparent",
                color: selected ? "#fff" : D.faint,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="flex flex-col gap-3">
        {tab === "precheck"
          ? precheck.map((card) => (
              <PrecheckCard
                key={card.title}
                card={card}
                devicesHref={devicesHref}
                devicesLabel={devicesLabel}
              />
            ))
          : stepCards.map((step) => <StepCard key={step.title} step={step} />)}
      </div>

      <section aria-labelledby="su-guide-faq">
        <h2 id="su-guide-faq" className="text-lg font-extrabold" style={{ color: D.navy }}>
          {guide.faqTitle}
        </h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {faqs.map(({ q, a }, index) => {
            const open = openFaqs.has(index);
            return (
              <div
                key={q}
                className="overflow-hidden border bg-white"
                style={{ borderColor: D.border, borderRadius: D.faqRadius }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-2.5 px-4 py-3.5 text-left"
                >
                  <span className="text-sm font-bold" style={{ color: D.navy }}>
                    {q}
                  </span>
                  <span
                    className="text-[13px] transition-transform"
                    style={{ color: D.faint, transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                    aria-hidden
                  >
                    ⌄
                  </span>
                </button>
                {open ? (
                  <p className="px-4 pb-3.5 text-[13px] leading-relaxed" style={{ color: D.muted }}>
                    {a}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
