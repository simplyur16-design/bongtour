"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SafeImage from "@/app/components/SafeImage";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DurationPopup } from "@/components/bongsim/recommend/DurationPopup";
import { PlanSelectPopup } from "@/components/bongsim/recommend/PlanSelectPopup";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { bongsimPath, type BongsimRecommendCheckoutLine } from "@/lib/bongsim/constants";
import {
  clearRecommendCheckoutDispatched,
  markRecommendCheckoutDispatched,
  wasRecommendCheckoutDispatched,
  writeRecommendCheckoutQueue,
} from "@/lib/bongsim/recommend/funnel-storage";
import type { RecommendFunnelSnapshot } from "@/lib/bongsim/recommend/funnel-storage";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  formatKrw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import {
  planNameMatchesSuggestion,
  suggestMultiPlanNamesForSelection,
} from "@/lib/bongsim/recommend/multi-country-suggest";
import type { CountryDateRange } from "@/lib/bongsim/recommend/country-date-ranges";

const HERO_IMAGE_SIZES = "(max-width:1023px) 100vw, 55vw";

export type CountryProductPack = {
  roaming: { min_price: number; products: ProductOption[] };
  local: { min_price: number; products: ProductOption[] } | null;
  roaming_unlimited_min: number | null;
  local_unlimited_min: number | null;
};

function countryHeroUrl(code: string, heroMap: Record<string, string>): string | undefined {
  return heroMap[code.toLowerCase()];
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

/** 로밍·로컬 구분 없이 해당 국가 패키지 전체 상품 중 소비자가 최저 1개 */
function overallMinUnitPriceKrw(pack: CountryProductPack): number | null {
  let min: number | null = null;
  for (const p of pack.roaming.products) {
    const u = unitPriceKrw(p);
    if (u != null && u > 0 && Number.isFinite(u)) {
      if (min == null || u < min) min = u;
    }
  }
  if (pack.local) {
    for (const p of pack.local.products) {
      const u = unitPriceKrw(p);
      if (u != null && u > 0 && Number.isFinite(u)) {
        if (min == null || u < min) min = u;
      }
    }
  }
  return min;
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

type FlowState = { kind: "duration"; code: string };

/** 기간 확정 후 해당 국가 카드 밑 인라인 플랜 선택 */
type OpenPlanByCode = Record<
  string,
  { tripDays: number; start: Date; end: Date }
>;

export type CountryPlanSelection = { product: ProductOption; quantity: number };

export type StoredCountryPlanSelection = RecommendFunnelSnapshot["completed"][string];

interface ProductCombinationStepProps {
  selectedCodes: string[];
  /** GET /api/bongsim/country-heroes — 없는 코드는 국기 blur 폴백 */
  heroMap: Record<string, string>;
  /** sessionStorage 복원 — product 없이 요약만 */
  initialStoredCompleted?: Record<string, StoredCountryPlanSelection>;
  onStoredCompletedChange?: (completed: Record<string, StoredCountryPlanSelection>) => void;
  onBack: () => void;
  onNext?: (selection: Record<string, CountryPlanSelection>) => void;
}

function buildQueueFromSelections(
  selectedCodes: string[],
  completed: Record<string, CountryPlanSelection>,
  storedDone: Record<string, StoredCountryPlanSelection>,
): BongsimRecommendCheckoutLine[] {
  const out: BongsimRecommendCheckoutLine[] = [];
  for (const code of selectedCodes) {
    const live = completed[code];
    if (live?.product?.option_api_id) {
      out.push({ optionApiId: live.product.option_api_id, quantity: live.quantity });
      continue;
    }
    const stored = storedDone[code];
    if (stored?.optionApiId) {
      out.push({ optionApiId: stored.optionApiId, quantity: stored.quantity });
    }
  }
  return out;
}

/** 국가별 평균 일일 데이터 (GB). 미등록 국가는 1.3GB. */
const AVG_DATA_BY_COUNTRY: Record<string, number> = {
  jp: 1.6,
  tw: 1.3,
  us: 1,
  sg: 0.92,
  ph: 0.75,
  th: 1.1,
  vn: 1,
};

/** 소수 GB 표기 (예: 1.6GB, 0.92GB, 1GB) */
function formatAvgDailyGbLabel(gb: number): string {
  const s = (Math.round(gb * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${s}GB`;
}

type TravelerAvgDailyProgressBarProps = { countryNameKr: string; code: string };

/** 미완료 카드 전용 — 일일 평균 사용량 vs 알뜰/스마트/자유 구간 (표시만, 클릭 없음) */
function TravelerAvgDailyProgressBar({ countryNameKr, code }: TravelerAvgDailyProgressBarProps) {
  const avgGb = AVG_DATA_BY_COUNTRY[code?.toLowerCase() ?? ""] ?? 1.3;
  const markerLeftPct = Math.min(95, Math.max(5, (avgGb / 5) * 100));

  return (
    <div className="mt-4 px-4 pb-4 sm:px-5 sm:pb-5">
      <p className="mb-3 text-sm font-semibold text-slate-800 sm:text-base">
        {countryNameKr} 여행자 평균 하루 {formatAvgDailyGbLabel(avgGb)} 사용
      </p>

      <div className="relative w-full">
        <div className="flex h-9 w-full overflow-hidden rounded-full border border-slate-200 sm:h-10">
          <div className="flex flex-[0_0_20%] items-center justify-center bg-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-800 sm:text-xs">알뜰</span>
          </div>
          <div className="flex flex-[0_0_20%] items-center justify-center border-x border-white/50 bg-teal-100">
            <span className="text-[11px] font-semibold text-teal-800 sm:text-xs">스마트</span>
          </div>
          <div className="flex flex-[0_0_60%] items-center justify-center bg-sky-100">
            <span className="text-[11px] font-semibold text-sky-800 sm:text-xs">자유</span>
          </div>
        </div>

        <div className="relative mt-1 flex justify-between px-0.5">
          <span className="text-[11px] text-slate-500">0</span>
          <span
            className="absolute text-[11px] text-slate-500"
            style={{ left: "20%", transform: "translateX(-50%)" }}
          >
            1GB
          </span>
          <span
            className="absolute text-[11px] text-slate-500"
            style={{ left: "40%", transform: "translateX(-50%)" }}
          >
            2GB
          </span>
          <span className="absolute text-[11px] text-slate-500" style={{ right: 0 }}>
            5GB+
          </span>
        </div>

        <div
          className="absolute -top-1"
          style={{ left: `${markerLeftPct}%`, transform: "translateX(-50%)" }}
        >
          <div className="flex flex-col items-center">
            <span className="rounded-md border border-teal-200 bg-white px-2 py-0.5 text-xs font-bold text-teal-700 shadow-sm sm:text-sm">
              평균 {formatAvgDailyGbLabel(avgGb)}
            </span>
            <span className="text-xs leading-none text-teal-500" aria-hidden>
              ▼
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">알뜰: 지도, 메시지, 기본 검색</p>
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">스마트: SNS, 맛집검색, 번역앱 · 사진은 호텔 Wi-Fi 권장</p>
        <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">자유: 실시간 스트리밍, 영상통화</p>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 sm:text-xs">* 2025 해외여행 데이터 사용량 분석 기준</p>
    </div>
  );
}

export function ProductCombinationStep({
  selectedCodes,
  heroMap,
  initialStoredCompleted,
  onStoredCompletedChange,
  onBack,
  onNext,
}: ProductCombinationStepProps) {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductCombinationData | null>(null);
  const [completed, setCompleted] = useState<Record<string, CountryPlanSelection>>({});
  const [storedDone, setStoredDone] = useState<Record<string, StoredCountryPlanSelection>>(
    () => initialStoredCompleted ?? {},
  );
  const [countryDateRanges, setCountryDateRanges] = useState<CountryDateRange[]>([]);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [openPlanByCode, setOpenPlanByCode] = useState<OpenPlanByCode>({});
  const [tripResume, setTripResume] = useState<{ start: Date; end: Date } | null>(null);
  const redirectRef = useRef(false);
  const storedDoneParentSyncReady = useRef(false);
  const [checkoutPaused, setCheckoutPaused] = useState(
    () => Object.keys(initialStoredCompleted ?? {}).length > 0,
  );

  useEffect(() => {
    if (!onStoredCompletedChange) return;
    if (!storedDoneParentSyncReady.current) {
      storedDoneParentSyncReady.current = true;
      return;
    }
    onStoredCompletedChange(storedDone);
  }, [storedDone, onStoredCompletedChange]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setCheckoutPaused(true);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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
    return names.join(", ");
  }, [selectedCodes, countryByCode]);

  const suggestedPlanHints = useMemo(() => suggestMultiPlanNamesForSelection(selectedCodes), [selectedCodes]);

  const suggestedMultiProducts = useMemo(() => {
    if (selectedCodes.length < 2) return [];
    const multi = data?.multi ?? [];
    const hinted = suggestedPlanHints.length
      ? multi.filter((p) => planNameMatchesSuggestion(p.plan_name, suggestedPlanHints))
      : [];
    const list = hinted.length > 0 ? hinted : multi;
    return [...list].sort((a, b) => (unitPriceKrw(a) ?? 1e15) - (unitPriceKrw(b) ?? 1e15));
  }, [data, selectedCodes, suggestedPlanHints]);

  const estimateTripDays = useMemo(() => {
    let m = 7;
    for (const r of countryDateRanges) {
      const ms = r.end.getTime() - r.start.getTime();
      const days = Math.max(1, Math.ceil(ms / 86400000) + 1);
      m = Math.max(m, days);
    }
    return m;
  }, [countryDateRanges]);

  const individualEstimateTotalKrw = useMemo(() => {
    if (!data || selectedCodes.length < 2) return 0;
    let sum = 0;
    for (const code of selectedCodes) {
      const pack = data.individual[code];
      if (!pack) continue;
      const u = overallMinUnitPriceKrw(pack);
      if (u == null || u <= 0) continue;
      sum += u * estimateTripDays;
    }
    return sum;
  }, [data, selectedCodes, estimateTripDays]);

  const isCountryDone = (code: string) => Boolean(completed[code] || storedDone[code]);

  const completeCountryPlan = (code: string, product: ProductOption, quantity: number) => {
    const range = countryDateRanges.find((r) => r.code === code);
    const summaryParts: string[] = [];
    summaryParts.push(networkFamilyLabelKr(product.network_family));
    if (range) summaryParts.push(formatShortRange(range.start, range.end));
    summaryParts.push(`${allowanceLabelForSummary(product)} ×${quantity}`);
    const summaryLine = summaryParts.join(" · ");
    setCompleted((prev) => ({ ...prev, [code]: { product, quantity } }));
    setStoredDone((prev) => ({
      ...prev,
      [code]: {
        optionApiId: product.option_api_id,
        quantity,
        summaryLine,
      },
    }));
    setOpenPlanByCode((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const startDuration = (code: string) => {
    setCheckoutPaused(false);
    clearRecommendCheckoutDispatched();
    setCompleted((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setStoredDone((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setOpenPlanByCode((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    setTripResume(null);
    setFlow({ kind: "duration", code });
  };

  const closeFlow = () => {
    setFlow(null);
    setTripResume(null);
  };

  const reopenDurationForPlan = (code: string) => {
    const ctx = openPlanByCode[code];
    setOpenPlanByCode((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
    if (ctx) setTripResume({ start: ctx.start, end: ctx.end });
    setFlow({ kind: "duration", code });
  };

  const flowCode = flow?.code;
  const flowCountryName = flowCode ? (countryByCode[flowCode]?.nameKr ?? flowCode) : "";

  const allDone =
    selectedCodes.length > 0 && selectedCodes.every((c) => isCountryDone(c));

  const checkoutQueue = useMemo(
    () => buildQueueFromSelections(selectedCodes, completed, storedDone),
    [selectedCodes, completed, storedDone],
  );

  const checkoutAlreadyDispatched = useMemo(
    () => checkoutQueue.length > 0 && wasRecommendCheckoutDispatched(checkoutQueue),
    [checkoutQueue],
  );

  const goToCheckout = () => {
    if (checkoutQueue.length === 0) return;
    const payload = { ...completed };
    onNext?.(payload);
    writeRecommendCheckoutQueue(checkoutQueue);
    markRecommendCheckoutDispatched(checkoutQueue);
    const first = checkoutQueue[0]!;
    const checkoutPath = `${bongsimPath("/checkout")}?optionApiId=${encodeURIComponent(first.optionApiId)}&qty=${encodeURIComponent(String(first.quantity))}`;
    redirectRef.current = true;
    setCheckoutPaused(false);
    if (sessionStatus === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    router.push(checkoutPath);
  };

  useEffect(() => {
    if (!allDone) {
      redirectRef.current = false;
      return;
    }
    if (redirectRef.current) return;
    if (checkoutPaused) return;
    if (checkoutAlreadyDispatched) return;
    if (sessionStatus === "loading") return;
    if (checkoutQueue.length === 0) return;
    goToCheckout();
  }, [
    allDone,
    checkoutAlreadyDispatched,
    checkoutPaused,
    checkoutQueue,
    completed,
    onNext,
    router,
    sessionStatus,
  ]);

  const shell = (inner: ReactNode) => (
    <div className="mx-auto w-full max-w-none px-0 sm:px-4 lg:max-w-5xl lg:px-6">{inner}</div>
  );

  if (loading) {
    return shell(
      <div className="py-20 text-center lg:py-24">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent lg:h-10 lg:w-10 lg:border-[5px]" />
        <p className="mt-4 text-sm text-gray-600 lg:mt-5 lg:text-base">상품 조회 중...</p>
      </div>,
    );
  }

  if (!data) {
    return shell(
      <div className="py-20 text-center lg:py-24">
        <p className="text-sm text-red-600 lg:text-base">상품을 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold !text-black shadow-sm hover:border-teal-300 hover:bg-teal-50"
          style={{ color: "#000000" }}
        >
          ← 국가 선택으로 돌아가기
        </button>
      </div>,
    );
  }

  return (
    <div className="bt-bongsim-readable mx-auto w-full max-w-none pb-8 sm:px-4 lg:mx-auto lg:max-w-5xl lg:px-6 lg:pb-12">
      <div className="px-4 sm:px-0">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold !text-black shadow-sm transition hover:border-teal-300 hover:bg-teal-50 sm:text-base"
          style={{ color: "#000000" }}
        >
          <svg
            className="h-5 w-5 shrink-0 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-black">국가 선택으로 돌아가기</span>
        </button>

        <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl lg:text-[1.65rem]">
          {headerTitle} eSIM
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600 sm:text-base">
          카드를 눌러 여행 기간을 고른 뒤, 요금제 선택 단계에서 가격을 확인하세요.
        </p>
      </div>

      <div className="mt-6 space-y-4 sm:mt-8 lg:mt-10">
        {selectedCodes.map((code, idx) => {
          const country = countryByCode[code];
          const pack = data.individual[code];
          const done = isCountryDone(code);
          const hero = countryHeroUrl(code, heroMap);
          const selection = completed[code];
          const stored = storedDone[code];
          const planCtx = openPlanByCode[code];
          const planOpen = Boolean(planCtx);
          const range = countryDateRanges.find((r) => r.code === code);
          let summaryLine = stored?.summaryLine ?? "";
          if (selection) {
            const summaryParts: string[] = [];
            summaryParts.push(networkFamilyLabelKr(selection.product.network_family));
            if (range) summaryParts.push(formatShortRange(range.start, range.end));
            summaryParts.push(`${allowanceLabelForSummary(selection.product)} ×${selection.quantity}`);
            summaryLine = summaryParts.join(" · ");
          }

          return (
            <Fragment key={code}>
              {idx > 0 ? (
                <div className="my-3 flex justify-center lg:my-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-light text-gray-500 lg:h-12 lg:w-12 lg:text-xl">
                    +
                  </span>
                </div>
              ) : null}
              <div
                className={`w-full cursor-pointer overflow-hidden shadow-lg transition hover:ring-2 hover:ring-blue-300/60 lg:flex lg:min-h-[280px] ${
                  planOpen
                    ? "rounded-t-2xl sm:rounded-t-2xl lg:rounded-t-2xl"
                    : "sm:rounded-2xl lg:rounded-2xl"
                }`}
                role="button"
                tabIndex={0}
                onClick={() => startDuration(code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startDuration(code);
                  }
                }}
              >
                {/* 모바일: 세로형 히어로 / PC(lg+): 가로형 왼쪽 히어로 */}
                <div className="relative aspect-[3/4] w-full max-h-[min(72vh,520px)] overflow-hidden bg-gray-900 sm:aspect-[4/5] sm:max-h-none lg:aspect-auto lg:h-auto lg:max-h-none lg:min-h-[280px] lg:w-[52%] lg:shrink-0">
                  {hero ? (
                    <SafeImage
                      src={hero}
                      alt=""
                      fill
                      className="object-cover object-center"
                      sizes={HERO_IMAGE_SIZES}
                      quality={90}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 overflow-hidden">
                      <SafeImage
                        src={flagCdnBlurBg(code)}
                        alt=""
                        fill
                        quality={90}
                        className="h-full w-full scale-110 object-cover object-center blur-[20px]"
                        sizes={HERO_IMAGE_SIZES}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/45" aria-hidden />
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-black/70 lg:via-black/25 lg:to-transparent"
                    aria-hidden
                  />
                  {/* 모바일: 하단 중앙 */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end px-5 pb-5 pt-16 sm:px-6 sm:pb-6 lg:hidden">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full shadow-lg ring-2 ring-white/80">
                        <SafeImage
                          src={flagCdnUrl(code)}
                          alt=""
                          width={64}
                          height={64}
                          quality={90}
                          className="h-full w-full object-cover"
                          sizes="64px"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-2xl font-bold text-white drop-shadow-md">
                        {country?.nameKr ?? code.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  {/* PC: 왼쪽 하단 가로 배치 */}
                  <div className="absolute inset-x-0 bottom-0 hidden px-8 pb-8 pt-20 lg:flex lg:items-end lg:justify-start">
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full shadow-lg ring-2 ring-white/80">
                        <SafeImage
                          src={flagCdnUrl(code)}
                          alt=""
                          width={64}
                          height={64}
                          quality={90}
                          className="h-full w-full object-cover"
                          sizes="64px"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-3xl font-bold text-white drop-shadow-md xl:text-4xl">
                        {country?.nameKr ?? code.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {!done ? (
                  <div className="border-t border-slate-100 bg-white lg:flex lg:flex-1 lg:flex-col lg:border-t-0 lg:border-l lg:border-slate-100">
                    <TravelerAvgDailyProgressBar
                      code={code}
                      countryNameKr={country?.nameKr ?? code.toUpperCase()}
                    />
                    <p className="border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-600 sm:py-4 sm:text-base lg:mt-auto lg:border-t lg:px-6 lg:py-5 lg:text-lg">
                      카드를 눌러 여행 기간을 선택하세요
                    </p>
                  </div>
                ) : null}

                {done ? (
                  <div className="bg-white px-4 py-4 sm:px-5 sm:py-5 lg:flex lg:flex-1 lg:items-center lg:border-l lg:border-slate-100 lg:px-8 lg:py-6">
                    <div className="flex w-full items-start gap-2.5 rounded-xl bg-blue-50 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                      <svg
                        className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 lg:h-6 lg:w-6"
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
                      <span className="text-sm font-medium text-blue-700 sm:text-base lg:text-lg" title={summaryLine}>
                        {summaryLine}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {planCtx ? (
                <PlanSelectPopup
                  inline
                  open
                  countryName={country?.nameKr ?? code.toUpperCase()}
                  countryCode={code}
                  allSelectedCodes={selectedCodes}
                  tripDays={planCtx.tripDays}
                  onBack={() => reopenDurationForPlan(code)}
                  onComplete={(product, quantity) => completeCountryPlan(code, product, quantity)}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>

      {allDone && (checkoutPaused || checkoutAlreadyDispatched) ? (
        <div className="mt-6 px-4 sm:px-0">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-4 text-center shadow-sm sm:p-5">
            <p className="text-sm font-semibold text-teal-950 sm:text-base">선택이 완료되었습니다</p>
            <p className="mt-1.5 text-xs leading-relaxed text-teal-900/90 sm:text-sm">
              주문·결제 화면으로 이동하거나, 카드를 눌러 플랜을 다시 고를 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => goToCheckout()}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-teal-700 px-6 text-base font-bold text-white shadow-md transition hover:bg-teal-800"
            >
              주문·결제로 이동
            </button>
          </div>
        </div>
      ) : null}

      {selectedCodes.length >= 2 ? (
        <section className="mt-10 border-t border-gray-200 px-4 pt-8 sm:px-0 lg:mt-12 lg:pt-10">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 lg:px-5 lg:py-4 lg:text-base">
            <span className="font-semibold">💡 다국가 플랜이 더 저렴할 수 있어요!</span>
            <p className="mt-1 text-xs leading-relaxed text-blue-800/90 lg:text-sm">
              선택하신 국가 조합에 맞는 다국가 요금제를 함께 비교해 보세요. (여행 일수는 아래 추정치로 합산합니다 — 기간을
              입력하면 자동 반영됩니다.)
            </p>
          </div>

          <h3 className="mb-3 mt-6 text-base font-bold text-gray-800 lg:mb-4 lg:mt-8 lg:text-lg">다국가 플랜 비교</h3>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm lg:p-5 lg:text-base">
            <p>
              <span className="font-medium text-slate-900">추정 여행 일수</span>{" "}
              <span className="font-mono text-teal-700">{estimateTripDays}일</span>
            </p>
            <p className="mt-2">
              <span className="font-medium text-slate-900">개별 선택 합계(추정)</span>{" "}
              <span className="font-semibold text-slate-900">{formatKrw(individualEstimateTotalKrw)}</span>
              <span className="text-xs text-slate-500"> · 각 국가 요금제 확정 후 비교용 참고치</span>
            </p>
          </div>

          {suggestedMultiProducts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">이 조합을 모두 커버하는 다국가 상품이 없습니다.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {suggestedMultiProducts.map((p) => {
                const unit = unitPriceKrw(p);
                const multiTotal = unit != null && unit > 0 ? unit * estimateTripDays : null;
                const diff =
                  multiTotal != null && individualEstimateTotalKrw > 0
                    ? individualEstimateTotalKrw - multiTotal
                    : null;
                return (
                  <li
                    key={p.option_api_id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:p-5"
                  >
                    <p className="text-base font-bold text-gray-900 lg:text-lg">{multiPlanDisplayNameKr(p.plan_name)}</p>
                    <p className="mt-1 text-sm text-gray-500 lg:text-base">
                      {formatDaysRawKr(p.days_raw)} / {planTypeLabelKr(p.plan_type)} · {networkFamilyLabelKr(p.network_family)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {unit != null ? (
                        <span className="text-sm text-gray-600">
                          1일 <span className="font-semibold text-gray-900">{formatKrw(unit)}</span>
                        </span>
                      ) : null}
                      {multiTotal != null ? (
                        <span className="text-sm text-gray-600">
                          {estimateTripDays}일 합계{" "}
                          <span className="bt-bongsim-plan-price text-lg font-semibold !text-slate-900 lg:text-xl">
                            {formatKrw(multiTotal)}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    {diff != null && multiTotal != null ? (
                      <p className={`mt-2 text-xs font-medium lg:text-sm ${diff > 0 ? "text-teal-700" : "text-amber-700"}`}>
                        {diff > 0
                          ? `개별 합계 대비 약 ${formatKrw(diff)} 절감(추정)`
                          : diff < 0
                            ? `개별 합계보다 약 ${formatKrw(-diff)} 높음(추정)`
                            : "개별 합계와 유사(추정)"}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
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
          const code = flow.code;
          setTripResume({ start: payload.start, end: payload.end });
          setCountryDateRanges((prev) => [
            ...prev.filter((r) => r.code !== code),
            { code, start: payload.start, end: payload.end },
          ]);
          setOpenPlanByCode((prev) => ({
            ...prev,
            [code]: {
              tripDays: payload.tripDays,
              start: payload.start,
              end: payload.end,
            },
          }));
          setFlow(null);
        }}
      />
    </div>
  );
}
