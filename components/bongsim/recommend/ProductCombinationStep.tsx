"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { DurationPopup } from "@/components/bongsim/recommend/DurationPopup";
import { PlanSelectPopup } from "@/components/bongsim/recommend/PlanSelectPopup";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { isCountryWithLocalNetworkChoice } from "@/lib/bongsim/recommend/local-network-countries";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  formatKrw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import type { CountryDateRange } from "@/lib/bongsim/recommend/country-date-ranges";

const HERO_IMAGE_SIZES = "(max-width:768px) 100vw, 512px";

/** DB 없음 — Unsplash 고정 URL (국가별 히어로) */
const COUNTRY_HERO: Record<string, string> = {
  jp: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=75&fit=crop",
  tw: "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=600&q=75&fit=crop",
  vn: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=75&fit=crop",
  th: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=600&q=75&fit=crop",
  hk: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=600&q=75&fit=crop",
  sg: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=75&fit=crop",
  us: "https://images.unsplash.com/photo-1485738422979-f5c462d49f04?w=600&q=75&fit=crop",
  cn: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=600&q=75&fit=crop",
};

export type CountryProductPack = {
  roaming: { min_price: number; products: ProductOption[] };
  local: { min_price: number; products: ProductOption[] } | null;
  roaming_unlimited_min: number | null;
  local_unlimited_min: number | null;
};

function countryHeroUrl(code: string): string | undefined {
  return COUNTRY_HERO[code.toLowerCase()];
}

function flagCdnUrl(code: string): string {
  return `https://flagcdn.com/w160/${code.toLowerCase()}.png`;
}

function flagCdnBlurBg(code: string): string {
  return flagCdnUrl(code);
}

function unitPriceKrw(p: ProductOption): number | null {
  if (typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)) {
    return p.recommended_price;
  }
  return computeRecommendedPrice(p.price_block);
}

function multiPlanDisplayNameKr(planName: string): string {
  return planName.trim();
}

function formatDaysRawKr(daysRaw: string): string {
  const n = extractDaysFromDaysRaw(daysRaw);
  if (n != null) return `${n}일`;
  const m = String(daysRaw).match(/(\d+)\s*days?/i);
  if (m) return `${m[1]}일`;
  return daysRaw.trim() || "—";
}

function planTypeLabelKr(planType: string | null | undefined): string {
  switch ((planType ?? "").toLowerCase()) {
    case "unlimited":
      return "무제한";
    case "daily":
      return "데일리";
    case "fixed":
      return "종량제";
    default:
      return planType?.trim() || "—";
  }
}

function networkFamilyLabelKr(family: string | undefined): string {
  switch ((family ?? "").toLowerCase()) {
    case "local":
      return "로컬";
    case "roaming":
      return "로밍";
    default:
      return family ?? "—";
  }
}

function formatShortRange(start: Date, end: Date): string {
  const sm = `${start.getMonth() + 1}/${start.getDate()}`;
  const em = `${end.getMonth() + 1}/${end.getDate()}`;
  return `${sm}~${em}`;
}

function allowanceLabelForSummary(p: ProductOption): string {
  if (isTrueUnlimited(p)) return "무제한";
  const pt = (p.plan_type || "").trim().toLowerCase();
  if (pt === "unlimited") return (p.allowance_label || "").trim() || "무제한";
  const al = (p.allowance_label || "").trim();
  if (al) return al;
  return planTypeLabelKr(p.plan_type);
}

interface ProductCombinationData {
  individual: Record<string, CountryProductPack>;
  multi: ProductOption[];
}

type FlowState =
  | { kind: "duration"; code: string; network: "roaming" | "local" }
  | {
      kind: "plan";
      code: string;
      network: "roaming" | "local";
      tripDays: number;
      start: Date;
      end: Date;
    };

export type CountryPlanSelection = { product: ProductOption; quantity: number };

interface ProductCombinationStepProps {
  selectedCodes: string[];
  onBack: () => void;
  onNext?: (selection: Record<string, CountryPlanSelection>) => void;
}

function heroCaptionLine(pack: CountryProductPack): string | null {
  const A = pack.roaming_unlimited_min;
  const B = pack.local_unlimited_min;
  if (A != null && B != null) {
    const v = Math.min(A, B);
    return `무제한 1일 ${formatKrw(v)}`;
  }
  if (A != null) return `무제한 1일 ${formatKrw(A)}`;
  if (B != null) return `무제한 1일 ${formatKrw(B)}`;
  const r = pack.roaming.min_price;
  const l = pack.local?.min_price;
  const fallback = l != null && Number.isFinite(l) ? Math.min(r, l) : r;
  if (fallback != null && Number.isFinite(fallback) && fallback > 0) {
    return `1일 ${formatKrw(fallback)}`;
  }
  return null;
}

export function ProductCombinationStep({
  selectedCodes,
  onBack,
  onNext,
}: ProductCombinationStepProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductCombinationData | null>(null);
  const [completed, setCompleted] = useState<Record<string, CountryPlanSelection>>({});
  const [countryDateRanges, setCountryDateRanges] = useState<CountryDateRange[]>([]);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [tripResume, setTripResume] = useState<{ start: Date; end: Date } | null>(null);
  const redirectRef = useRef(false);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const codes = selectedCodes.join(",");
        const res = await fetch(`/api/bongsim/products/by-country?codes=${codes}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("[ProductCombinationStep]", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    void fetchProducts();
  }, [selectedCodes]);

  const countryByCode = useMemo(
    () => Object.fromEntries(COUNTRY_OPTIONS.map((c) => [c.code, c])),
    [],
  );

  const headerTitle = useMemo(() => {
    const names = selectedCodes.map((c) => countryByCode[c]?.nameKr ?? c.toUpperCase());
    const joined = names.join(", ");
    return `${joined}의 하루 최저가격은?`;
  }, [selectedCodes, countryByCode]);

  const cheapestMulti = useMemo(() => {
    if (selectedCodes.length < 2) return null;
    const list = data?.multi ?? [];
    if (list.length === 0) return null;
    let best: ProductOption | null = null;
    let bestPrice = Infinity;
    for (const p of list) {
      const pr = unitPriceKrw(p);
      if (pr == null) continue;
      if (pr < bestPrice) {
        bestPrice = pr;
        best = p;
      }
    }
    return best;
  }, [data, selectedCodes.length]);

  const startDuration = (code: string, network: "roaming" | "local") => {
    if (completed[code]) return;
    setTripResume(null);
    setFlow({ kind: "duration", code, network });
  };

  const closeFlow = () => {
    setFlow(null);
    setTripResume(null);
  };

  const flowCode = flow?.code;
  const flowCountryName = flowCode ? (countryByCode[flowCode]?.nameKr ?? flowCode) : "";

  const allDone =
    selectedCodes.length > 0 && selectedCodes.every((c) => Boolean(completed[c]));

  useEffect(() => {
    if (!allDone) {
      redirectRef.current = false;
      return;
    }
    if (redirectRef.current) return;
    const payload = { ...completed };
    onNext?.(payload);
    const firstId = selectedCodes.map((c) => completed[c]?.product.option_api_id).find(Boolean);
    if (!firstId) return;
    redirectRef.current = true;
    window.alert("결제 시스템 준비 중입니다. 다음 주부터 이용 가능합니다.");
  }, [allDone, completed, onNext, selectedCodes]);

  const shell = (inner: ReactNode) => (
    <div className="mx-auto w-full max-w-lg px-4">{inner}</div>
  );

  if (loading) {
    return shell(
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600">상품 조회 중...</p>
      </div>,
    );
  }

  if (!data) {
    return shell(
      <div className="py-20 text-center">
        <p className="text-sm text-red-600">상품을 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 text-sm font-semibold text-teal-700 underline"
        >
          ← 국가 선택으로 돌아가기
        </button>
      </div>,
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-teal-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        국가 선택으로 돌아가기
      </button>

      <h1 className="text-center text-lg font-bold text-gray-900">{headerTitle}</h1>

      <div className="mt-8">
        {selectedCodes.map((code, idx) => {
          const country = countryByCode[code];
          const pack = data.individual[code];
          const done = Boolean(completed[code]);
          const hero = countryHeroUrl(code);
          const selection = completed[code];
          const range = countryDateRanges.find((r) => r.code === code);
          const heroLine = pack ? heroCaptionLine(pack) : null;
          const roamingBtnPrice =
            pack && pack.roaming.min_price > 0 ? formatKrw(pack.roaming.min_price) : "—";
          const localBtnPrice =
            pack?.local && pack.local.min_price > 0 ? formatKrw(pack.local.min_price) : "—";

          const summaryParts: string[] = [];
          if (selection) {
            summaryParts.push(networkFamilyLabelKr(selection.product.network_family));
            if (range) summaryParts.push(formatShortRange(range.start, range.end));
            summaryParts.push(`${allowanceLabelForSummary(selection.product)} ×${selection.quantity}`);
          }
          const summaryLine = summaryParts.join(" · ");

          return (
            <Fragment key={code}>
              {idx > 0 ? (
                <div className="my-3 flex justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-light text-gray-500">
                    +
                  </span>
                </div>
              ) : null}
              <div className="w-full overflow-hidden rounded-2xl shadow-lg">
                <div className="relative h-44 w-full overflow-hidden bg-gray-900">
                  {hero ? (
                    <Image
                      src={hero}
                      alt=""
                      fill
                      className="object-cover"
                      sizes={HERO_IMAGE_SIZES}
                      quality={90}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 overflow-hidden">
                      <Image
                        src={flagCdnBlurBg(code)}
                        alt=""
                        fill
                        quality={90}
                        className="scale-110 object-cover blur-[20px]"
                        sizes={HERO_IMAGE_SIZES}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/45" aria-hidden />
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12">
                    <div className="flex items-end gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-lg ring-1 ring-gray-200">
                        <Image
                          src={flagCdnUrl(code)}
                          alt=""
                          width={48}
                          height={48}
                          quality={90}
                          className="h-full w-full object-cover"
                          sizes="48px"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xl font-bold text-white drop-shadow-md">
                          {country?.nameKr ?? code.toUpperCase()}
                        </p>
                        {heroLine ? (
                          <p className="mt-0.5 text-sm text-white/80 drop-shadow-md">{heroLine}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white px-4 py-3">
                  {done ? (
                    <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-3">
                      <svg
                        className="mt-0.5 h-5 w-5 shrink-0 text-blue-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium text-blue-600" title={summaryLine}>
                        {summaryLine}
                      </span>
                    </div>
                  ) : isCountryWithLocalNetworkChoice(code) ? (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => startDuration(code, "roaming")}
                        className="flex min-h-[5.5rem] flex-1 flex-col items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-center transition hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span className="text-sm font-bold text-gray-900">가심비 최상</span>
                        <span className="mt-0.5 text-xs text-gray-500">로밍망</span>
                        <span className="mt-1 text-sm font-semibold text-blue-500">{roamingBtnPrice}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startDuration(code, "local")}
                        className="flex min-h-[5.5rem] flex-1 flex-col items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-center transition hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span className="text-sm font-bold text-gray-900">현지인들처럼</span>
                        <span className="mt-0.5 text-xs text-gray-500">로컬망</span>
                        <span className="mt-1 text-sm font-semibold text-blue-500">{localBtnPrice}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startDuration(code, "roaming")}
                      className="flex w-full min-h-[5.5rem] flex-col items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-center transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <span className="text-sm font-bold text-gray-900">가심비 최상</span>
                      <span className="mt-0.5 text-xs text-gray-500">로밍망</span>
                      <span className="mt-1 text-sm font-semibold text-blue-500">{roamingBtnPrice}</span>
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {selectedCodes.length >= 2 && cheapestMulti != null ? (
        <section className="mt-10 border-t border-gray-200 pt-8">
          <h3 className="mb-4 text-base font-bold text-gray-800">다른 상품들과도 비교해보세요</h3>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-base font-bold text-gray-900">
              {multiPlanDisplayNameKr(cheapestMulti.plan_name)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {formatDaysRawKr(cheapestMulti.days_raw)} / {planTypeLabelKr(cheapestMulti.plan_type)}
            </p>
            {unitPriceKrw(cheapestMulti) != null && (
              <p className="mt-2 text-base font-semibold text-blue-500">
                {formatKrw(unitPriceKrw(cheapestMulti)!)}
              </p>
            )}
          </div>
        </section>
      ) : null}

      <DurationPopup
        open={flow?.kind === "duration"}
        countryName={flowCountryName}
        resumeApplied={flow?.kind === "duration" ? tripResume : undefined}
        otherCountryRanges={
          flow?.kind === "duration"
            ? countryDateRanges.filter((r) => r.code !== flow.code)
            : undefined
        }
        currentCountryCode={flow?.kind === "duration" ? flow.code : undefined}
        onClose={closeFlow}
        onBack={closeFlow}
        onNext={(payload) => {
          if (flow?.kind !== "duration") return;
          setTripResume({ start: payload.start, end: payload.end });
          setCountryDateRanges((prev) => [
            ...prev.filter((r) => r.code !== flow.code),
            { code: flow.code, start: payload.start, end: payload.end },
          ]);
          setFlow({
            kind: "plan",
            code: flow.code,
            network: flow.network,
            tripDays: payload.tripDays,
            start: payload.start,
            end: payload.end,
          });
        }}
      />

      {flow?.kind === "plan" ? (
        <PlanSelectPopup
          open
          countryName={flowCountryName}
          countryCode={flow.code}
          allSelectedCodes={selectedCodes}
          network={flow.network}
          tripDays={flow.tripDays}
          onBack={() => {
            setFlow({
              kind: "duration",
              code: flow.code,
              network: flow.network,
            });
          }}
          onComplete={(product, quantity) => {
            setCompleted((prev) => ({ ...prev, [flow.code]: { product, quantity } }));
            closeFlow();
          }}
        />
      ) : null}
    </div>
  );
}
