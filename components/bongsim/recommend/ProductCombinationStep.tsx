"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SafeImage from "@/app/components/SafeImage";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ComparePlansPopup,
} from "@/components/bongsim/recommend/ComparePlansPopup";
import { DurationPopup } from "@/components/bongsim/recommend/DurationPopup";
import { PlanSelectPopup } from "@/components/bongsim/recommend/PlanSelectPopup";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { bongsimPath, esimHasFreeData, type BongsimRecommendCheckoutLine } from "@/lib/bongsim/constants";
import {
  clearRecommendCheckoutDispatched,
  markRecommendCheckoutDispatched,
  writeRecommendCheckoutQueue,
} from "@/lib/bongsim/recommend/funnel-storage";
import type { RecommendFunnelSnapshot } from "@/lib/bongsim/recommend/funnel-storage";
import { isTrueUnlimited, type ProductOption } from "@/lib/bongsim/recommend/product-option";
import type { CountryDateRange } from "@/lib/bongsim/recommend/country-date-ranges";
import { formatPlanOptionLabel } from "@/lib/bongsim/recommend/plan-option-label";
import { TravelerVerificationProductBadge } from "@/components/bongsim/esim/TravelerVerificationProductBadge";
import {
  getKycLabelDistribution,
  shouldShowBadge,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";

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

const MULTI_PLAN_KEY = "__multi__";

export type CountryPlanSelection = {
  product: ProductOption;
  quantity: number;
  kycDistribution?: KycLabelDistribution;
};

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
  /** 2-2a 임시 — 체크아웃·completed 미연동 */
  const [multiPlanDraft, setMultiPlanDraft] = useState<{
    product: ProductOption;
    quantity: number;
    kycDistribution?: KycLabelDistribution;
  } | null>(null);
  const [tripResume, setTripResume] = useState<{ start: Date; end: Date } | null>(null);
  const redirectRef = useRef(false);
  const storedDoneParentSyncReady = useRef(false);
  const [checkoutPaused, setCheckoutPaused] = useState(
    () => Object.keys(initialStoredCompleted ?? {}).length > 0,
  );
  const [comparePopupOpen, setComparePopupOpen] = useState(false);
  const [comparePopupDismissed, setComparePopupDismissed] = useState(false);

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

  const allRangesComplete = useMemo(
    () =>
      selectedCodes.length >= 2 &&
      selectedCodes.every((c) => countryDateRanges.some((r) => r.code === c)),
    [selectedCodes, countryDateRanges],
  );

  const combinedTripSpan = useMemo(() => {
    if (!allRangesComplete) return null;
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;
    for (const code of selectedCodes) {
      const r = countryDateRanges.find((x) => x.code === code);
      if (!r) return null;
      if (minStart == null || r.start.getTime() < minStart.getTime()) minStart = r.start;
      if (maxEnd == null || r.end.getTime() > maxEnd.getTime()) maxEnd = r.end;
    }
    if (!minStart || !maxEnd) return null;
    const ms = maxEnd.getTime() - minStart.getTime();
    const combinedTripDays = Math.max(1, Math.ceil(ms / 86400000) + 1);
    return { minStart, maxEnd, combinedTripDays };
  }, [allRangesComplete, selectedCodes, countryDateRanges]);

  const isCountryDone = (code: string) => Boolean(completed[code] || storedDone[code]);

  const completeCountryPlan = (
    code: string,
    product: ProductOption,
    quantity: number,
    kycDistribution?: KycLabelDistribution,
  ) => {
    const range = countryDateRanges.find((r) => r.code === code);
    const summaryParts: string[] = [];
    summaryParts.push(networkFamilyLabelKr(product.network_family));
    if (range) summaryParts.push(formatShortRange(range.start, range.end));
    summaryParts.push(`${allowanceLabelForSummary(product)} ×${quantity}`);
    const summaryLine = summaryParts.join(" · ");
    setCompleted((prev) => ({ ...prev, [code]: { product, quantity, kycDistribution } }));
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

  const openMultiPlan = () => {
    if (!combinedTripSpan) return;
    setOpenPlanByCode((prev) => ({
      ...prev,
      [MULTI_PLAN_KEY]: {
        tripDays: combinedTripSpan.combinedTripDays,
        start: combinedTripSpan.minStart,
        end: combinedTripSpan.maxEnd,
      },
    }));
  };

  const closeMultiPlan = () => {
    setOpenPlanByCode((prev) => {
      const next = { ...prev };
      delete next[MULTI_PLAN_KEY];
      return next;
    });
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

  const compareReady = allDone && selectedCodes.length >= 2;

  useEffect(() => {
    if (!compareReady) {
      setComparePopupDismissed(false);
      return;
    }
    if (!comparePopupDismissed) {
      setComparePopupOpen(true);
    }
  }, [compareReady, comparePopupDismissed]);

  const closeComparePopup = () => {
    setComparePopupOpen(false);
    setComparePopupDismissed(true);
  };

  const changeCountryPlanFromCompare = (code: string) => {
    setComparePopupOpen(false);
    const range = countryDateRanges.find((r) => r.code === code);
    if (!range) {
      startDuration(code);
      return;
    }
    const ms = range.end.getTime() - range.start.getTime();
    const tripDays = Math.max(1, Math.ceil(ms / 86400000) + 1);
    setOpenPlanByCode((prev) => ({
      ...prev,
      [code]: {
        tripDays,
        start: range.start,
        end: range.end,
      },
    }));
  };

  const checkoutQueue = useMemo(
    () => buildQueueFromSelections(selectedCodes, completed, storedDone),
    [selectedCodes, completed, storedDone],
  );

  const goToCheckout = (queue: BongsimRecommendCheckoutLine[] = checkoutQueue) => {
    if (queue.length === 0) return;
    const payload = { ...completed };
    onNext?.(payload);
    writeRecommendCheckoutQueue(queue);
    markRecommendCheckoutDispatched(queue);
    const first = queue[0]!;
    const checkoutPath = `${bongsimPath("/checkout")}?optionApiId=${encodeURIComponent(first.optionApiId)}&qty=${encodeURIComponent(String(first.quantity))}`;
    redirectRef.current = true;
    setCheckoutPaused(false);
    if (sessionStatus === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    router.push(checkoutPath);
  };

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
            summaryParts.push(formatPlanOptionLabel(selection.product));
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
                  <div className="bg-white px-4 py-4 text-slate-900 sm:px-5 sm:py-5 lg:flex lg:flex-1 lg:items-center lg:border-l lg:border-slate-100 lg:px-8 lg:py-6">
                    <div className="flex w-full items-start justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
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
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-sm font-medium !text-slate-900 sm:text-base lg:text-lg"
                            style={{ color: "#1F1B2D" }}
                            title={summaryLine}
                          >
                            {summaryLine}
                          </span>
                          {selection ? (
                            <TravelerVerificationProductBadge
                              state={shouldShowBadge(
                                selection.product,
                                selection.kycDistribution ??
                                  getKycLabelDistribution([selection.product]),
                              )}
                              size="sm"
                              showHelpIcon
                            />
                          ) : null}
                        </div>
                      {selection &&
                      esimHasFreeData(selection.product.network_family, selection.product.plan_name) ? (
                        <span className="mt-1.5 block text-xs font-bold text-teal-700 sm:text-sm">
                          구글맵·ChatGPT 데이터 무료
                        </span>
                      ) : null}
                    </div>
                      </div>
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
                  allSelectedCodes={[code]}
                  tripDays={planCtx.tripDays}
                  onBack={() => reopenDurationForPlan(code)}
                  onComplete={(product, quantity, ctx) =>
                    completeCountryPlan(code, product, quantity, ctx?.kycDistribution)
                  }
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>

      {selectedCodes.length >= 2 ? (
        <section className="mt-10 border-t border-gray-200 px-4 pt-8 sm:px-0 lg:mt-12 lg:pt-10">
          <div className="bt-bongsim-info-callout rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm !text-blue-950 lg:px-5 lg:py-4 lg:text-base">
            <span className="font-semibold !text-blue-950" style={{ color: "#1e3a8a" }}>
              💡 다국가 플랜이 더 저렴할 수 있어요!
            </span>
            <p className="mt-1 text-xs leading-relaxed !text-blue-900 lg:text-sm">
              각 국가 카드에서 여행 기간을 모두 선택하면, 아래 다국가 카드에서 합산 일수에 맞는 요금제를 고를 수 있어요.
            </p>
          </div>

          <h3 className="mb-3 mt-6 text-base font-bold text-gray-800 lg:mb-4 lg:mt-8 lg:text-lg">다국가 플랜</h3>

          {(() => {
            const multiPlanCtx = openPlanByCode[MULTI_PLAN_KEY];
            const multiPlanOpen = Boolean(multiPlanCtx);
            return (
              <>
                <div
                  className={`w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg transition ${
                    allRangesComplete
                      ? multiPlanOpen
                        ? "cursor-pointer rounded-b-none border-b-0 hover:ring-2 hover:ring-teal-300/60"
                        : "cursor-pointer hover:ring-2 hover:ring-teal-300/60"
                      : "cursor-not-allowed opacity-75"
                  }`}
                  role={allRangesComplete ? "button" : undefined}
                  tabIndex={allRangesComplete ? 0 : -1}
                  aria-disabled={!allRangesComplete}
                  onClick={allRangesComplete ? openMultiPlan : undefined}
                  onKeyDown={
                    allRangesComplete
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openMultiPlan();
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
                    {selectedCodes.map((code) => {
                      const country = countryByCode[code];
                      return (
                        <div key={code} className="flex items-center gap-2">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-100">
                            <SafeImage
                              src={flagCdnUrl(code)}
                              alt=""
                              width={40}
                              height={40}
                              quality={90}
                              className="h-full w-full object-cover"
                              sizes="40px"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 sm:text-base">
                            {country?.nameKr ?? code.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
                    {!allRangesComplete ? (
                      <p className="text-center text-sm font-medium text-slate-600 sm:text-base">
                        각 국가의 기간을 먼저 선택해 주세요
                      </p>
                    ) : combinedTripSpan ? (
                      <p className="text-center text-sm text-slate-700 sm:text-base">
                        <span className="font-medium text-slate-900">합산 여행</span>{" "}
                        <span className="font-mono font-semibold text-teal-700">
                          {formatShortRange(combinedTripSpan.minStart, combinedTripSpan.maxEnd)}
                        </span>
                        <span className="text-slate-500"> · </span>
                        <span className="font-semibold text-slate-900">{combinedTripSpan.combinedTripDays}일</span>
                        <span className="mt-1 block text-xs text-slate-500 sm:text-sm">
                          카드를 눌러 다국가 요금제를 선택하세요
                        </span>
                      </p>
                    ) : null}
                    {multiPlanDraft ? (
                      <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-center text-xs font-medium text-teal-800 sm:text-sm">
                        <span>
                          선택(임시): {formatPlanOptionLabel(multiPlanDraft.product)} ·{" "}
                          {multiPlanDraft.product.plan_name.trim()} ·{" "}
                          {allowanceLabelForSummary(multiPlanDraft.product)} ×{multiPlanDraft.quantity}
                        </span>
                        <TravelerVerificationProductBadge
                          state={shouldShowBadge(
                            multiPlanDraft.product,
                            multiPlanDraft.kycDistribution ??
                              getKycLabelDistribution([multiPlanDraft.product]),
                          )}
                          size="sm"
                          showHelpIcon
                        />
                      </p>
                    ) : null}
                  </div>
                </div>

                {multiPlanCtx ? (
                  <PlanSelectPopup
                    inline
                    open
                    countryName="다국가 플랜"
                    countryCode={selectedCodes[0]!}
                    allSelectedCodes={selectedCodes}
                    tripDays={multiPlanCtx.tripDays}
                    onBack={closeMultiPlan}
                    onComplete={(product, quantity, ctx) => {
                      setMultiPlanDraft({
                        product,
                        quantity,
                        kycDistribution: ctx?.kycDistribution,
                      });
                      closeMultiPlan();
                    }}
                  />
                ) : null}
              </>
            );
          })()}
        </section>
      ) : null}

      <div className="mt-8 px-4 sm:mt-10 sm:px-0">
        {allDone && checkoutQueue.length > 0 ? (
          <button
            type="button"
            onClick={() => goToCheckout()}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-teal-700 px-6 text-base font-bold text-white shadow-md transition hover:bg-teal-800"
          >
            결제하기
          </button>
        ) : (
          <p className="text-center text-sm font-medium text-slate-600 sm:text-base">
            모든 국가의 플랜을 선택해 주세요
          </p>
        )}
      </div>

      <ComparePlansPopup
        open={comparePopupOpen && compareReady}
        onClose={closeComparePopup}
        selectedCodes={selectedCodes}
        countryNameByCode={Object.fromEntries(
          selectedCodes.map((c) => [c, countryByCode[c]?.nameKr]),
        )}
        completed={completed}
        individualCheckoutQueue={checkoutQueue}
        onCheckout={(queue) => {
          setComparePopupOpen(false);
          goToCheckout(queue);
        }}
        onChangeCountryPlan={changeCountryPlanFromCompare}
        combinedTripDays={combinedTripSpan?.combinedTripDays ?? 1}
        multiFetchCountryCode={selectedCodes[0]!}
      />

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
