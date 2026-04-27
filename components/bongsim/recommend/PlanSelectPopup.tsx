"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  formatKrw,
  formatKrwPerDay,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { matchBillableTripDays } from "@/lib/bongsim/recommend/allowance-buckets";

const TIER_ORDER = ["premium", "value", "balance", "budget", "cheapest"] as const;
type TierKey = (typeof TIER_ORDER)[number];

type RecommendedTiersV1 = Partial<
  Record<TierKey, (ProductOption & { tier_label: string }) | null>
>;

function capacityFooterBadge() {
  return (
    <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md border border-teal-200/90 bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-teal-900 shadow-sm ring-1 ring-teal-100/80">
      <span className="shrink-0 rounded-sm bg-teal-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
        안내
      </span>
      <span>구글맵 · ChatGPT 데이터 무제한 제공</span>
    </p>
  );
}

function displayRecommended(p: ProductOption): number | null {
  if (typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)) {
    return p.recommended_price;
  }
  return computeRecommendedPrice(p.price_block);
}

function productBillableDays(p: ProductOption, fallback: number): number {
  return extractDaysFromDaysRaw(p.days_raw) ?? fallback;
}

function dailyRateFromProduct(p: ProductOption, fallbackDays: number): number | null {
  const total = displayRecommended(p);
  if (total == null || !Number.isFinite(total)) return null;
  const d = productBillableDays(p, fallbackDays);
  if (d <= 0) return null;
  return total / d;
}

function networkFamilyLabelKr(family: string | undefined): string {
  switch ((family ?? "").toLowerCase()) {
    case "local":
      return "로컬";
    case "roaming":
      return "로밍";
    default:
      return family?.trim() || "—";
  }
}

type Props = {
  open: boolean;
  countryName: string;
  countryCode: string;
  allSelectedCodes: string[];
  tripDays: number;
  onBack: () => void;
  onComplete: (product: ProductOption, quantity: number) => void;
};

export function PlanSelectPopup({
  open,
  countryName,
  countryCode,
  allSelectedCodes,
  tripDays,
  onBack,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendedTiers, setRecommendedTiers] = useState<RecommendedTiersV1>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  const billableDays = useMemo(() => matchBillableTripDays(tripDays), [tripDays]);
  const tripDaysFloored = Math.max(1, Math.floor(tripDays));
  const showDayMatchNotice = tripDaysFloored !== billableDays;

  useEffect(() => {
    if (!open) {
      setRecommendedTiers({});
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
          days: String(billableDays),
        });
        if (allSelectedCodes.length > 0) {
          q.set("codes", allSelectedCodes.map((c) => c.toLowerCase()).join(","));
        }
        const res = await fetch(`/api/bongsim/products/plans?${q.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = (await res.json()) as { recommended_tiers?: RecommendedTiersV1 };
        if (!cancelled) setRecommendedTiers(json.recommended_tiers ?? {});
      } catch {
        if (!cancelled) {
          setErr("플랜을 불러오지 못했습니다.");
          setRecommendedTiers({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, countryCode, billableDays, allSelectedCodes.join(",")]);

  const tierRows = useMemo(() => {
    const rows: { key: TierKey; product: ProductOption & { tier_label: string } }[] = [];
    for (const key of TIER_ORDER) {
      const entry = recommendedTiers[key];
      if (entry && typeof entry === "object" && entry.option_api_id) {
        rows.push({ key, product: entry });
      }
    }
    return rows;
  }, [recommendedTiers]);

  const selectedProduct = useMemo(
    () => (selectedId != null ? tierRows.find((r) => r.product.option_api_id === selectedId)?.product ?? null : null),
    [tierRows, selectedId],
  );

  const unitKrw = useMemo(() => {
    if (!selectedProduct) return null;
    return displayRecommended(selectedProduct);
  }, [selectedProduct]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
  }, [open, selectedId]);

  const totalKrw = unitKrw != null && Number.isFinite(unitKrw) ? unitKrw * quantity : null;

  const canComplete = Boolean(selectedId && selectedProduct && quantity >= 1);

  return (
    <RecommendModalShell open={open} onClose={onBack}>
      <div className="flex max-h-[92vh] flex-col">
        <div className="border-b border-slate-100 px-5 pb-4 pt-5">
          <p className="text-[12px] text-slate-500">
            {countryName} · {tripDaysFloored}일
          </p>
          {showDayMatchNotice ? (
            <p className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-2 text-[12px] font-medium leading-snug text-blue-900">
              {tripDaysFloored}일 여정에 맞는 {billableDays}일 플랜입니다
            </p>
          ) : null}
          <h2 className="mt-1 text-[1.05rem] font-bold leading-snug text-slate-900">
            {tripDaysFloored}일 동안 사용할 플랜을 골라주세요
          </h2>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="py-10 text-center text-[14px] text-slate-600">불러오는 중…</div>
          )}
          {!loading && err && <p className="text-center text-[14px] text-red-600">{err}</p>}
          {!loading && !err && tierRows.length === 0 && (
            <p className="py-8 text-center text-[14px] text-slate-600">
              해당 조건의 상품이 없습니다.
            </p>
          )}
          {!loading &&
            !err &&
            tierRows.map(({ key, product }) => {
              const active = selectedId === product.option_api_id;
              const isPremium = key === "premium";
              const packageTotal = displayRecommended(product);
              const dailyRate = dailyRateFromProduct(product, billableDays);
              const totalShow = packageTotal != null && Number.isFinite(packageTotal) ? packageTotal : null;
              const dailyShow = dailyRate != null && Number.isFinite(dailyRate) ? dailyRate : null;

              return (
                <div
                  key={`${key}-${product.option_api_id}`}
                  onClick={() => setSelectedId(product.option_api_id)}
                  className={`w-full cursor-pointer rounded-xl border-2 p-4 text-left transition ${
                    isPremium
                      ? active
                        ? "border-violet-400 bg-gradient-to-br from-violet-50 via-white to-blue-50 shadow-md ring-1 ring-violet-200/60"
                        : "border-slate-200 bg-gradient-to-br from-violet-50/40 via-white to-blue-50/50 hover:border-violet-300 hover:shadow-sm"
                      : active
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {isPremium ? (
                    <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                      {product.tier_label}
                    </div>
                  ) : (
                    <div className="mb-2 inline-block rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
                      {product.tier_label}
                    </div>
                  )}

                  {isPremium ? (
                    <>
                      <p className="text-[14px] font-semibold text-slate-700">마음껏 자유롭게 쓰고 싶다면</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {(product.allowance_label || "").trim() || "무제한"}
                      </p>
                      <p className="mt-1 text-sm text-blue-500">데이터 걱정 끝~~!!</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] font-semibold text-slate-700">{product.plan_name.trim()}</p>
                      <p className="mt-1 text-[17px] font-bold text-slate-900">
                        {(product.allowance_label || "").trim() || "—"}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {networkFamilyLabelKr(product.network_family)}
                      </p>
                    </>
                  )}

                  {capacityFooterBadge()}

                  {totalShow != null && (
                    <p className="mt-2 text-[16px] font-bold text-blue-500">{formatKrw(totalShow)}</p>
                  )}
                  {dailyShow != null && (
                    <p className="mt-0.5 text-[12px] font-medium text-slate-600">{formatKrwPerDay(dailyShow)}</p>
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
