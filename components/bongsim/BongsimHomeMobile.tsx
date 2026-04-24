"use client";

import { bongsimPath } from '@/lib/bongsim/constants'
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GiftForeignFriendEntry } from "@/components/bongsim/GiftForeignFriendEntry";
import { HomeDestinationGrid } from "@/components/bongsim/HomeDestinationGrid";
import { SimplyurTeaserBanner } from "@/components/bongsim/SimplyurTeaserBanner";
import { getRecentCountryCodes, pushRecentCountry } from "@/lib/bongsim/country-history";
import { HOME_POPULAR_CODES } from "@/lib/bongsim/home-data";
import { getCountryById } from "@/lib/bongsim/mock-data";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import type { CountryOption } from "@/lib/bongsim/types";

function matchesQuery(
  c: { nameKr: string; code: string; subtitleKr?: string; searchTerms?: string[] },
  q: string,
) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (c.nameKr.toLowerCase().includes(t)) return true;
  if (c.subtitleKr?.toLowerCase().includes(t)) return true;
  if (c.code.toLowerCase().includes(t)) return true;
  return false;
}

export function BongsimHomeMobile() {
  const [tab, setTab] = useState<"popular" | "multi">("popular");
  const [q, setQ] = useState("");
  const [histTick, setHistTick] = useState(0);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setStorageReady(true));
  }, []);

  const recordVisit = useCallback((code: string) => {
    pushRecentCountry(code);
    setHistTick((t) => t + 1);
  }, []);

  const recentResolved = useMemo(() => {
    void histTick;
    if (!storageReady) return [];
    return getRecentCountryCodes(5)
      .map((code) => getCountryById(code))
      .filter((x): x is NonNullable<typeof x> => !!x && x.code !== "kr");
  }, [histTick, storageReady]);

  const recentSet = useMemo(() => {
    void histTick;
    if (!storageReady) return new Set<string>();
    return new Set(getRecentCountryCodes(5));
  }, [histTick, storageReady]);

  const popularSearchPool = useMemo(() => {
    return HOME_POPULAR_CODES.map((code) => getCountryById(code)).filter(Boolean) as CountryOption[];
  }, []);

  const popularWhenFocused = useMemo(() => {
    return HOME_POPULAR_CODES.filter((code) => !recentSet.has(code))
      .map((code) => getCountryById(code))
      .filter(Boolean) as CountryOption[];
  }, [recentSet]);

  const displayedPopular = useMemo(() => {
    let base: CountryOption[];
    if (q.trim()) {
      base = popularSearchPool;
    } else if (recentResolved.length > 0) {
      base = popularWhenFocused;
    } else {
      base = popularSearchPool;
    }
    return base.filter((c) => matchesQuery(c, q));
  }, [q, recentResolved.length, popularWhenFocused, popularSearchPool]);

  const regionItems = useMemo(() => REGION_PACK_OPTIONS.filter((c) => matchesQuery(c, q)), [q]);

  const popularEmpty =
    tab === "popular" &&
    displayedPopular.length === 0 &&
    !(q.trim() === "" && recentResolved.length > 0);

  return (
    <div className="w-full pb-6">
      <section className="px-0 pt-6 lg:rounded-3xl lg:border lg:border-slate-200/90 lg:bg-white lg:p-8 lg:pt-8 lg:shadow-sm">
        <div className="lg:grid lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-10 xl:grid-cols-[minmax(0,19rem)_1fr] xl:gap-12">
          <div className="min-w-0 lg:space-y-5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 lg:text-xl">어디로 떠나시나요?</h2>
            <p className="mt-1 text-[13px] text-slate-600 lg:mt-2 lg:text-sm">
              Bong투어가 150개국 어디든 연결해 드려요. 국가를 탭해 추천·비교로 이어가세요.
            </p>

            <label className="relative mt-4 block lg:mt-0">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                </svg>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="어디로 떠나시나요?"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 lg:bg-slate-50/80"
                autoComplete="off"
              />
            </label>

            <div className="mt-5 flex border-b border-slate-200 bg-white/70 lg:mt-6 lg:rounded-xl lg:border lg:border-slate-200 lg:bg-slate-50/50">
              <button
                type="button"
                onClick={() => setTab("popular")}
                className={`relative min-h-12 flex-1 text-[15px] font-semibold transition ${
                  tab === "popular" ? "text-sky-600" : "text-slate-400"
                }`}
              >
                인기국가
                {tab === "popular" ? (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-600" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setTab("multi")}
                className={`relative min-h-12 flex-1 text-[15px] font-semibold transition ${
                  tab === "multi" ? "text-sky-600" : "text-slate-400"
                }`}
              >
                다국가
                {tab === "multi" ? (
                  <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-600" />
                ) : null}
              </button>
            </div>

            <GiftForeignFriendEntry className="mt-5 lg:mt-0" />
          </div>

          <div className="mt-5 min-h-[12rem] lg:mt-0 lg:min-h-[14rem] lg:border-l lg:border-slate-100 lg:pl-10 xl:pl-12">
            {tab === "popular" ? (
              popularEmpty ? (
                <p className="py-10 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
              ) : !q.trim() && recentResolved.length > 0 ? (
                <>
                  <h3 className="text-sm font-bold text-slate-800 lg:text-[15px]">자주 찾는 나라</h3>
                  <div className="mt-3">
                    <HomeDestinationGrid items={recentResolved} onBeforeNavigate={recordVisit} />
                  </div>
                  <h3 className="mt-6 text-sm font-bold text-slate-800 lg:mt-8 lg:text-[15px]">인기국가</h3>
                  <div className="mt-3">
                    <HomeDestinationGrid items={displayedPopular} onBeforeNavigate={recordVisit} />
                  </div>
                  <Link
                    href={bongsimPath("/recommend")}
                    className="mt-5 flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 py-4 transition hover:border-teal-300 hover:bg-teal-50/40 lg:mt-6"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-slate-400 ring-1 ring-slate-200">
                      ···
                    </span>
                    <span className="text-[12px] font-bold text-slate-600">더보기</span>
                  </Link>
                </>
              ) : (
                <>
                  <HomeDestinationGrid items={displayedPopular} onBeforeNavigate={recordVisit} />
                  {!q.trim() ? (
                    <Link
                      href={bongsimPath("/recommend")}
                      className="mt-5 flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 py-4 transition hover:border-teal-300 hover:bg-teal-50/40 lg:mt-6"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-slate-400 ring-1 ring-slate-200">
                        ···
                      </span>
                      <span className="text-[12px] font-bold text-slate-600">더보기</span>
                    </Link>
                  ) : null}
                </>
              )
            ) : regionItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
            ) : (
              <HomeDestinationGrid items={regionItems} onBeforeNavigate={recordVisit} />
            )}
          </div>
        </div>
      </section>
      <SimplyurTeaserBanner variant="inline" />
    </div>
  );
}
