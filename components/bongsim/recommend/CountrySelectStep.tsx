"use client";

import { useState } from "react";
import { CountrySelectTabs, type CountrySelectTab } from "@/components/bongsim/recommend/CountrySelectTabs";
import { BongsimRecommendAppShell } from "@/components/bongsim/recommend/BongsimRecommendAppShell";
import { UsimsaCountryPickerGrid } from "@/components/bongsim/recommend/UsimsaCountryPickerGrid";
import type { UsimsaPickerItem } from "@/lib/bongsim/recommend/usimsa-picker-item";
import {
  USIMSA_MULTI_COLLAPSED_COUNT,
  USIMSA_MULTI_TRIP_ENTRY_BOX_CLASS,
  USIMSA_MULTI_TRIP_ENTRY_SUBTITLE_CLASS,
  USIMSA_MULTI_TRIP_ENTRY_TITLE_CLASS,
} from "@/lib/bongsim/recommend/usimsa-country-picker-tokens";
import { regionPackShowsCoverageOnSelect } from "@/lib/bongsim/recommend/region-pack-coverage-display";
import { RegionPackCoverageDialog } from "@/components/bongsim/recommend/RegionPackCoverageDialog";
import { prefetchProductsByCountry } from "@/lib/bongsim/recommend/prefetch-products-by-country";
import type { CountryOption } from "@/lib/bongsim/types";

export type CountrySelectStepProps = {
  /** 단일 국가·다국가 패키지 — 클릭 즉시 2단계 */
  onPickCountry: (code: string) => void;
  /** 여러 단일국가 조합 (별도 화면) */
  onEnterMultiTrip: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  standaloneCountries: CountryOption[] | null;
  countriesLoadError: string | null;
  onRetryLoadCountries: () => void;
  popularCountries: CountryOption[];
  allMultiCountryPacks: UsimsaPickerItem[];
  filteredCountries: CountryOption[];
};

/**
 * usimsa Step1 — 인기국가 | 다국가, 1개 클릭 → 2단계.
 * 여러 단일국가 조합은 하단 링크 → 별도 화면.
 */
export function CountrySelectStep({
  onPickCountry,
  onEnterMultiTrip,
  searchQuery,
  onSearchQueryChange,
  standaloneCountries,
  countriesLoadError,
  onRetryLoadCountries,
  popularCountries,
  allMultiCountryPacks,
  filteredCountries,
}: CountrySelectStepProps) {
  const [activeTab, setActiveTab] = useState<CountrySelectTab>("popular");
  const [showAllSingle, setShowAllSingle] = useState(false);
  const [showAllMulti, setShowAllMulti] = useState(false);
  const [coverageSheet, setCoverageSheet] = useState<{
    code: string;
    title: string;
    planName: string;
  } | null>(null);

  const isSearching = searchQuery.trim().length > 0;

  const handleTabChange = (tab: CountrySelectTab) => {
    setActiveTab(tab);
    setShowAllSingle(false);
    setShowAllMulti(false);
    setCoverageSheet(null);
    onSearchQueryChange("");
  };

  const handlePrefetchCountry = (code: string) => {
    prefetchProductsByCountry([code]);
  };

  const handleMultiPackClick = (code: string) => {
    const pack = allMultiCountryPacks.find((p) => p.code === code);
    const label = pack?.displayNameKr ?? pack?.nameKr ?? code;
    if (pack && regionPackShowsCoverageOnSelect(label)) {
      setCoverageSheet({
        code,
        title: label,
        planName: pack.displayNameKr ?? label,
      });
      return;
    }
    prefetchProductsByCountry([code]);
    onPickCountry(code);
  };

  const popularGridItems: CountryOption[] = (() => {
    if (isSearching) return filteredCountries;
    if (showAllSingle) return filteredCountries;
    return popularCountries;
  })();

  const showPopularSeeMore =
    activeTab === "popular" &&
    !isSearching &&
    !showAllSingle &&
    filteredCountries.length > popularCountries.length;

  const multiVisible = showAllMulti
    ? allMultiCountryPacks
    : allMultiCountryPacks.slice(0, USIMSA_MULTI_COLLAPSED_COUNT);
  const showMultiSeeMore =
    !showAllMulti && allMultiCountryPacks.length > USIMSA_MULTI_COLLAPSED_COUNT;

  return (
    <BongsimRecommendAppShell singleCountry className="pb-8">
      <div className="pb-6">
        <div className="px-4 pt-5">
          <h1 className="text-[20px] font-bold leading-[30px] tracking-[-1px] text-[#111]">
            어디로 떠나시나요?
          </h1>
        </div>

        <div className="mt-4">
          <CountrySelectTabs active={activeTab} onChange={handleTabChange} />
        </div>

        {activeTab === "popular" ? (
          <div className="relative mx-4 mt-4">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="어디로 떠나시나요?"
              className="h-12 w-full rounded-lg border border-[#e5e5ec] bg-[#f7f7f7] py-0 pl-10 pr-10 text-[15px] tracking-[-0.75px] text-[#111] placeholder:text-[#999] focus:border-[#0176f9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0176f9]/30"
            />
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#999]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]"
                aria-label="검색어 지우기"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9l3.5-3.5 1 1L11 10l3.5 3.5-1 1L10 11l-3.5 3.5-1-1L9 10 5.5 6.5l1-1L10 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* REGRESSION-FREEZE[bongsim-recommend-countries-error-first]: 에러를 null-loading보다 먼저 — manifest */}
        {countriesLoadError && activeTab === "popular" ? (
          <div className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
            <p className="text-[14px] text-red-800">{countriesLoadError}</p>
            <button
              type="button"
              onClick={() => void onRetryLoadCountries()}
              className="mt-3 text-sm font-semibold text-red-900 underline"
            >
              다시 시도
            </button>
          </div>
        ) : standaloneCountries === null && activeTab === "popular" ? (
          <p className="py-16 text-center text-[14px] text-[#767676]">국가 목록을 불러오는 중…</p>
        ) : activeTab === "popular" ? (
          <div className="mt-4 pb-2">
            {popularGridItems.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-[#767676]">
                {isSearching ? "검색 결과가 없습니다." : "판매 중인 인기국가가 없습니다."}
              </p>
            ) : (
              <UsimsaCountryPickerGrid
                items={popularGridItems}
                selectedCodes={[]}
                onSelect={(code) => {
                  prefetchProductsByCountry([code]);
                  onPickCountry(code);
                }}
                onPrefetch={handlePrefetchCountry}
                showSeeMore={showPopularSeeMore}
                onSeeMore={() => setShowAllSingle(true)}
              />
            )}
          </div>
        ) : (
          <div className="mt-4 pb-2">
            {allMultiCountryPacks.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-[#767676]">다국가 상품이 없습니다.</p>
            ) : (
              <UsimsaCountryPickerGrid
                items={multiVisible}
                selectedCodes={[]}
                onSelect={handleMultiPackClick}
                onPrefetch={handlePrefetchCountry}
                showSeeMore={showMultiSeeMore}
                onSeeMore={() => setShowAllMulti(true)}
              />
            )}
          </div>
        )}

        <div className="mx-4 mt-6">
          <button
            type="button"
            onClick={onEnterMultiTrip}
            className={`w-full ${USIMSA_MULTI_TRIP_ENTRY_BOX_CLASS}`}
          >
            <span className={USIMSA_MULTI_TRIP_ENTRY_TITLE_CLASS}>여러 나라를 방문하시나요?</span>
            <span className={USIMSA_MULTI_TRIP_ENTRY_SUBTITLE_CLASS}>
              나라별 eSIM을 조합해 구매 (2개국 이상)
            </span>
          </button>
        </div>
      </div>

      {coverageSheet ? (
        <RegionPackCoverageDialog
          title={coverageSheet.title}
          regionCode={coverageSheet.code}
          planName={coverageSheet.planName}
          onClose={() => setCoverageSheet(null)}
          onConfirm={() => {
            prefetchProductsByCountry([coverageSheet.code]);
            onPickCountry(coverageSheet.code);
            setCoverageSheet(null);
          }}
        />
      ) : null}
    </BongsimRecommendAppShell>
  );
}
