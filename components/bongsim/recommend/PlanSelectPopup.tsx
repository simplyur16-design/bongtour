"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import type { AllowanceBucketId } from "@/lib/bongsim/recommend/allowance-buckets";
import { orderedBucketEntries, pickCheapestPerBucket } from "@/lib/bongsim/recommend/allowance-buckets";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import {
  computeRecommendedPrice,
  formatKrw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";

const BUCKET_UI: Record<
  Exclude<AllowanceBucketId, "unlimited">,
  { title: string; subtitle: string; foot: string }
> = {
  "500mb": {
    title: "500MB",
    subtitle: "지도·검색만 이용한다면",
    foot: "매일 500MB 이후 속도 저하",
  },
  "1gb": {
    title: "1GB",
    subtitle: "카톡으로 사진 몇 장 정도",
    foot: "매일 1GB 이후 속도 저하",
  },
  "2gb": {
    title: "2GB",
    subtitle: "인스타로 바로바로",
    foot: "매일 2GB 이후 속도 저하",
  },
  "3gb": {
    title: "3GB",
    subtitle: "영상·클라우드까지 여유 있게",
    foot: "매일 3GB 이후 속도 저하",
  },
  "4gb": {
    title: "4GB",
    subtitle: "화상회의·실시간 라이브방송",
    foot: "매일 4GB 이후 속도 저하",
  },
  "5gb": {
    title: "5GB",
    subtitle: "이동중에 실시간 스트리밍, 영상",
    foot: "매일 5GB 이후 속도 저하",
  },
};

function displayRecommended(p: ProductOption): number | null {
  if (typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)) {
    return p.recommended_price;
  }
  return computeRecommendedPrice(p.price_block);
}

function isMultiCountryPlan(p: ProductOption): boolean {
  return getPlanCoveredCountries(p.plan_name).length >= 2;
}

function singleMatchesCountry(p: ProductOption, code: string): boolean {
  const cov = getPlanCoveredCountries(p.plan_name);
  return cov.length === 1 && cov[0].toLowerCase() === code.toLowerCase();
}

function eligibleRoamingRecommendUnlimited(p: ProductOption, countryCode: string): boolean {
  return (
    !isMultiCountryPlan(p) &&
    singleMatchesCountry(p, countryCode) &&
    (p.network_family || "").toLowerCase() === "roaming" &&
    isTrueUnlimited(p)
  );
}

function eligibleLocalRecommendUnlimited(p: ProductOption, countryCode: string): boolean {
  if (isMultiCountryPlan(p) || !singleMatchesCountry(p, countryCode)) return false;
  if ((p.network_family || "").toLowerCase() !== "local") return false;
  return isTrueUnlimited(p);
}

function pickCheapestProduct(products: ProductOption[]): ProductOption | undefined {
  let best: ProductOption | undefined;
  let bestPr: number | null = null;
  for (const p of products) {
    const pr = displayRecommended(p);
    if (pr == null) {
      if (!best) best = p;
      continue;
    }
    if (bestPr == null || pr < bestPr) {
      bestPr = pr;
      best = p;
    }
  }
  return best;
}

type DisplayEntry = {
  id: AllowanceBucketId;
  product: ProductOption;
  tripTotal?: number;
  perDay?: number;
  recommendGradient?: boolean;
};

type Props = {
  open: boolean;
  countryName: string;
  countryCode: string;
  allSelectedCodes: string[];
  network: "roaming" | "local";
  tripDays: number;
  onBack: () => void;
  onComplete: (product: ProductOption, quantity: number) => void;
};

export function PlanSelectPopup({
  open,
  countryName,
  countryCode,
  allSelectedCodes,
  network,
  tripDays,
  onBack,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<ProductOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPlans([]);
      setSelectedId(null);
      setQuantity(1);
      setErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({
          country: countryCode,
          network,
          days: String(tripDays),
        });
        if (allSelectedCodes.length > 0) {
          q.set("codes", allSelectedCodes.map((c) => c.toLowerCase()).join(","));
        }
        const res = await fetch(`/api/bongsim/products/plans?${q.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!cancelled) setPlans(json.plans ?? []);
      } catch {
        if (!cancelled) {
          setErr("플랜을 불러오지 못했습니다.");
          setPlans([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, countryCode, network, tripDays, allSelectedCodes.join(",")]);

  const displayEntries: DisplayEntry[] = useMemo(() => {
    const recommendCandidates =
      network === "roaming"
        ? plans.filter((p) => eligibleRoamingRecommendUnlimited(p, countryCode))
        : plans.filter((p) => eligibleLocalRecommendUnlimited(p, countryCode));
    const recommendProduct = pickCheapestProduct(recommendCandidates);

    const plansSansMultiUnl = plans.filter(
      (p) =>
        !(
          isMultiCountryPlan(p) &&
          (p.plan_type || "").trim().toLowerCase() === "unlimited" &&
          isTrueUnlimited(p)
        ),
    );

    const restForBucket = recommendProduct
      ? plansSansMultiUnl.filter((p) => p.option_api_id !== recommendProduct.option_api_id)
      : plansSansMultiUnl;

    const byBucket = pickCheapestPerBucket(restForBucket);
    if (recommendProduct) {
      delete byBucket.unlimited;
    }

    const ordered = orderedBucketEntries(byBucket);
    const days = Math.max(1, Math.floor(tripDays));
    const rows: DisplayEntry[] = [];

    if (recommendProduct) {
      rows.push({
        id: "unlimited",
        product: recommendProduct,
        recommendGradient: true,
      });
    }

    for (const { id, product } of ordered) {
      if (recommendProduct && product.option_api_id === recommendProduct.option_api_id) continue;
      if (id === "unlimited") {
        rows.push({
          id,
          product,
          recommendGradient: false,
        });
      } else {
        const perDay = displayRecommended(product);
        const tripTotal = perDay != null ? perDay * days : undefined;
        rows.push({ id, product, tripTotal, perDay: perDay ?? undefined });
      }
    }

    return rows;
  }, [plans, tripDays, countryCode, network]);

  const selectedProduct =
    selectedId != null ? plans.find((p) => p.option_api_id === selectedId) ?? null : null;

  const selectedEntry = useMemo(
    () => displayEntries.find((e) => e.product.option_api_id === selectedId) ?? null,
    [displayEntries, selectedId],
  );

  const days = Math.max(1, Math.floor(tripDays));

  const unitKrw = useMemo(() => {
    if (!selectedEntry) return null;
    const pt = (selectedEntry.product.plan_type || "").trim().toLowerCase();
    if (selectedEntry.id === "unlimited") {
      if (pt === "unlimited") return displayRecommended(selectedEntry.product);
      const perDay = displayRecommended(selectedEntry.product);
      return perDay != null ? perDay * days : null;
    }
    return selectedEntry.tripTotal ?? null;
  }, [selectedEntry, days]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
  }, [open, selectedId]);

  const totalKrw =
    unitKrw != null && Number.isFinite(unitKrw) ? unitKrw * quantity : null;

  const canComplete = Boolean(selectedId && selectedProduct && quantity >= 1);

  return (
    <RecommendModalShell open={open} onClose={onBack}>
      <div className="flex max-h-[92vh] flex-col">
        <div className="border-b border-slate-100 px-5 pb-4 pt-5">
          <p className="text-[12px] text-slate-500">
            {countryName} · {tripDays}일
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold leading-snug text-slate-900">
            {tripDays}일 동안 사용할 플랜을 골라주세요
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="py-10 text-center text-[14px] text-slate-600">불러오는 중…</div>
          )}
          {!loading && err && <p className="text-center text-[14px] text-red-600">{err}</p>}
          {!loading && !err && displayEntries.length === 0 && (
            <p className="py-8 text-center text-[14px] text-slate-600">
              해당 조건의 상품이 없습니다.
            </p>
          )}
          {!loading &&
            !err &&
            displayEntries.map(({ id, product, tripTotal, perDay, recommendGradient }) => {
              const active = selectedId === product.option_api_id;

              if (id === "unlimited") {
                const pt = (product.plan_type || "").trim().toLowerCase();
                const perDayVal = displayRecommended(product);
                const priceShow =
                  pt === "unlimited"
                    ? perDayVal
                    : perDayVal != null
                      ? perDayVal * days
                      : tripTotal ?? null;
                const showGradient = Boolean(recommendGradient);
                return (
                  <div
                    key={`${id}-${product.option_api_id}-${showGradient ? "rec" : "plain"}`}
                    onClick={() => setSelectedId(product.option_api_id)}
                    className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                      active
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    {showGradient ? (
                      <>
                        <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1 text-[11px] font-bold text-white">
                          추천 플랜
                        </div>
                        <p className="text-[14px] font-semibold text-slate-700">
                          마음껏 자유롭게 쓰고 싶다면
                        </p>
                        <p className="mt-1 text-xl font-bold text-slate-900">무제한</p>
                        <p className="mt-1 text-sm text-blue-400">데이터 걱정 끝~~!!</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] font-semibold text-slate-700">무제한 데이터</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">무제한</p>
                      </>
                    )}
                    {priceShow != null && (
                      <p className="mt-2 text-[16px] font-bold text-blue-500">{formatKrw(priceShow)}</p>
                    )}

                    {active && (
                      <div className="mt-4 border-t border-blue-200 pt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] font-semibold text-slate-800">수량</span>
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              aria-label="수량 감소"
                              disabled={quantity <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.max(1, q - 1));
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-[18px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="min-w-[2rem] text-center text-[16px] font-bold tabular-nums text-slate-900">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="수량 증가"
                              disabled={quantity >= 10}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity((q) => Math.min(10, q + 1));
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-[18px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {totalKrw != null && (
                          <p className="mt-2 text-right text-[15px] font-bold text-blue-500">
                            총 {formatKrw(totalKrw)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              const ui = BUCKET_UI[id];
              const totalLabel =
                tripTotal != null && Number.isFinite(tripTotal) ? formatKrw(tripTotal) : null;
              const perDayLabel =
                perDay != null && Number.isFinite(perDay) ? `(1일 ${formatKrw(perDay)})` : null;

              return (
                <div
                  key={`${id}-${product.option_api_id}`}
                  onClick={() => setSelectedId(product.option_api_id)}
                  className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                    active
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-[14px] font-semibold text-slate-700">{ui.subtitle}</p>
                  <p className="mt-1 text-[17px] font-bold text-slate-900">{ui.title}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{ui.foot}</p>
                  {totalLabel != null && (
                    <p className="mt-2 text-[16px] font-bold text-blue-500">{totalLabel}</p>
                  )}
                  {perDayLabel != null && (
                    <p className="mt-0.5 text-[12px] text-slate-500">{perDayLabel}</p>
                  )}

                  {active && (
                    <div className="mt-4 border-t border-blue-200 pt-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-slate-800">수량</span>
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            aria-label="수량 감소"
                            disabled={quantity <= 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuantity((q) => Math.max(1, q - 1));
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-[18px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="min-w-[2rem] text-center text-[16px] font-bold tabular-nums text-slate-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="수량 증가"
                            disabled={quantity >= 10}
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuantity((q) => Math.min(10, q + 1));
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-[18px] font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {totalKrw != null && (
                        <p className="mt-2 text-right text-[15px] font-bold text-blue-500">
                          총 {formatKrw(totalKrw)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[3rem] flex-1 rounded-xl border-2 border-slate-200 text-[15px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            이전
          </button>
          <button
            type="button"
            disabled={!canComplete}
            onClick={() => selectedProduct && onComplete(selectedProduct, quantity)}
            className={`min-h-[3rem] flex-1 rounded-xl text-[15px] font-bold transition ${
              canComplete
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "cursor-not-allowed bg-slate-300 text-slate-500"
            }`}
          >
            선택완료
          </button>
        </div>
      </div>
    </RecommendModalShell>
  );
}
