"use client";

import { useState } from "react";
import { CountryPurchaseNoticeList } from "@/components/bongsim/recommend/CountryPurchaseNotice";
import { CountryTravelerVerificationNotice } from "@/components/bongsim/recommend/CountryTravelerVerificationNotice";
import { UsimsaCountryPickerGrid } from "@/components/bongsim/recommend/UsimsaCountryPickerGrid";
import type { CountryOption } from "@/lib/bongsim/types";

export type MultiTripCountryPickerPanelProps = {
  selectedCodes: string[];
  onToggleCountry: (code: string) => void;
  onRemoveChip: (code: string) => void;
  onNext: () => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  standaloneCountries: CountryOption[] | null;
  countriesLoadError: string | null;
  onRetryLoadCountries: () => void;
  popularCountries: CountryOption[];
  filteredCountries: CountryOption[];
  resolveCountry: (code: string) => CountryOption | undefined;
};

/** 2개국 이상 단일국가 조합 선택 패널 */
export function MultiTripCountryPickerPanel({
  selectedCodes,
  onToggleCountry,
  onRemoveChip,
  onNext,
  searchQuery,
  onSearchQueryChange,
  standaloneCountries,
  countriesLoadError,
  onRetryLoadCountries,
  popularCountries,
  filteredCountries,
  resolveCountry,
}: MultiTripCountryPickerPanelProps) {
  const [showAllSingle, setShowAllSingle] = useState(false);
  const isSearching = searchQuery.trim().length > 0;
  const canProceed = selectedCodes.length >= 2;

  const verificationCountries = selectedCodes
    .map((code) => {
      const country = resolveCountry(code);
      if (!country?.travelerVerification || country.travelerVerification === "none") return null;
      return {
        code,
        nameKr: country.nameKr,
        policy: country.travelerVerification,
      };
    })
    .filter(Boolean) as { code: string; nameKr: string; policy: "mixed" | "required" }[];

  const gridItems = isSearching || showAllSingle ? filteredCountries : popularCountries;
  const showSeeMore =
    !isSearching && !showAllSingle && filteredCountries.length > popularCountries.length;

  return (
    <>
      <div className={canProceed ? "pb-28" : "pb-2"}>
        <p className="mx-4 mt-3 text-[13px] text-[#767676]">
          2개국 이상 선택 · 나라별 이용 기간을 설정합니다
        </p>

        <div className="relative mx-4 mt-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="국가 검색"
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
        </div>

        {selectedCodes.length > 0 ? (
          <div className="mx-4 mt-4 space-y-3 rounded-xl border border-[#f0f0f6] bg-[#f9f9f9] px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedCodes.map((code) => {
                const country = resolveCountry(code);
                if (!country) return null;
                const label = country.subtitleKr
                  ? `${country.nameKr} ${country.subtitleKr}`
                  : country.nameKr;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onRemoveChip(code)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#e1efff] px-3 py-1.5 text-[13px] font-semibold text-[#0176f9]"
                  >
                    <span>{label}</span>
                    <span className="text-[#0176f9]/70">×</span>
                  </button>
                );
              })}
            </div>
            <CountryTravelerVerificationNotice countries={verificationCountries} />
            <CountryPurchaseNoticeList countryCodes={selectedCodes} />
          </div>
        ) : null}

        {standaloneCountries === null ? (
          <p className="py-16 text-center text-[14px] text-[#767676]">국가 목록을 불러오는 중…</p>
        ) : countriesLoadError ? (
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
        ) : (
          <div className="mt-4 pb-4">
            {gridItems.length === 0 ? (
              <p className="py-12 text-center text-[14px] text-[#767676]">검색 결과가 없습니다.</p>
            ) : (
              <UsimsaCountryPickerGrid
                items={gridItems}
                selectedCodes={selectedCodes}
                onSelect={onToggleCountry}
                showSeeMore={showSeeMore}
                onSeeMore={() => setShowAllSingle(true)}
              />
            )}
          </div>
        )}
      </div>

      {canProceed ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#f0f0f6] bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:mx-auto max-lg:max-w-[500px]">
          <button
            type="button"
            onClick={onNext}
            className="h-14 w-full rounded-lg bg-[#0176f9] text-[16px] font-medium text-white transition active:opacity-90"
          >
            다음 ({selectedCodes.length}개국)
          </button>
        </div>
      ) : null}
    </>
  );
}
