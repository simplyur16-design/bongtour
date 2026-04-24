"use client";

import Link from "next/link";
import { HELP_MENU_ITEMS } from "@/lib/bongsim/help-nav";

export function BongsimHomeSupportSection() {
  const cards = HELP_MENU_ITEMS;

  return (
    <section
      id="home-help-support"
      className="rounded-3xl border border-slate-200/90 bg-white px-4 py-8 shadow-sm ring-1 ring-slate-100/70 sm:px-6 lg:px-10 lg:py-10"
      aria-label="서비스 도움말"
    >
      <h2 className="text-base font-bold text-slate-900 lg:text-lg">도움말 · 고객지원</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">자주 찾는 항목을 모아 두었어요.</p>
      <div className="mt-5 flex flex-col gap-3 sm:mt-6 lg:grid lg:grid-cols-2 lg:gap-4">
        {cards.map((c) => {
          const className =
            "group flex min-h-[3.25rem] w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-left shadow-sm transition hover:border-teal-200 hover:bg-white hover:shadow-md active:scale-[0.99] sm:min-h-0 sm:py-4";
          return (
            <Link key={c.href} href={c.href} className={className}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200/80 sm:h-10 sm:w-10">
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[14px] font-bold text-slate-900 sm:text-[15px]">{c.title}</span>
                <span className="mt-0.5 block break-words text-[11px] leading-relaxed text-slate-600 sm:text-xs">{c.sub}</span>
              </span>
              <span className="ml-1 shrink-0 text-slate-400 transition group-hover:text-teal-700" aria-hidden>
                ›
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
