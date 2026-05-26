"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";
import { CountrySelectStep } from "@/components/bongsim/recommend/CountrySelectStep";
import {
  ProductCombinationStep,
  type StoredCountryPlanSelection,
} from "@/components/bongsim/recommend/ProductCombinationStep";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import {
  clearRecommendCheckoutDispatched,
  clearRecommendFunnelSnapshot,
  loadRecommendFunnelSnapshot,
  saveRecommendFunnelSnapshot,
} from "@/lib/bongsim/recommend/funnel-storage";
import type { CountryOption } from "@/lib/bongsim/types";

/**
 * 나에게 맞는 eSIM 찾기 — 추천 퍼널.
 *
 * Step 1: 국가 선택 (단독 플랜이 DB에 있는 국가만 — GET /api/bongsim/countries)
 * Step 2: 상품 조합 선택 (개별 vs 다국가)
 */

const POPULAR_COUNTRY_CODES = ["jp", "tw", "vn", "th", "hk", "sg", "us", "cn", "kr"];

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

export default function RecommendPageClient() {
  const searchParams = useSearchParams();
  const fromCheckout = searchParams?.get("fromCheckout") === "1";

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [storedCompleted, setStoredCompleted] = useState<Record<string, StoredCountryPlanSelection>>({});
  const [funnelHydrated, setFunnelHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneCountries, setStandaloneCountries] = useState<CountryOption[] | null>(null);
  const [countriesLoadError, setCountriesLoadError] = useState<string | null>(null);
  const [heroMap, setHeroMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const snap = loadRecommendFunnelSnapshot();
    if (!snap) {
      setFunnelHydrated(true);
      return;
    }
    // 결제 화면에서만 2단계 복원. eSIM 찾기 메인 진입은 항상 국가 선택(1단계)부터.
    if (fromCheckout) {
      setSelectedCodes(snap.selectedCodes);
      setStoredCompleted(snap.completed ?? {});
      setCurrentStep(2);
    } else {
      clearRecommendFunnelSnapshot();
      setSelectedCodes([]);
      setStoredCompleted({});
      setCurrentStep(1);
      clearRecommendCheckoutDispatched();
    }
    setFunnelHydrated(true);
  }, [fromCheckout]);

  useEffect(() => {
    if (!funnelHydrated) return;
    saveRecommendFunnelSnapshot({
      step: currentStep,
      selectedCodes,
      completed: storedCompleted,
    });
  }, [currentStep, selectedCodes, storedCompleted, funnelHydrated]);

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

  const countryChoices = useMemo(() => standaloneCountries ?? [], [standaloneCountries]);

  const popularCountries = useMemo(
    () =>
      POPULAR_COUNTRY_CODES.map((code) =>
        countryChoices.find((c) => c.code === code),
      ).filter(Boolean) as CountryOption[],
    [countryChoices],
  );

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countryChoices;
    const q = searchQuery.toLowerCase();
    return countryChoices.filter(
      (c) => c.nameKr.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [searchQuery, countryChoices]);

  const handleCountryToggle = (code: string) => {
    clearRecommendCheckoutDispatched();
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleRemoveChip = (code: string) => {
    clearRecommendCheckoutDispatched();
    setSelectedCodes((prev) => prev.filter((c) => c !== code));
    setStoredCompleted((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const handleStep1Next = () => {
    clearRecommendCheckoutDispatched();
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStep2Back = () => {
    clearRecommendCheckoutDispatched();
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resolveCountry = (code: string) =>
    countryChoices.find((c) => c.code === code) ??
    COUNTRY_OPTIONS.find((c) => c.code === code);

  if (!funnelHydrated) {
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-600">
          불러오는 중…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main
        className={`mx-auto w-full max-w-6xl pb-20 pt-6 sm:pt-8 lg:pb-28 lg:pt-10 ${
          currentStep === 1 ? "px-4 sm:px-6" : "px-0 sm:px-6"
        }`}
      >
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
          <ProductCombinationStep
            key={selectedCodes.slice().sort().join(",")}
            selectedCodes={selectedCodes}
            heroMap={heroMap}
            initialStoredCompleted={storedCompleted}
            onStoredCompletedChange={setStoredCompleted}
            onBack={handleStep2Back}
          />
        )}
      </main>
    </div>
  );
}
