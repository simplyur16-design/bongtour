"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, Settings2 } from "lucide-react";
import type {
  SimplyurGuideBlock,
  SimplyurGuideFaq,
  SimplyurGuideMessages,
  SimplyurGuideStep,
} from "@/lib/simplyur/guide-types";

type TabKey = "precheck" | "iphone" | "android";

type Props = {
  guide: SimplyurGuideMessages;
};

function GuideBlockView({ block }: { block: SimplyurGuideBlock }) {
  return (
    <div className="space-y-3">
      {block.heading ? (
        <p className="font-semibold text-[color:var(--su-ink)]">{block.heading}</p>
      ) : null}
      {block.paras?.map((para) => (
        <p key={para} className="text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
          {para}
        </p>
      ))}
      {block.bullets?.length ? (
        <ul className="space-y-2 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
          {block.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--su-celadon)]" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {block.note ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {block.note}
        </div>
      ) : null}
    </div>
  );
}

function GuideStepsSection({ title, steps }: { title: string; steps: SimplyurGuideStep[] }) {
  return (
    <section aria-labelledby="su-guide-steps">
      <h2
        id="su-guide-steps"
        className="flex items-center gap-2 text-lg font-bold text-[color:var(--su-ink)]"
      >
        <Settings2 className="h-5 w-5 text-[color:var(--su-celadon)]" aria-hidden />
        {title}
      </h2>
      <ol className="mt-6 space-y-6">
        {steps.map((step, idx) => (
          <li key={step.title} className="flex gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--su-celadon)] text-sm font-bold text-white"
              aria-hidden
            >
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-[color:var(--su-ink)]">{step.title}</h3>
              <div className="mt-2 space-y-3">
                {step.blocks.map((block, blockIdx) => (
                  <GuideBlockView key={`${step.title}-${blockIdx}`} block={block} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GuideFaqSection({
  title,
  faqs,
  openFaq,
  setOpenFaq,
}: {
  title: string;
  faqs: SimplyurGuideFaq[];
  openFaq: string | null;
  setOpenFaq: (q: string | null) => void;
}) {
  if (faqs.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="su-guide-faq">
      <h2
        id="su-guide-faq"
        className="flex items-center gap-2 text-lg font-bold text-[color:var(--su-ink)]"
      >
        <HelpCircle className="h-5 w-5 text-[color:var(--su-celadon)]" aria-hidden />
        {title}
      </h2>
      <div className="mt-4 space-y-2">
        {faqs.map(({ q, a }) => {
          const open = openFaq === q;
          return (
            <div key={q} className="su-card overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setOpenFaq(open ? null : q)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-[color:var(--su-ink)] transition hover:bg-[color:var(--su-hanji-warm)]"
                aria-expanded={open}
              >
                <span>{q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[color:var(--su-ink-muted)] transition ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="border-t border-[color:var(--su-hanji-border)] px-4 py-3 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
                  {a}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function SimplyurGuideClient({ guide }: Props) {
  const [tab, setTab] = useState<TabKey>("precheck");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "precheck", label: guide.tabs.precheck },
    { key: "iphone", label: guide.tabs.iphone },
    { key: "android", label: guide.tabs.android },
  ];

  const mainFaqs = [...guide.precheckFaq, ...guide.commonFaq];

  return (
    <div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{guide.intro}</p>
      {guide.flowPhaseNote ? (
        <p className="mt-3 rounded-xl border border-[color:var(--su-celadon-light)] bg-[color:var(--su-celadon-light)] px-4 py-3 text-sm leading-relaxed text-[color:var(--su-celadon-dark)]">
          {guide.flowPhaseNote}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[color:var(--su-ink-muted)]">{guide.supportHint}</p>

      <div
        className="mt-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label={guide.title}
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-[color:var(--su-celadon)] text-white"
                : "bg-white text-[color:var(--su-ink-muted)] ring-1 ring-[color:var(--su-hanji-border)] hover:text-[color:var(--su-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === "precheck" ? (
          <div className="space-y-6">
            {guide.precheckBlocks.map((block, i) => (
              <div key={i} className="su-card p-4 sm:p-5">
                <GuideBlockView block={block} />
              </div>
            ))}
          </div>
        ) : null}
        {tab === "iphone" ? <GuideStepsSection title={guide.stepsTitle} steps={guide.iphoneSteps} /> : null}
        {tab === "android" ? <GuideStepsSection title={guide.stepsTitle} steps={guide.androidSteps} /> : null}
      </div>

      <GuideFaqSection title={guide.faqTitle} faqs={mainFaqs} openFaq={openFaq} setOpenFaq={setOpenFaq} />

      {guide.regionalFaq && guide.regionalFaq.length > 0 ? (
        <div className="mt-10">
          {guide.regionalFaqNote ? (
            <p className="mb-4 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{guide.regionalFaqNote}</p>
          ) : null}
          <GuideFaqSection
            title={guide.regionalFaqTitle ?? "Regional notices"}
            faqs={guide.regionalFaq}
            openFaq={openFaq}
            setOpenFaq={setOpenFaq}
          />
        </div>
      ) : null}
    </div>
  );
}
