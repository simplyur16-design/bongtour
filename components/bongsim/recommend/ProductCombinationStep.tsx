"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DurationPopup } from "@/components/bongsim/recommend/DurationPopup";
import { PlanSelectPopup } from "@/components/bongsim/recommend/PlanSelectPopup";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY, bongsimPath } from "@/lib/bongsim/constants";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  formatKrw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import type { CountryDateRange } from "@/lib/bongsim/recommend/country-date-ranges";

const HERO_IMAGE_SIZES = "(max-width:768px) 100vw, (max-width:1024px) 70vw, 896px";

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

/** 로밍·로컬 구분 없이 해당 국가 패키지 전체 상품 중 권장가 최저 1개 */
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

type FlowState =
  | { kind: "duration"; code: string }
  | {
      kind: "plan";
      code: string;
      tripDays: number;
      start: Date;
      end: Date;
    };

export type CountryPlanSelection = { product: ProductOption; quantity: number };

interface ProductCombinationStepProps {
  selectedCodes: string[];
  /** GET /api/bongsim/country-heroes — 없는 코드는 국기 blur 폴백 */
  heroMap: Record<string, string>;
  onBack: () => void;
  onNext?: (selection: Record<string, CountryPlanSelection>) => void;
}

function cardPriceCaption(pack: CountryProductPack): string | null {
  const min = overallMinUnitPriceKrw(pack);
  if (min != null && min > 0) return `1일 ${formatKrw(min)}~`;
  return null;
}

const EXPLICIT_AVG_DAILY_GB: Record<string, number> = {
  jp: 1.6,
  tw: 1.3,
  us: 1,
  sg: 0.92,
  ph: 0.75,
  th: 1.1,
  vn: 1,
};

const DEFAULT_AVG_DAILY_GB = 1.3;

function averageDailyDataGbForCountry(code: string): number {
  const lc = code.trim().toLowerCase();
  if (EXPLICIT_AVG_DAILY_GB[lc] != null) return EXPLICIT_AVG_DAILY_GB[lc]!;
  return DEFAULT_AVG_DAILY_GB;
}

/** 소수 GB 표기 (예: 1.6GB, 0.92GB, 1GB) */
function formatAvgDailyGbLabel(gb: number): string {
  const s = (Math.round(gb * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  return `${s}GB`;
}

type TravelerDataUsageGuideProps = { countryNameKr: string; code: string };

/** 0~5GB 스케일에서 평균 마커 가로 위치(%) */
function avgMarkerLeftPercent(avgGb: number): number {
  const clamped = Math.min(5, Math.max(0, avgGb));
  return (clamped / 5) * 100;
}

/** 미완료 국가 카드 하단 — 히어로 아래 흰 영역 (선택 완료 시 비표시) */
function TravelerDataUsageGuide({ countryNameKr, code }: TravelerDataUsageGuideProps) {
  const avgGb = averageDailyDataGbForCountry(code);
  const title = `${countryNameKr} 여행자 평균 하루 ${formatAvgDailyGbLabel(avgGb)} 사용`;
  const markerLeft = avgMarkerLeftPercent(avgGb);

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>

      <div className="relative pt-7">
        <div
          className="pointer-events-none absolute top-0 flex flex-col items-center"
          style={{ left: `${markerLeft}%`, transform: "translateX(-50%)" }}
        >
          <span className="text-xs font-semibold text-teal-600 whitespace-nowrap">
            평균 {formatAvgDailyGbLabel(avgGb)}
          </span>
          <span className="leading-none text-teal-600" aria-hidden>
            ▼
          </span>
        </div>

        <div className="relative flex h-8 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="relative flex h-full w-[20%] shrink-0 items-center justify-center rounded-l-full bg-emerald-100 px-0.5">
            <span className="text-center text-[10px] font-medium leading-tight text-slate-700">
              알뜰형
              <br />
              (0~1GB)
            </span>
          </div>
          <div className="w-px shrink-0 self-stretch bg-slate-300/80" aria-hidden />
          <div className="relative flex h-full w-[40%] shrink-0 items-center justify-center bg-teal-100 px-0.5">
            <span className="text-center text-[10px] font-medium leading-tight text-slate-700">
              스마트형
              <br />
              (1~2GB)
            </span>
          </div>
          <div className="w-px shrink-0 self-stretch bg-slate-300/80" aria-hidden />
          <div className="relative flex h-full w-[40%] shrink-0 items-center justify-center rounded-r-full bg-sky-100 px-0.5">
            <span className="text-center text-[10px] font-medium leading-tight text-slate-700">
              자유형
              <br />
              (2~5GB+)
            </span>
          </div>
        </div>

        <div className="relative mt-1 h-4 w-full text-[10px] text-slate-400">
          <span className="absolute left-[10%] -translate-x-1/2 whitespace-nowrap">500MB</span>
          <span className="absolute left-[20%] -translate-x-1/2 whitespace-nowrap">1GB</span>
          <span className="absolute left-[40%] -translate-x-1/2 whitespace-nowrap">2GB</span>
          <span className="absolute left-full -translate-x-full whitespace-nowrap">5GB+</span>
        </div>

        <p className="mt-1 text-[10px] text-slate-500">알뜰형: 지도, 메시지, 기본 검색</p>
        <p className="text-[10px] text-slate-500">
          스마트형: SNS, 맛집검색, 번역앱 💡 사진은 호텔 Wi-Fi로!
        </p>
        <p className="text-[10px] text-slate-500">자유형: 실시간 스트리밍, 영상통화</p>
      </div>

      <p className="mt-2 text-[10px] text-slate-400">* 2025 해외여행 데이터 사용량 분석 기준</p>
    </div>
  );
}

export function ProductCombinationStep({
  selectedCodes,
  heroMap,
  onBack,
  onNext,
}: ProductCombinationStepProps) {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
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

  const startDuration = (code: string) => {
    if (completed[code]) return;
    setTripResume(null);
    setFlow({ kind: "duration", code });
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
    if (sessionStatus === "loading") return;

    const payload = { ...completed };
    onNext?.(payload);

    const queue = selectedCodes
      .map((code) => {
        const sel = completed[code];
        if (!sel) return null;
        return { optionApiId: sel.product.option_api_id, quantity: sel.quantity };
      })
      .filter((row): row is { optionApiId: string; quantity: number } => row != null);
    if (queue.length === 0) return;

    try {
      sessionStorage.setItem(BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* quota / private mode */
    }

    const first = queue[0]!;
    const checkoutPath = `${bongsimPath("/checkout")}?optionApiId=${encodeURIComponent(first.optionApiId)}&qty=${encodeURIComponent(String(first.quantity))}`;

    redirectRef.current = true;

    if (sessionStatus === "unauthenticated") {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(checkoutPath)}`);
      return;
    }

    router.push(checkoutPath);
  }, [allDone, completed, onNext, router, selectedCodes, sessionStatus]);

  const shell = (inner: ReactNode) => (
    <div className="mx-auto w-full max-w-lg px-4 lg:max-w-3xl lg:px-6">{inner}</div>
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
          className="mt-4 text-sm font-semibold text-teal-700 underline lg:mt-5 lg:text-base"
        >
          ← 국가 선택으로 돌아가기
        </button>
      </div>,
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-8 lg:max-w-3xl lg:px-6 lg:pb-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-teal-700 lg:mb-5 lg:gap-1.5 lg:text-base"
      >
        <svg className="h-4 w-4 lg:h-5 lg:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        국가 선택으로 돌아가기
      </button>

      <h1 className="text-center text-lg font-bold text-gray-900 lg:text-2xl">{headerTitle}</h1>

      <div className="mt-8 lg:mt-10">
        {selectedCodes.map((code, idx) => {
          const country = countryByCode[code];
          const pack = data.individual[code];
          const done = Boolean(completed[code]);
          const hero = countryHeroUrl(code, heroMap);
          const selection = completed[code];
          const range = countryDateRanges.find((r) => r.code === code);
          const priceLine = pack ? cardPriceCaption(pack) : null;

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
                <div className="my-3 flex justify-center lg:my-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-light text-gray-500 lg:h-12 lg:w-12 lg:text-xl">
                    +
                  </span>
                </div>
              ) : null}
              <div
                className={`w-full overflow-hidden rounded-2xl shadow-lg ${
                  !done ? "cursor-pointer transition hover:ring-2 hover:ring-blue-300/60" : ""
                }`}
                role={!done ? "button" : undefined}
                tabIndex={!done ? 0 : undefined}
                onClick={() => {
                  if (!done) startDuration(code);
                }}
                onKeyDown={(e) => {
                  if (done) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startDuration(code);
                  }
                }}
              >
                <div className="relative h-44 w-full overflow-hidden bg-gray-900 lg:h-52">
                  {hero ? (
                    <Image
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
                      <Image
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
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end">
                    <div
                      className={
                        done
                          ? "px-4 pb-4 pt-12 lg:px-5 lg:pb-5 lg:pt-14"
                          : "px-4 pb-2 pt-10 lg:px-5 lg:pb-3 lg:pt-11"
                      }
                    >
                      <div className="flex items-end gap-3 lg:gap-4">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full shadow-lg ring-1 ring-gray-200 lg:h-14 lg:w-14">
                          <Image
                            src={flagCdnUrl(code)}
                            alt=""
                            width={48}
                            height={48}
                            quality={90}
                            className="h-full w-full object-cover"
                            sizes="(max-width:1024px) 48px, 56px"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xl font-bold text-white drop-shadow-md lg:text-2xl">
                            {country?.nameKr ?? code.toUpperCase()}
                          </p>
                          {priceLine ? (
                            <p className="mt-0.5 text-sm text-white/80 drop-shadow-md lg:text-base">{priceLine}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {!done ? (
                  <div className="border-t border-slate-100 bg-white px-3 py-2.5 lg:px-4 lg:py-3">
                    <TravelerDataUsageGuide
                      code={code}
                      countryNameKr={country?.nameKr ?? code.toUpperCase()}
                    />
                    <p className="mt-2 border-t border-slate-100 pt-2 text-center text-sm text-slate-500 lg:text-base">
                      카드를 눌러 여행 기간을 선택하세요
                    </p>
                  </div>
                ) : null}

                {done ? (
                  <div className="bg-white px-4 py-3 lg:px-5 lg:py-4">
                    <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-4 py-3 lg:gap-2.5 lg:px-5 lg:py-3.5">
                      <svg
                        className="mt-0.5 h-5 w-5 shrink-0 text-blue-500 lg:mt-1 lg:h-6 lg:w-6"
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
                      <span className="text-sm font-medium text-blue-600 lg:text-base" title={summaryLine}>
                        {summaryLine}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      {selectedCodes.length >= 2 && cheapestMulti != null ? (
        <section className="mt-10 border-t border-gray-200 pt-8 lg:mt-12 lg:pt-10">
          <h3 className="mb-4 text-base font-bold text-gray-800 lg:mb-5 lg:text-lg">
            다른 상품들과도 비교해보세요
          </h3>
          <div className="rounded-xl border border-gray-200 p-4 lg:p-5">
            <p className="text-base font-bold text-gray-900 lg:text-lg">
              {multiPlanDisplayNameKr(cheapestMulti.plan_name)}
            </p>
            <p className="mt-1 text-sm text-gray-500 lg:mt-1.5 lg:text-base">
              {formatDaysRawKr(cheapestMulti.days_raw)} / {planTypeLabelKr(cheapestMulti.plan_type)}
            </p>
            {unitPriceKrw(cheapestMulti) != null && (
              <p className="mt-2 text-base font-semibold text-blue-500 lg:mt-3 lg:text-lg">
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
          tripDays={flow.tripDays}
          onBack={() => {
            setFlow({
              kind: "duration",
              code: flow.code,
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
