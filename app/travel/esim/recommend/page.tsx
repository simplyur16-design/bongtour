"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { CountryPickerGrid } from "@/components/bongsim/CountryPickerGrid";
import { ProductCombinationStep } from "@/components/bongsim/recommend/ProductCombinationStep";
import { CountryNameMultiline } from "@/lib/bongsim/country-name-display";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import type { CountryOption } from "@/lib/bongsim/types";
import EsimServiceNoticeBanner from "@/app/travel/esim/components/EsimServiceNoticeBanner";

/**
 * 나에게 맞는 eSIM 찾기 — 추천 퍼널.
 *
 * Step 1: 국가 선택 (단독 플랜이 DB에 있는 국가만 — GET /api/bongsim/countries)
 * Step 2: 상품 조합 선택 (개별 vs 다국가)
 * Step 3~5: 별도 번들
 */

const POPULAR_COUNTRY_CODES = ["jp", "tw", "vn", "th", "hk", "sg", "us", "cn"];

type ApiCountriesPayload = { countries: { code: string; nameKr: string }[] };

function mergeCountryOptionsFromApi(allowed: { code: string; nameKr: string }[]): CountryOption[] {
  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]));
  const out: CountryOption[] = [];
  for (const row of allowed) {
    const lc = row.code.trim().toLowerCase();
    const base = byCode.get(lc);
    if (base) out.push({ ...base, nameKr: row.nameKr || base.nameKr });
  }
  return out.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));
}

export default function RecommendPage() {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneCountries, setStandaloneCountries] = useState<CountryOption[] | null>(null);
  const [countriesLoadError, setCountriesLoadError] = useState<string | null>(null);

  const loadCountries = useCallback(async () => {
    setCountriesLoadError(null);
    setStandaloneCountries(null);
    try {
      const res = await fetch("/api/bongsim/countries", { cache: "no-store" });
      const data = (await res.json()) as ApiCountriesPayload & { error?: string };
      if (!res.ok) {
        setCountriesLoadError(data.error || "국가 목록을 불러오지 못했습니다.");
        return;
      }
      const merged = mergeCountryOptionsFromApi(data.countries ?? []);
      setStandaloneCountries(merged);
    } catch {
      setCountriesLoadError("국가 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  const allCountriesExceptKorea = useMemo(() => {
    if (!standaloneCountries) return [];
    return standaloneCountries.filter((c) => c.code !== "kr");
  }, [standaloneCountries]);

  const popularCountries = useMemo(
    () =>
      POPULAR_COUNTRY_CODES.map((code) =>
        allCountriesExceptKorea.find((c) => c.code === code),
      ).filter(Boolean) as CountryOption[],
    [allCountriesExceptKorea],
  );

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return allCountriesExceptKorea;
    const q = searchQuery.toLowerCase();
    return allCountriesExceptKorea.filter(
      (c) => c.nameKr.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [searchQuery, allCountriesExceptKorea]);

  const handleCountryToggle = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleRemoveChip = (code: string) => {
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleStep1Next = () => {
    setCurrentStep(2);
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  const handleStep2Next = () => {
    /* 완료 후 리다이렉트는 ProductCombinationStep에서 처리 */
  };

  const resolveCountry = (code: string) =>
    allCountriesExceptKorea.find((c) => c.code === code) ??
    COUNTRY_OPTIONS.find((c) => c.code === code);

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:pb-28 lg:pt-10">
        <EsimServiceNoticeBanner />
        {currentStep === 1 ? (
          <>
            {/* Step 1: 국가 선택 */}
            <div className="mb-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                추천 eSIM
              </p>
              <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
                여행할 국가를 모두 선택해주세요
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                선택한 국가에 맞는 가장 합리적인 상품 조합을 찾아드려요.
              </p>
            </div>

            {selectedCodes.length > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-slate-700">선택한 국가:</span>
                {selectedCodes.map((code) => {
                  const country = resolveCountry(code);
                  if (!country) return null;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => handleRemoveChip(code)}
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
            )}

            <section className="mb-10">
              <h2 className="mb-3 text-[15px] font-bold text-slate-800">🔥 인기 여행지</h2>
              <div className="px-2">
                {standaloneCountries === null ? (
                  <p className="text-center text-[13px] text-slate-500">인기 여행지를 불러오는 중…</p>
                ) : popularCountries.length === 0 ? (
                  <p className="text-center text-[13px] text-slate-500">
                    인기 여행지 중 단독 플랜이 있는 국가가 없습니다.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-9 md:grid-cols-10">
                    {popularCountries.map((country) => {
                      const isSelected = selectedCodes.includes(country.code);
                      return (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleCountryToggle(country.code)}
                          className="flex w-full min-w-0 flex-col items-center px-1 py-2"
                        >
                          <div
                            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-full transition hover:scale-105 ${
                              isSelected
                                ? "shadow-lg ring-2 ring-blue-400"
                                : "shadow-lg ring-1 ring-gray-200"
                            }`}
                          >
                            <Image
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
                            className={`mt-1 text-xs ${
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
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
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
                )}
              </div>
              {searchQuery && standaloneCountries && (
                <p className="mt-2 text-[12px] text-slate-600">
                  <span className="font-semibold">{filteredCountries.length}개</span> 국가 검색됨
                </p>
              )}
            </div>

            <section>
              <h2 className="mb-4 text-[15px] font-bold text-slate-800">
                {searchQuery ? "검색 결과" : "전체 국가"}
              </h2>
              {countriesLoadError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
                  <p className="text-[14px] text-red-800">{countriesLoadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCountries()}
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
                  onSelect={handleCountryToggle}
                  mobileCollapseInitialCount={20}
                />
              ) : (
                <div className="py-12 text-center">
                  <p className="text-[14px] text-slate-500">검색 결과가 없습니다.</p>
                </div>
              )}
            </section>

            {selectedCodes.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-4 py-4 shadow-lg sm:px-6">
                <div className="mx-auto flex max-w-6xl justify-center">
                  <button
                    type="button"
                    onClick={handleStep1Next}
                    className="inline-flex min-h-[3.2rem] items-center justify-center rounded-2xl bg-teal-700 px-8 text-[15px] font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.98]"
                  >
                    다음 ({selectedCodes.length}개국 선택)
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Step 2: 상품 조합 선택 */
          <ProductCombinationStep
            selectedCodes={selectedCodes}
            onBack={handleStep2Back}
            onNext={handleStep2Next}
          />
        )}
      </main>
    </div>
  );
}
