"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/Header";
import { CountrySelectStep } from "@/components/bongsim/recommend/CountrySelectStep";
import { MultiTripCountrySelectStep } from "@/components/bongsim/recommend/MultiTripCountrySelectStep";
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
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";
import { applyCatalogMeta } from "@/lib/bongsim/recommend/apply-catalog-meta";
import {
  buildAllMultiCountryTiles,
  buildRecommendPopularCountries,
} from "@/lib/bongsim/recommend/recommend-destination-sections";
import { sortByKoreanTravelRank2025 } from "@/lib/bongsim/recommend/sort-by-korean-travel-rank";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import type { CountryCatalogMeta } from "@/lib/bongsim/data/list-country-catalog-meta";
import type { CountryOption } from "@/lib/bongsim/types";

type ApiCountryRow = {
  code: string;
  nameKr: string;
  isUnlimited?: boolean;
  travelerVerification?: CountryOption["travelerVerification"];
};

type ApiCountriesPayload = {
  countries: ApiCountryRow[];
  catalogMeta?: Record<string, CountryCatalogMeta>;
};

type Step1View = "pick" | "multi-trip";

function mergeCountryOptionsFromApi(allowed: ApiCountryRow[]): CountryOption[] {
  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c]));
  const out: CountryOption[] = [];
  for (const row of allowed) {
    const lc = row.code.trim().toLowerCase();
    const base = byCode.get(lc);
    if (!base) continue;
    out.push({
      ...base,
      nameKr: row.nameKr || base.nameKr,
      ...(row.isUnlimited ? { isUnlimited: true } : {}),
      ...(row.travelerVerification && row.travelerVerification !== "none"
        ? { travelerVerification: row.travelerVerification }
        : {}),
    });
  }
  return sortByKoreanTravelRank2025(out);
}

export default function RecommendPageClient({
  initialCountries = null,
  initialCatalogMeta = null,
  initialHeroMap = null,
  bootstrapError = null,
}: {
  initialCountries?: ApiCountryRow[] | null;
  initialCatalogMeta?: Record<string, CountryCatalogMeta> | null;
  initialHeroMap?: Record<string, string> | null;
  bootstrapError?: string | null;
}) {
  const searchParams = useSearchParams();
  const fromCheckout = searchParams?.get("fromCheckout") === "1";

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [step1View, setStep1View] = useState<Step1View>("pick");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [storedCompleted, setStoredCompleted] = useState<Record<string, StoredCountryPlanSelection>>({});
  const [funnelHydrated, setFunnelHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [standaloneCountries, setStandaloneCountries] = useState<CountryOption[] | null>(() => {
    if (!initialCountries?.length) return null;
    return mergeCountryOptionsFromApi(initialCountries);
  });
  const [catalogMeta, setCatalogMeta] = useState<Record<string, CountryCatalogMeta>>(
    () => initialCatalogMeta ?? {},
  );
  const [countriesLoadError, setCountriesLoadError] = useState<string | null>(() =>
    bootstrapError ? "국가 목록을 불러오지 못했습니다." : null,
  );
  const [heroMap, setHeroMap] = useState<Record<string, string>>(() => initialHeroMap ?? {});

  useEffect(() => {
    const snap = loadRecommendFunnelSnapshot();
    if (!snap) {
      setFunnelHydrated(true);
      return;
    }
    if (fromCheckout) {
      setSelectedCodes(snap.selectedCodes);
      setStoredCompleted(snap.completed ?? {});
      setCurrentStep(2);
      setStep1View(snap.selectedCodes.length >= 2 ? "multi-trip" : "pick");
    } else {
      clearRecommendFunnelSnapshot();
      setSelectedCodes([]);
      setStoredCompleted({});
      setCurrentStep(1);
      setStep1View("pick");
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
      setCatalogMeta(data.catalogMeta ?? {});
    } catch {
      setCountriesLoadError("국가 목록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (initialCountries?.length) return;
    void loadCountries();
  }, [loadCountries, initialCountries]);

  useEffect(() => {
    if (initialHeroMap && Object.keys(initialHeroMap).length > 0) return;
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
  }, [initialHeroMap]);

  const countryChoices = useMemo(() => standaloneCountries ?? [], [standaloneCountries]);

  const popularCountries = useMemo(
    () => buildRecommendPopularCountries(countryChoices, catalogMeta),
    [countryChoices, catalogMeta],
  );

  const allMultiCountryPacks = useMemo(
    () => buildAllMultiCountryTiles(catalogMeta),
    [catalogMeta],
  );

  const filteredCountries = useMemo(() => {
    const base = !searchQuery.trim()
      ? countryChoices
      : countryChoices.filter(
          (c) =>
            c.nameKr.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.code.toLowerCase().includes(searchQuery.toLowerCase()),
        );
    return sortByKoreanTravelRank2025(
      base.map((c) => applyCatalogMeta(c, catalogMeta[c.code])),
    );
  }, [searchQuery, countryChoices, catalogMeta]);

  const goToProductStep = useCallback((codes: string[]) => {
    clearRecommendCheckoutDispatched();
    setStoredCompleted({});
    setSelectedCodes(codes);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePickCountry = useCallback(
    (code: string) => {
      goToProductStep([code]);
    },
    [goToProductStep],
  );

  const handleMultiTripToggle = (code: string) => {
    if (isRegionPackCode(code)) return;
    clearRecommendCheckoutDispatched();
    setSelectedCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
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

  const handleMultiTripNext = () => {
    if (selectedCodes.length < 2) return;
    goToProductStep(selectedCodes);
  };

  const handleStep2Back = () => {
    clearRecommendCheckoutDispatched();
    setCurrentStep(1);
    setStep1View(selectedCodes.length >= 2 ? "multi-trip" : "pick");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEnterMultiTrip = () => {
    setStep1View("multi-trip");
    setSelectedCodes([]);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackFromMultiTrip = () => {
    setStep1View("pick");
    setSelectedCodes([]);
    setSearchQuery("");
  };

  const resolveCountry = (code: string) => {
    const lc = code.trim().toLowerCase();
    const fromChoices = countryChoices.find((c) => c.code === lc);
    if (fromChoices) return fromChoices;
    const base =
      COUNTRY_OPTIONS.find((c) => c.code === lc) ??
      REGION_PACK_OPTIONS.find((c) => c.code === lc);
    if (base) return applyCatalogMeta(base, catalogMeta[lc]);
    return undefined;
  };

  const isSingleCountryRecommend = currentStep === 2 && selectedCodes.length === 1;

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
    <div
      className={`min-h-screen ${currentStep === 1 || isSingleCountryRecommend ? "max-lg:bg-[#f9f9f9]" : "bg-bt-page"}`}
    >
      <Header />
      <main
        className={
          currentStep === 1
            ? "mx-auto w-full pb-0 pt-0 lg:max-w-5xl lg:px-6 lg:pb-28 lg:pt-10"
            : isSingleCountryRecommend
              ? "mx-auto w-full pb-0 pt-0 lg:max-w-5xl lg:px-6 lg:pb-28 lg:pt-10"
              : `mx-auto w-full max-w-6xl pb-20 pt-6 sm:pt-8 lg:pb-28 lg:pt-10 px-0 sm:px-6`
        }
      >
        {currentStep === 1 ? (
          step1View === "pick" ? (
            <CountrySelectStep
              onPickCountry={handlePickCountry}
              onEnterMultiTrip={handleEnterMultiTrip}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              standaloneCountries={standaloneCountries}
              countriesLoadError={countriesLoadError}
              onRetryLoadCountries={loadCountries}
              popularCountries={popularCountries}
              allMultiCountryPacks={allMultiCountryPacks}
              filteredCountries={filteredCountries}
            />
          ) : (
            <MultiTripCountrySelectStep
              selectedCodes={selectedCodes}
              onToggleCountry={handleMultiTripToggle}
              onRemoveChip={handleRemoveChip}
              onNext={handleMultiTripNext}
              onBack={handleBackFromMultiTrip}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              standaloneCountries={standaloneCountries}
              countriesLoadError={countriesLoadError}
              onRetryLoadCountries={loadCountries}
              popularCountries={popularCountries}
              filteredCountries={filteredCountries}
              resolveCountry={resolveCountry}
            />
          )
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
