"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { CountrySelectStep } from "@/components/bongsim/recommend/CountrySelectStep";
import { ProductCombinationStep } from "@/components/bongsim/recommend/ProductCombinationStep";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import type { CountryOption } from "@/lib/bongsim/types";

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
  const [heroMap, setHeroMap] = useState<Record<string, string>>({});

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

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/bongsim/country-heroes", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = (await res.json().catch(() => null)) as unknown;
        if (cancelled || !data || typeof data !== "object" || Array.isArray(data)) return;
        const obj = data as Record<string, unknown>;
        if (typeof obj.error === "string") return;
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === "string" && v.trim()) {
            next[k.trim().toLowerCase()] = v.trim();
          }
        }
        setHeroMap(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
        {currentStep === 1 ? (
          <CountrySelectStep
            selectedCodes={selectedCodes}
            onToggleCountry={handleCountryToggle}
            onRemoveChip={handleRemoveChip}
            onNext={handleStep1Next}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            standaloneCountries={standaloneCountries}
            countriesLoadError={countriesLoadError}
            onRetryLoadCountries={loadCountries}
            popularCountries={popularCountries}
            filteredCountries={filteredCountries}
            resolveCountry={resolveCountry}
          />
        ) : (
          /* Step 2: 상품 조합 선택 */
          <ProductCombinationStep
            selectedCodes={selectedCodes}
            heroMap={heroMap}
            onBack={handleStep2Back}
            onNext={handleStep2Next}
          />
        )}
      </main>
    </div>
  );
}
