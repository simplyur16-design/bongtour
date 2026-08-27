"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
import { parseRecommendCountryQuery } from "@/lib/bongsim/recommend/parse-recommend-entry-query";
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

/** ISR page — no server searchParams. Client reads query without next/navigation (Suspense spin 방지). */
function subscribeFromCheckoutQuery() {
  return () => {};
}
function getFromCheckoutQuerySnapshot(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("fromCheckout") === "1";
  } catch {
    return false;
  }
}
function getFromCheckoutQueryServerSnapshot(): boolean {
  return false;
}

function getCountryQuerySnapshot(): string | null {
  try {
    return parseRecommendCountryQuery(window.location.search);
  } catch {
    return null;
  }
}
function getCountryQueryServerSnapshot(): string | null {
  return null;
}

function stripRecommendCountryQueryFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("country")) return;
    url.searchParams.delete("country");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    /* ignore */
  }
}

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
  // REGRESSION-FREEZE[bongsim-recommend-no-hard-refresh-spin]: query via useSyncExternalStore·일반 진입 즉시 페인트 — manifest
  const fromCheckout = useSyncExternalStore(
    subscribeFromCheckoutQuery,
    getFromCheckoutQuerySnapshot,
    getFromCheckoutQueryServerSnapshot,
  );
  // REGRESSION-FREEZE[bongsim-recommend-country-unlimited-first]: 홈 ?country= → 국가 피커 스킵 — manifest
  const countryFromQuery = useSyncExternalStore(
    subscribeFromCheckoutQuery,
    getCountryQuerySnapshot,
    getCountryQueryServerSnapshot,
  );
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [step1View, setStep1View] = useState<Step1View>("pick");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [dismissedCountryQuery, setDismissedCountryQuery] = useState(false);
  const [storedCompleted, setStoredCompleted] = useState<Record<string, StoredCountryPlanSelection>>({});
  /** 체크아웃 복귀(?fromCheckout=1)만 스냅샷 복원 대기 — 일반 진입은 즉시 funnelHydrated */
  const [checkoutRestoreDone, setCheckoutRestoreDone] = useState(false);
  const funnelHydrated = !fromCheckout || checkoutRestoreDone;
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
    if (fromCheckout) {
      if (snap) {
        setSelectedCodes(snap.selectedCodes);
        setStoredCompleted(snap.completed ?? {});
        setCurrentStep(2);
        setStep1View(snap.selectedCodes.length >= 2 ? "multi-trip" : "pick");
      }
      setCheckoutRestoreDone(true);
      return;
    }

    if (countryFromQuery) {
      clearRecommendFunnelSnapshot();
      setSelectedCodes([countryFromQuery]);
      setStoredCompleted({});
      setCurrentStep(2);
      setStep1View("pick");
      clearRecommendCheckoutDispatched();
      setCheckoutRestoreDone(true);
      return;
    }

    if (snap) {
      clearRecommendFunnelSnapshot();
      setSelectedCodes([]);
      setStoredCompleted({});
      setCurrentStep(1);
      setStep1View("pick");
      clearRecommendCheckoutDispatched();
    }
    setCheckoutRestoreDone(true);
  }, [fromCheckout, countryFromQuery]);

  const entryCountry = fromCheckout || dismissedCountryQuery ? null : countryFromQuery;
  const skipPickerToProducts =
    Boolean(entryCountry) && currentStep === 1 && selectedCodes.length === 0;
  const viewCodes = skipPickerToProducts && entryCountry ? [entryCountry] : selectedCodes;
  const viewStep: 1 | 2 = currentStep === 2 || skipPickerToProducts ? 2 : 1;

  useEffect(() => {
    if (!funnelHydrated) return;
    saveRecommendFunnelSnapshot({
      step: viewStep,
      selectedCodes: viewCodes,
      completed: storedCompleted,
    });
  }, [viewStep, viewCodes, storedCompleted, funnelHydrated]);

  const loadCountries = useCallback(async () => {
    // 목록을 null로 비우지 않음 — null이면 「불러오는 중…」에 갇히고, 실패 시에도 재시도 UI가 안 보임
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 20_000);
    try {
      const res = await fetch("/api/bongsim/countries", { cache: "no-store", signal: ac.signal });
      const data = (await res.json()) as ApiCountriesPayload & { error?: string };
      if (!res.ok) {
        setCountriesLoadError(data.error || "국가 목록을 불러오지 못했습니다.");
        return;
      }
      const merged = mergeCountryOptionsFromApi(data.countries ?? []);
      setStandaloneCountries(merged);
      setCatalogMeta(data.catalogMeta ?? {});
      setCountriesLoadError(null);
    } catch {
      setCountriesLoadError("국가 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      window.clearTimeout(timer);
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
    setDismissedCountryQuery(true);
    setCurrentStep(1);
    setStep1View(selectedCodes.length >= 2 ? "multi-trip" : "pick");
    stripRecommendCountryQueryFromUrl();
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

  const isSingleCountryRecommend = viewStep === 2 && viewCodes.length === 1;

  if (fromCheckout && !funnelHydrated) {
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
      className={`min-h-screen ${viewStep === 1 || isSingleCountryRecommend ? "max-lg:bg-[#f9f9f9]" : "bg-bt-page"}`}
    >
      <Header />
      <main
        className={
          viewStep === 1
            ? "mx-auto w-full pb-0 pt-0 lg:max-w-5xl lg:px-6 lg:pb-28 lg:pt-10"
            : isSingleCountryRecommend
              ? "mx-auto w-full pb-0 pt-0 lg:max-w-5xl lg:px-6 lg:pb-28 lg:pt-10"
              : `mx-auto w-full max-w-6xl pb-20 pt-6 sm:pt-8 lg:pb-28 lg:pt-10 px-0 sm:px-6`
        }
      >
        {viewStep === 1 ? (
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
            key={viewCodes.slice().sort().join(",")}
            selectedCodes={viewCodes}
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
