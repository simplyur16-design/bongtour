"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpQuickLinksRow } from "@/components/bongsim/HelpQuickLinksRow";
import { CountryPickerGrid } from "@/components/bongsim/CountryPickerGrid";
import { GiftForeignFriendEntry } from "@/components/bongsim/GiftForeignFriendEntry";
import { MultiRegionPickerGrid } from "@/components/bongsim/MultiRegionPickerGrid";
import { filterCountryOptions } from "@/lib/bongsim/country-options";
import { getRecentCountryCodes, pushRecentCountry, pushRecentSearch } from "@/lib/bongsim/country-history";
import { RECOMMEND_POPULAR_CODES, RECOMMEND_POPULAR_MORE_CODES } from "@/lib/bongsim/home-data";
import { filterRegionPacks, RECOMMEND_MULTI_PACK_OPTIONS, REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { EMPTY_FUNNEL, bongsimPath } from '@/lib/bongsim/constants';
import { getCountryById, loadFunnel, MOCK_COUNTRIES, saveFunnel } from "@/lib/bongsim/mock-data";
import type { CountryOption, FunnelState } from "@/lib/bongsim/types";

const GRID_POPULAR =
  "grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-6 xl:gap-x-6";

function nextCountryIds(prev: string[], id: string): string[] {
  const c = getCountryById(id);
  if (!c || id === "kr") return prev;
  if (c.isRegion || id.startsWith("rg-")) {
    return [id];
  }
  const cleaned = prev.filter((pid) => {
    const p = getCountryById(pid);
    return p && !p.isRegion && !pid.startsWith("rg-");
  });
  if (cleaned.includes(id)) return cleaned.filter((x) => x !== id);
  if (cleaned.length >= 8) return cleaned;
  return [...cleaned, id];
}

function sortSearchMatches(items: CountryOption[]): CountryOption[] {
  const popOrder = new Map(RECOMMEND_POPULAR_CODES.map((c, i) => [c, i]));
  const multiOrder = new Map(RECOMMEND_MULTI_PACK_OPTIONS.map((c, i) => [c.code, i]));
  const regionOrder = new Map(REGION_PACK_OPTIONS.map((c, i) => [c.code, i]));
  const rank = (c: CountryOption) => {
    if (popOrder.has(c.code)) return popOrder.get(c.code)!;
    if (multiOrder.has(c.code)) return 100 + (multiOrder.get(c.code) ?? 0);
    if (regionOrder.has(c.code)) return 200 + (regionOrder.get(c.code) ?? 0);
    return 900;
  };
  return items
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const ra = rank(a.c);
      const rb = rank(b.c);
      if (ra !== rb) return ra - rb;
      return a.i - b.i;
    })
    .map((x) => x.c);
}

function SelectionChips({
  funnel,
  onRemove,
}: {
  funnel: FunnelState;
  onRemove: (code: string) => void;
}) {
  if (funnel.countryIds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {funnel.countryIds.map((cid, idx) => {
        const c = getCountryById(cid);
        if (!c) return null;
        return (
          <div
            key={cid}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-teal-200/90 bg-white py-1.5 pl-2 pr-1.5 shadow-sm ring-1 ring-slate-100/80"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-teal-800 ring-1 ring-teal-100">
              {idx + 1}
            </span>
            <span className="text-[1.35rem] leading-none" aria-hidden>
              {c.flag}
            </span>
            <span className="min-w-0 truncate text-[13px] font-bold text-slate-900 sm:text-[14px]">{c.nameKr}</span>
            <button
              type="button"
              onClick={() => onRemove(cid)}
              className="shrink-0 rounded-full p-0.5 text-slate-600 hover:bg-slate-100"
              aria-label={`${c.nameKr} ?? ??`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function RecommendFunnel() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [funnel, setFunnel] = useState<FunnelState>(EMPTY_FUNNEL);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryTab, setCountryTab] = useState<"popular" | "multi">("popular");
  const [histTick, setHistTick] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [giftNote, setGiftNote] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setStorageReady(true));
  }, []);

  const popularBusinessList = useMemo(
    () =>
      RECOMMEND_POPULAR_CODES.map((code) => getCountryById(code)).filter(
        (x): x is NonNullable<typeof x> => !!x && x.code !== "kr",
      ),
    [],
  );

  const popularMoreList = useMemo(
    () =>
      RECOMMEND_POPULAR_MORE_CODES.map((code) => getCountryById(code)).filter(
        (x): x is NonNullable<typeof x> => !!x && x.code !== "kr",
      ),
    [],
  );

  const recentResolved = useMemo(() => {
    void histTick;
    if (!storageReady) return [];
    return getRecentCountryCodes(5)
      .map((code) => getCountryById(code))
      .filter((x): x is NonNullable<typeof x> => !!x && x.code !== "kr");
  }, [histTick, storageReady]);

  const recentCodeSet = useMemo(() => new Set(recentResolved.map((c) => c.code)), [recentResolved]);

  const popularMainList = useMemo(
    () => popularBusinessList.filter((c) => !recentCodeSet.has(c.code)),
    [popularBusinessList, recentCodeSet],
  );

  const searchRaw = useMemo(() => {
    const q = countryQuery.trim();
    if (!q) return [];
    const merged = [...filterRegionPacks(q), ...filterCountryOptions(MOCK_COUNTRIES, q)].filter(
      (c) => c.code !== "kr",
    );
    const seen = new Set<string>();
    const dedup: CountryOption[] = [];
    for (const c of merged) {
      if (seen.has(c.code)) continue;
      seen.add(c.code);
      dedup.push(c);
    }
    return sortSearchMatches(dedup);
  }, [countryQuery]);

  const persist = useCallback((partial: Partial<FunnelState>) => {
    setFunnel((prev) => {
      let next = { ...prev, ...partial };
      if (partial.countryIds !== undefined) {
        next = {
          ...next,
          tripStart: null,
          tripEnd: null,
          tripDurationDays: null,
          tripDurationNights: null,
        };
      }
      saveFunnel(next);
      return next;
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      let f = loadFunnel();
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const pre = params.get("country") ?? params.get("code");
        if (pre && pre !== "kr" && getCountryById(pre)) {
          f = {
            ...EMPTY_FUNNEL,
            countryIds: [pre],
            tripStart: null,
            tripEnd: null,
            tripDurationDays: null,
            tripDurationNights: null,
            network: null,
            planId: null,
            coverageProductId: null,
          };
          saveFunnel(f);
          window.history.replaceState(null, "", "/recommend");
        }
      }
      setFunnel(f);
      setReady(true);
      setHistTick((t) => t + 1);
    });
  }, []);

  const toggleCountry = (id: string, opts?: { fromSearchQuery?: string }) => {
    if (!getCountryById(id) || id === "kr") return;
    const sq = opts?.fromSearchQuery?.trim();
    if (sq) pushRecentSearch(sq);
    pushRecentCountry(id);
    setHistTick((t) => t + 1);
    const nextIds = nextCountryIds(funnel.countryIds, id);
    persist({
      countryIds: nextIds,
      network: null,
      planId: null,
      coverageProductId: null,
    });
  };

  const removeChip = (code: string) => {
    persist({
      countryIds: funnel.countryIds.filter((c) => c !== code),
      network: null,
      planId: null,
      coverageProductId: null,
    });
  };

  const goDates = () => {
    if (funnel.countryIds.length === 0) return;
    persist({
      network: null,
      planId: null,
      coverageProductId: null,
    });
    router.push(bongsimPath("/dates"));
  };

  if (!ready) {
    return (
      <div className="min-h-full bg-slate-50">
        <p className="px-4 py-24 text-center text-sm text-slate-500">???? ????.</p>
      </div>
    );
  }

  const nextDisabled = funnel.countryIds.length === 0;
  const searching = !!countryQuery.trim();
  const hasMorePopular = popularMoreList.length > 0;

  return (
    <div className="relative min-h-full bg-slate-50 pb-32 sm:pb-36 lg:pb-40">
      <main className="relative z-0 mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pt-6 lg:px-12 lg:pb-16 lg:pt-10 xl:max-w-7xl xl:px-16">
        <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={bongsimPath()}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-600 transition hover:text-teal-800"
            >
              ? ?
            </Link>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-800 ring-1 ring-teal-100">
              STEP 1 · ??
            </span>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[18%] rounded-full bg-teal-600" />
          </div>

          <HelpQuickLinksRow />

          <header className="mt-6 sm:mt-8">
            <h1 className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.65rem] lg:text-3xl">
              ??? ??? ??? ???.
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
              ??? ??? ?? ?? ??? ?? ??? ????. ???? ?? ???.
            </p>
          </header>

          <label className="relative mt-6 block sm:mt-7">
            <span className="sr-only">?? ??</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </span>
            <input
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              placeholder="?? ???? ?? (?: ??, ??)"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 pl-12 pr-4 text-[16px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15"
              autoComplete="off"
            />
          </label>

          <div className="mt-4 min-h-[2.75rem] sm:mt-5">
            <SelectionChips funnel={funnel} onRemove={removeChip} />
          </div>

          {giftNote ? (
            <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-center text-[12px] font-medium text-violet-950">
              ????? ?? ????. ?? eSIM? ???? ??? ??? ???.
            </p>
          ) : null}

          {searching ? (
            <section className="mt-8" aria-label="?? ??">
              <h2 className="text-[15px] font-bold text-slate-900">?? ??</h2>
              <div className="mt-4">
                {searchRaw.length === 0 ? (
                  <p className="rounded-2xl border border-slate-200 bg-white py-14 text-center text-sm text-slate-500">
                    ?? ??? ???. ?? ???? ??? ???.
                  </p>
                ) : (
                  <CountryPickerGrid
                    gridClassName={GRID_POPULAR}
                    countries={searchRaw}
                    selectedCodes={funnel.countryIds}
                    onSelect={(code) => {
                      const q = countryQuery.trim();
                      setCountryQuery("");
                      toggleCountry(code, { fromSearchQuery: q });
                    }}
                  />
                )}
              </div>
            </section>
          ) : (
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setCountryTab("popular")}
                  className={`relative min-h-[3.25rem] flex-1 text-[15px] font-bold transition ${
                    countryTab === "popular" ? "text-teal-800" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ????
                  {countryTab === "popular" ? (
                    <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-teal-600 sm:inset-x-10" />
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => setCountryTab("multi")}
                  className={`relative min-h-[3.25rem] flex-1 text-[15px] font-bold transition ${
                    countryTab === "multi" ? "text-teal-800" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ???
                  {countryTab === "multi" ? (
                    <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-teal-600 sm:inset-x-10" />
                  ) : null}
                </button>
              </div>

              <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                {countryTab === "popular" ? (
                  <div className="space-y-8">
                    <GiftForeignFriendEntry onClick={() => setGiftNote(true)} />

                    {recentResolved.length > 0 ? (
                      <div>
                        <h2 className="text-[15px] font-bold text-slate-900">?? ?? ??</h2>
                        <p className="mt-1 text-[12px] text-slate-500">??? ??? ?????.</p>
                        <div className="mt-4">
                          <CountryPickerGrid
                            gridClassName={GRID_POPULAR}
                            countries={recentResolved}
                            selectedCodes={funnel.countryIds}
                            onSelect={(code) => toggleCountry(code)}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900">????</h2>
                      <p className="mt-1 text-[12px] text-slate-500">???? ?? ?? ?????.</p>
                      <div className="mt-4">
                        <CountryPickerGrid
                          gridClassName={GRID_POPULAR}
                          countries={recentResolved.length > 0 ? popularMainList : popularBusinessList}
                          selectedCodes={funnel.countryIds}
                          onSelect={(code) => toggleCountry(code)}
                        />
                      </div>
                      {hasMorePopular && !showAllPopular ? (
                        <button
                          type="button"
                          onClick={() => setShowAllPopular(true)}
                          className="mt-5 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 py-3.5 text-[14px] font-bold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50/50"
                        >
                          ???
                        </button>
                      ) : null}
                      {showAllPopular && popularMoreList.length > 0 ? (
                        <div className="mt-8 border-t border-slate-100 pt-8">
                          <h3 className="text-[14px] font-bold text-slate-800">?? ???</h3>
                          <p className="mt-1 text-[11px] text-slate-500">?? ????? ??? ?? ???.</p>
                          <div className="mt-4">
                            <CountryPickerGrid
                              gridClassName={GRID_POPULAR}
                              countries={popularMoreList}
                              selectedCodes={funnel.countryIds}
                              onSelect={(code) => toggleCountry(code)}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-900">???·?? ??</h2>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      ?? ??? ? ?? ???? ??? ??????. ??? ??? ?? ?? ?? ??? ?????.
                    </p>
                    <div className="mt-5">
                      <MultiRegionPickerGrid
                        regions={RECOMMEND_MULTI_PACK_OPTIONS}
                        selectedCodes={funnel.countryIds}
                        onSelect={(code) => toggleCountry(code)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500 sm:text-left sm:text-[12px]">
            ??? ?? eSIM? ????. ????? ?? ???? ??? ? ???.
          </p>
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(15,23,42,0.06)] backdrop-blur-md sm:px-6 lg:px-12 xl:px-16">
        <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 2xl:max-w-6xl">
          <p className="text-center text-[12px] font-medium text-slate-500 sm:min-w-0 sm:flex-1 sm:text-left">
            {nextDisabled ? "??? ??? ? ? ?? ??? ???." : "?? ???? ?? ??? ???."}
          </p>
          <button
            type="button"
            disabled={nextDisabled}
            onClick={goDates}
            className="flex min-h-[3.25rem] w-full shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-[15px] font-bold text-white shadow-md transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto sm:min-w-[13rem]"
          >
            ?? ?? ???
          </button>
        </div>
      </div>
    </div>
  );
}
