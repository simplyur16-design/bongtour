"use client";

import SafeImage from "@/app/components/SafeImage";
import { COUNTRY_PICKER_GRID_CLASS, CountryPickerGrid } from "@/components/bongsim/CountryPickerGrid";
import { CountryNameMultiline } from "@/lib/bongsim/country-name-display";
import type { CountryOption } from "@/lib/bongsim/types";

export type CountrySelectStepProps = {
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

export function CountrySelectStep({
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
}: CountrySelectStepProps) {
  const hasSelection = selectedCodes.length > 0;

  return (
    <>
      <div className={hasSelection ? "pb-28 sm:pb-32" : undefined}>
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">추천 eSIM</p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
            여행할 국가를 모두 선택해주세요
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            선택한 국가에 맞는 가장 합리적인 상품 조합을 찾아드려요.
          </p>
        </div>

        {hasSelection ? (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-slate-700">선택한 국가:</span>
            {selectedCodes.map((code) => {
              const country = resolveCountry(code);
              if (!country) return null;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onRemoveChip(code)}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1.5 text-[12px] font-bold text-teal-900 ring-1 ring-teal-200 transition hover:bg-teal-200"
                >
                  <span>{country.nameKr}</span>
                  <svg
                    className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9l3.5-3.5 1 1L11 10l3.5 3.5-1 1L10 11l-3.5 3.5-1-1L9 10 5.5 6.5l1-1L10 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        ) : null}

        <section className="mb-8 border-b border-slate-200 pb-8">
          <h2 className="mb-3 text-[15px] font-bold text-slate-800">🔥 인기 여행지</h2>
          <div className="px-2">
            {standaloneCountries === null ? (
              <p className="text-center text-[13px] text-slate-500">인기 여행지를 불러오는 중…</p>
            ) : popularCountries.length === 0 ? (
              <p className="text-center text-[13px] text-slate-500">
                인기 여행지 중 단독 플랜이 있는 국가가 없습니다.
              </p>
            ) : (
              <div className={COUNTRY_PICKER_GRID_CLASS}>
                {popularCountries.map((country) => {
                  const isSelected = selectedCodes.includes(country.code);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => onToggleCountry(country.code)}
                      className="flex w-full min-w-0 flex-col items-center px-1 py-2"
                    >
                      <div
                        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full transition hover:scale-105 ${
                          isSelected ? "shadow-lg ring-2 ring-blue-400" : "shadow-lg ring-1 ring-gray-200"
                        }`}
                      >
                        <SafeImage
                          src={`https://flagcdn.com/w160/${country.code}.png`}
                          alt=""
                          width={48}
                          height={48}
                          quality={90}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                          sizes="48px"
                        />
                      </div>
                      <CountryNameMultiline
                        nameKr={country.nameKr}
                        className={`mt-1 w-full min-w-0 px-0.5 text-xs ${
                          isSelected ? "font-bold text-blue-500" : "font-medium text-gray-700"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="국가를 검색하세요 (예: 일본, 베트남)"
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 pl-11 text-[14px] text-slate-900 placeholder-slate-400 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <svg
              className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
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
          {searchQuery && standaloneCountries ? (
            <p className="mt-2 text-[12px] text-slate-600">
              <span className="font-semibold">{filteredCountries.length}개</span> 국가 검색됨
            </p>
          ) : null}
        </div>

        <section>
          <h2 className="mb-4 text-[15px] font-bold text-slate-800">{searchQuery ? "검색 결과" : "전체 국가"}</h2>
          {countriesLoadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
              <p className="text-[14px] text-red-800">{countriesLoadError}</p>
              <button
                type="button"
                onClick={() => void onRetryLoadCountries()}
                className="mt-3 text-sm font-semibold text-red-900 underline"
              >
                다시 시도
              </button>
            </div>
          ) : standaloneCountries === null ? (
            <div className="py-12 text-center">
              <p className="text-[14px] text-slate-500">단독 플랜이 있는 국가 목록을 불러오는 중…</p>
            </div>
          ) : filteredCountries.length > 0 ? (
            <CountryPickerGrid
              countries={filteredCountries}
              selectedCodes={selectedCodes}
              onSelect={onToggleCountry}
              mobileCollapseInitialCount={20}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="text-[14px] text-slate-500">검색 결과가 없습니다.</p>
            </div>
          )}
        </section>
      </div>

      {hasSelection ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 pt-3 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-2 text-center text-sm font-medium text-slate-600">
              {selectedCodes.length}개국 선택됨
            </p>
            <button
              type="button"
              onClick={onNext}
              className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-lg font-semibold text-white shadow-md transition hover:from-teal-600 hover:to-cyan-600 active:scale-[0.99]"
            >
              다음: 상품 확인
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
