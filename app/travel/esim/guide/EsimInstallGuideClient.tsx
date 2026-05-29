"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, HelpCircle, Settings2 } from "lucide-react";
import Header from "@/app/components/Header";
import { bongsimPath } from "@/lib/bongsim/constants";
import {
  ANDROID_STEPS,
  COMMON_FAQ,
  type GuideBlock,
  type GuideFaq,
  type GuideStep,
  type GuideTab,
  type EsimGuideImageMap,
  IOS_STEPS,
  PRECHECK_BLOCKS,
  PRECHECK_FAQ,
} from "@/lib/bongsim/esim-guide-content";
import { EsimSupportFootnote } from "@/components/bongsim/EsimSupportFootnote";

const TABS: { key: GuideTab; label: string }[] = [
  { key: "precheck", label: "설치 전 확인" },
  { key: "iphone", label: "iPhone" },
  { key: "android", label: "Android" },
];

function GuideBlockImage({ guideKey, imageMap }: { guideKey: string; imageMap: EsimGuideImageMap }) {
  const entry = imageMap[guideKey];
  if (!entry) return null;
  return (
    <div className="flex justify-center pt-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- NCloud public_url */}
      <img
        src={entry.url}
        alt={entry.alt}
        className="mx-auto max-w-[280px] rounded-lg border border-slate-200"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function GuideBlockContent({ block, imageMap }: { block: GuideBlock; imageMap: EsimGuideImageMap }) {
  return (
    <div className="space-y-3">
      {block.heading ? (
        <p className="font-semibold text-slate-900 lg:text-base">{block.heading}</p>
      ) : null}
      {block.paras?.map((para) => (
        <p key={para} className="text-sm leading-relaxed text-slate-900 lg:text-base">
          {para}
        </p>
      ))}
      {block.bullets?.length ? (
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-900 lg:text-base">
          {block.bullets.map((item) => (
            <li key={item} className="flex gap-2 text-slate-900">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              <span className="text-slate-900">{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {block.image ? <GuideBlockImage guideKey={block.image} imageMap={imageMap} /> : null}
      {block.note ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 lg:text-base">
          {block.note}
        </p>
      ) : null}
    </div>
  );
}

function GuideStepsSection({ steps, imageMap }: { steps: GuideStep[]; imageMap: EsimGuideImageMap }) {
  return (
    <section aria-labelledby="esim-guide-steps">
      <h2 id="esim-guide-steps" className="flex items-center gap-2 text-lg font-bold text-slate-900 lg:text-xl">
        <Settings2 className="h-5 w-5 text-teal-600" aria-hidden />
        설치 단계
      </h2>
      <ol className="mt-6 space-y-8">
        {steps.map(({ n, title, blocks }) => (
          <li key={n} className="relative flex gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-bold text-white shadow-md ring-4 ring-teal-100 lg:h-11 lg:w-11 lg:text-base"
              aria-hidden
            >
              {n}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <h3 className="text-base font-semibold leading-snug text-slate-900 lg:text-lg">{title}</h3>
              <div className="mt-3 space-y-4">
                {blocks.map((block, blockIdx) => (
                  <GuideBlockContent key={`${n}-${blockIdx}`} block={block} imageMap={imageMap} />
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
  faqs,
  openFaq,
  setOpenFaq,
}: {
  faqs: GuideFaq[];
  openFaq: string | null;
  setOpenFaq: (q: string | null) => void;
}) {
  return (
    <section className="mt-12 lg:mt-14" aria-labelledby="esim-guide-faq">
      <h2 id="esim-guide-faq" className="flex items-center gap-2 text-lg font-bold text-slate-900 lg:text-xl">
        <HelpCircle className="h-5 w-5 text-teal-600" aria-hidden />
        자주 묻는 질문
      </h2>
      <div className="mt-4 space-y-2">
        {faqs.map(({ q, a }) => {
          const open = openFaq === q;
          return (
            <div key={q} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenFaq(open ? null : q)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50 lg:px-5 lg:py-4 lg:text-base"
                aria-expanded={open}
              >
                <span className="text-slate-900">{q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {open ? (
                <div className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-900 lg:px-5 lg:py-4 lg:text-base">
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

export function EsimInstallGuideClient({ imageMap }: { imageMap: EsimGuideImageMap }) {
  const [tab, setTab] = useState<GuideTab>("precheck");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const faqs = tab === "precheck" ? PRECHECK_FAQ : COMMON_FAQ;
  const steps = tab === "iphone" ? IOS_STEPS : tab === "android" ? ANDROID_STEPS : null;

  const selectTab = (next: GuideTab) => {
    setTab(next);
    setOpenFaq(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section
        className="w-full bg-gradient-to-br from-sky-50 to-teal-50 px-4 py-12 lg:py-16"
        aria-labelledby="esim-guide-hero"
      >
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <h1
            id="esim-guide-hero"
            className="text-balance text-2xl font-bold leading-tight tracking-tight text-slate-900 lg:text-4xl"
          >
            eSIM 설치 가이드
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium text-slate-700 lg:mt-5 lg:text-lg">
            QR코드 하나로 1분 만에 설치 완료!
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-700 lg:text-base">여행자님, 천천히 따라 오시면 금방 끝나요.</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 lg:max-w-4xl lg:px-6 lg:pb-20 lg:pt-10">
        <div className="flex gap-1 rounded-lg bg-slate-200/60 p-1" role="tablist" aria-label="eSIM 가이드 탭">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => selectTab(key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition lg:text-sm ${
                tab === key ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "precheck" ? (
          <div className="mt-8 space-y-6 lg:mt-10">
            {PRECHECK_BLOCKS.map((block, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6"
              >
                <GuideBlockContent block={block} imageMap={imageMap} />
              </div>
            ))}
          </div>
        ) : steps ? (
          <div className="mt-10 lg:mt-12">
            <GuideStepsSection steps={steps} imageMap={imageMap} />
          </div>
        ) : null}

        <GuideFaqSection faqs={faqs} openFaq={openFaq} setOpenFaq={setOpenFaq} />

        <div className="mt-12 rounded-2xl border border-teal-100 bg-gradient-to-br from-sky-50/90 to-teal-50/90 px-5 py-8 text-center lg:mt-14 lg:px-8 lg:py-10">
          <p className="text-base font-semibold text-slate-900 lg:text-lg">아직 eSIM이 없으신가요?</p>
          <Link
            href={bongsimPath("/recommend")}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:from-teal-600 hover:to-cyan-600 hover:shadow-lg active:scale-[0.99] lg:px-10 lg:py-4 lg:text-lg"
          >
            나에게 맞는 eSIM 찾기
          </Link>
          <EsimSupportFootnote className="mt-6" />
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href={bongsimPath()} className="font-medium text-teal-700 underline-offset-4 hover:underline">
            ← eSIM 홈으로
          </Link>
        </p>
      </main>
    </div>
  );
}
