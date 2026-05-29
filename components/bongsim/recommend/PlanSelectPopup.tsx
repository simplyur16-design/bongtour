"use client";

import { useEffect, useMemo, useState } from "react";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import {
  extractDaysFromDaysRaw,
  formatKrw,
  formatKrwPerDay,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { formatPlanOptionLabel } from "@/lib/bongsim/recommend/plan-option-label";
import { esimHasFreeData } from "@/lib/bongsim/constants";
import { EsimVerificationGuideBox } from "@/components/bongsim/esim/EsimVerificationGuideBox";
import { TravelerVerificationProductBadge } from "@/components/bongsim/esim/TravelerVerificationProductBadge";
import {
  getKycLabelDistribution,
  getKycLabelState,
  shouldShowBadge,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import { sortPlanGroupsForDisplay } from "@/lib/bongsim/recommend/plan-display-sort";
type PlanTab = "unlimited" | "daily" | "fixed";

type RecommendedPlan = ProductOption & { rec_source: PlanTab };

type RecommendedByAuth = {
  required: RecommendedPlan | null;
  not_required: RecommendedPlan | null;
};

type AuthFilter = "required" | "not_required";

type PlanGroups = {
  unlimited: ProductOption[];
  daily: ProductOption[];
  fixed: ProductOption[];
};

function filterGroupsByAuth(groups: PlanGroups, auth: AuthFilter): PlanGroups {
  const match = (p: ProductOption) => {
    const state = getKycLabelState(p.flags);
    return auth === "required" ? state === "required" : state === "not_required";
  };
  return {
    unlimited: groups.unlimited.filter(match),
    daily: groups.daily.filter(match),
    fixed: groups.fixed.filter(match),
  };
}

const TAB_LABELS: Record<PlanTab, string> = {
  unlimited: "무제한",
  daily: "데일리",
  fixed: "종량제",
};

const ALL_PLAN_TABS: PlanTab[] = ["unlimited", "daily", "fixed"];

const PLAN_TYPE_HELP = `무제한: 데이터 양은 무제한, 속도는 일정하게 유지돼요(영상은 화질 제한될 수 있어요).
데일리: 매일 정해진 용량까지 고속, 소진 후 다음날까지 느려졌다가 매일 초기화돼요.
종량제: 전체 기간 동안 정해진 용량까지 고속, 다 쓰면 종료(충전 연장 가능).`;

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


function displayRecommended(p: ProductOption): number | null {
  if (typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)) {
    return p.recommended_price;
  }
  return null;
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

/** allowance_label → GB 비교키 (500MB=0.5, 1GB=1 …). 문자열 정렬 금지. */
function allowanceCapacityGbKey(label: string | null | undefined): number {
  const parsed = parseAllowance(label);
  if (parsed.kind === "mb") return parsed.mb / 1024;
  if (parsed.kind === "unlimited") return Number.POSITIVE_INFINITY;
  return -1;
}

/** 다국가(allSelectedCodes≥2) 데일리만 용량 내림차순. 단일국은 API(오름차순) 순서 유지. */
function sortDailyGroupDescByCapacity(plans: ProductOption[]): ProductOption[] {
  return [...plans].sort((a, b) => {
    const ka = allowanceCapacityGbKey(a.allowance_label);
    const kb = allowanceCapacityGbKey(b.allowance_label);
    if (ka !== kb) return kb - ka;
    const pa = displayRecommended(a) ?? Number.POSITIVE_INFINITY;
    const pb = displayRecommended(b) ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
}

type Props = {
  open: boolean;
  /** true: RecommendModalShell 없이 국가 카드 밑 인라인 패널 */
  inline?: boolean;
  countryName: string;
  countryCode: string;
  allSelectedCodes: string[];
  tripDays: number;
  onBack: () => void;
  onComplete: (
    product: ProductOption,
    quantity: number,
    ctx?: { kycDistribution: KycLabelDistribution },
  ) => void;
};

export function PlanSelectPopup({
  open,
  inline = false,
  countryName,
  countryCode,
  allSelectedCodes,
  tripDays,
  onBack,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedPlan | null>(null);
  const [recommendedByAuth, setRecommendedByAuth] = useState<RecommendedByAuth | null>(null);
  const [kycDistribution, setKycDistribution] = useState<KycLabelDistribution>("none");
  const [authFilter, setAuthFilter] = useState<AuthFilter>("not_required");
  const [rawGroups, setRawGroups] = useState<PlanGroups>({ unlimited: [], daily: [], fixed: [] });
  const [activeTab, setActiveTab] = useState<PlanTab>("unlimited");
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [matchedDays, setMatchedDays] = useState<number | null>(null);

  const tripDaysFloored = Math.max(1, Math.floor(tripDays));
  const displayMatchedDays = matchedDays ?? tripDaysFloored;
  const showDayMatchNotice = matchedDays != null && tripDaysFloored !== matchedDays;

  useEffect(() => {
    if (!open) {
      setRecommended(null);
      setRecommendedByAuth(null);
      setKycDistribution("none");
      setAuthFilter("not_required");
      setRawGroups({ unlimited: [], daily: [], fixed: [] });
      setActiveTab("unlimited");
      setHelpOpen(false);
      setSelectedId(null);
      setQuantity(1);
      setErr(null);
      setMatchedDays(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({
          country: countryCode,
          days: String(tripDaysFloored),
        });
        if (allSelectedCodes.length > 0) {
          q.set("codes", allSelectedCodes.map((c) => c.toLowerCase()).join(","));
        }
        const res = await fetch(`/api/bongsim/products/plans?${q.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const json = (await res.json()) as {
          recommended?: RecommendedPlan | null;
          recommended_by_auth?: RecommendedByAuth | null;
          kyc_distribution?: KycLabelDistribution;
          groups?: Partial<PlanGroups>;
          matched_days?: number;
        };
        if (cancelled) return;
        const mdRaw = json.matched_days;
        const md =
          typeof mdRaw === "number" && Number.isFinite(mdRaw) && mdRaw >= 1
            ? Math.trunc(mdRaw)
            : tripDaysFloored;
        setMatchedDays(md);
        const dist = json.kyc_distribution ?? "none";
        setKycDistribution(dist);
        const rawDaily = json.groups?.daily ?? [];
        const nextGroups: PlanGroups = {
          unlimited: json.groups?.unlimited ?? [],
          daily:
            allSelectedCodes.length >= 2
              ? sortDailyGroupDescByCapacity(rawDaily)
              : rawDaily,
          fixed: json.groups?.fixed ?? [],
        };
        setRawGroups(nextGroups);
        const nextRecommendedByAuth = json.recommended_by_auth ?? null;
        setRecommendedByAuth(nextRecommendedByAuth);
        const nextRecommended =
          json.recommended && json.recommended.option_api_id ? json.recommended : null;
        setRecommended(nextRecommended);
        const defaultAuth: AuthFilter = "not_required";
        setAuthFilter(defaultAuth);
        const visibleGroups =
          dist === "binary" ? filterGroupsByAuth(nextGroups, defaultAuth) : nextGroups;
        const pin =
          dist === "binary"
            ? nextRecommendedByAuth?.[defaultAuth] ?? null
            : nextRecommended;
        const visibleAfterLoad = ALL_PLAN_TABS.filter((t) => (visibleGroups[t]?.length ?? 0) > 0);
        const recTab = pin?.rec_source;
        const nextTab =
          recTab && visibleAfterLoad.includes(recTab) ? recTab : (visibleAfterLoad[0] ?? "unlimited");
        setActiveTab(nextTab);
      } catch {
        if (!cancelled) {
          setErr("플랜을 불러오지 못했습니다.");
          setRecommended(null);
          setRecommendedByAuth(null);
          setRawGroups({ unlimited: [], daily: [], fixed: [] });
          setMatchedDays(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, countryCode, tripDaysFloored, allSelectedCodes.join(",")]);

  const showAuthToggle = kycDistribution === "binary";

  const groups = useMemo(() => {
    const filtered = !showAuthToggle ? rawGroups : filterGroupsByAuth(rawGroups, authFilter);
    return sortPlanGroupsForDisplay(filtered, tripDaysFloored);
  }, [rawGroups, authFilter, showAuthToggle, tripDaysFloored]);

  const tabCounts = useMemo(
    () => ({
      unlimited: groups.unlimited.length,
      daily: groups.daily.length,
      fixed: groups.fixed.length,
    }),
    [groups],
  );

  const activeRecommended = useMemo(() => {
    if (showAuthToggle) {
      return recommendedByAuth?.[authFilter] ?? null;
    }
    return recommended;
  }, [showAuthToggle, recommendedByAuth, authFilter, recommended]);

  const tabCards = useMemo(() => {
    const list = groups[activeTab] ?? [];
    const recId = activeRecommended?.rec_source === activeTab ? activeRecommended.option_api_id : null;
    const pinned = recId ? list.find((p) => p.option_api_id === recId) : null;
    const rest = recId ? list.filter((p) => p.option_api_id !== recId) : list;
    const rows: { product: ProductOption; isPinned: boolean }[] = [];
    if (pinned) rows.push({ product: pinned, isPinned: true });
    for (const p of rest) rows.push({ product: p, isPinned: false });
    return rows;
  }, [groups, activeTab, activeRecommended]);

  const hasAnyPlansAtAll =
    rawGroups.unlimited.length > 0 || rawGroups.daily.length > 0 || rawGroups.fixed.length > 0;

  const hasVisiblePlans =
    groups.unlimited.length > 0 || groups.daily.length > 0 || groups.fixed.length > 0;

  const allProductsInView = useMemo(() => tabCards.map((r) => r.product), [tabCards]);

  const selectedProduct = useMemo(
    () =>
      selectedId != null
        ? allProductsInView.find((p) => p.option_api_id === selectedId) ?? null
        : null,
    [allProductsInView, selectedId],
  );

  const unitKrw = useMemo(() => {
    if (!selectedProduct) return null;
    return displayRecommended(selectedProduct);
  }, [selectedProduct]);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
  }, [open, selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setQuantity(1);
  }, [activeTab, authFilter]);

  useEffect(() => {
    if (!showAuthToggle || !open || loading) return;
    const pin = recommendedByAuth?.[authFilter] ?? null;
    const recTab = pin?.rec_source;
    if (recTab && tabCounts[recTab] > 0) {
      setActiveTab(recTab);
    }
  }, [authFilter, showAuthToggle, recommendedByAuth, tabCounts, open, loading]);

  useEffect(() => {
    if (!open || loading) return;
    if (tabCounts[activeTab] > 0) return;
    const next = ALL_PLAN_TABS.find((t) => tabCounts[t] > 0);
    if (next) setActiveTab(next);
  }, [open, loading, tabCounts, activeTab, authFilter]);

  const lowestPackageKrw = useMemo(() => {
    let min: number | null = null;
    for (const product of allProductsInView) {
      const total = displayRecommended(product);
      if (total == null || !Number.isFinite(total) || total <= 0) continue;
      if (min == null || total < min) min = total;
    }
    return min;
  }, [allProductsInView]);

  const totalKrw = unitKrw != null && Number.isFinite(unitKrw) ? unitKrw * quantity : null;

  const canComplete = Boolean(selectedId && selectedProduct && quantity >= 1);

  if (!open) return null;

  const panel = (
      <div
        className={
          inline ? "flex flex-col text-slate-900" : "flex max-h-[92vh] flex-col"
        }
      >
        <div className="border-b border-slate-100 px-5 pb-4 pt-5">
          <p className="text-xs text-slate-500 lg:text-sm">
            {countryName} · {tripDaysFloored}일
          </p>
          {showDayMatchNotice ? (
            <p className="mt-1.5 rounded-lg border border-blue-100 bg-blue-50/90 px-3 py-2 text-xs font-medium leading-snug text-blue-900 lg:text-sm">
              {tripDaysFloored}일 여정에 맞는 {displayMatchedDays}일 플랜입니다
            </p>
          ) : null}
          <h2 className="mt-1 text-[1.05rem] font-bold leading-snug text-slate-900 lg:text-xl">
            {tripDaysFloored}일 동안 사용할 플랜을 골라주세요
          </h2>
        </div>

        {showAuthToggle ? (
          <div className="border-b border-slate-100 px-5 pb-3 pt-3">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="여행자 인증 필터">
              <button
                type="button"
                onClick={() => setAuthFilter("required")}
                className={`min-h-10 rounded-lg border px-3 text-sm font-bold transition lg:text-base ${
                  authFilter === "required"
                    ? "border-[#BA7517] bg-[#FAEEDA] !text-[#412402] shadow-sm"
                    : "border-slate-200 bg-white !text-slate-700 hover:bg-slate-50"
                }`}
                style={authFilter === "required" ? { color: "#412402" } : { color: "#334155" }}
              >
                인증 필요
              </button>
              <button
                type="button"
                onClick={() => setAuthFilter("not_required")}
                className={`min-h-10 rounded-lg border px-3 text-sm font-bold transition lg:text-base ${
                  authFilter === "not_required"
                    ? "border-[#0F6E56] bg-[#E1F5EE] !text-[#04342C] shadow-sm"
                    : "border-slate-200 bg-white !text-slate-700 hover:bg-slate-50"
                }`}
                style={authFilter === "not_required" ? { color: "#04342C" } : { color: "#334155" }}
              >
                인증 필요없음
              </button>
            </div>
            {authFilter === "required" ? <EsimVerificationGuideBox /> : null}
          </div>
        ) : null}

        <div className="border-b border-slate-100 px-5">
          {hasAnyPlansAtAll ? (
            <div className="flex gap-1 py-3" role="tablist" aria-label="플랜 유형">
              {ALL_PLAN_TABS.map((tab) => {
                const selected = activeTab === tab;
                const count = tabCounts[tab];
                const disabled = count === 0;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-disabled={disabled}
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) setActiveTab(tab);
                    }}
                    className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-bold transition lg:text-base ${
                      disabled
                        ? "cursor-not-allowed bg-slate-100 !text-slate-400 opacity-60"
                        : selected
                          ? "bg-teal-700 !text-white shadow-sm"
                          : "bg-slate-100 !text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                    <span
                      className={`ml-1 text-xs font-semibold ${
                        disabled
                          ? "!text-slate-400"
                          : selected
                            ? "!text-white/90"
                            : "!text-slate-700"
                      }`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="pb-3">
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-800 lg:text-sm"
              aria-expanded={helpOpen}
            >
              <span>플랜 유형 안내</span>
              <span className="text-slate-500" aria-hidden>
                {helpOpen ? "▲" : "▼"}
              </span>
            </button>
            {helpOpen ? (
              <p className="mt-2 whitespace-pre-line rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-700 lg:text-sm">
                {PLAN_TYPE_HELP}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={
            inline
              ? "max-h-[min(55vh,520px)] space-y-3 overflow-y-auto px-5 py-4"
              : "flex-1 space-y-3 overflow-y-auto px-5 py-4"
          }
        >
          {loading && (
            <div className="py-10 text-center text-sm text-slate-600 lg:text-base">불러오는 중…</div>
          )}
          {!loading && err && <p className="text-center text-sm text-red-600 lg:text-base">{err}</p>}
          {!loading && !err && !hasAnyPlansAtAll && (
            <p className="py-8 text-center text-sm text-slate-600 lg:text-base">
              해당 조건의 상품이 없습니다.
            </p>
          )}
          {!loading && !err && hasAnyPlansAtAll && !hasVisiblePlans && (
            <p className="py-8 text-center text-sm text-slate-600 lg:text-base">
              선택한 인증 조건의 플랜이 없습니다.
            </p>
          )}
          {!loading && !err && hasVisiblePlans && tabCards.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-600 lg:text-base">
              이 유형의 플랜이 없습니다.
            </p>
          )}
          {!loading &&
            !err &&
            tabCards.map(({ product, isPinned }) => {
              const active = selectedId === product.option_api_id;
              const packageTotal = displayRecommended(product);
              const dailyRate = dailyRateFromProduct(product, displayMatchedDays);
              const totalShow = packageTotal != null && Number.isFinite(packageTotal) ? packageTotal : null;
              const dailyShow = dailyRate != null && Number.isFinite(dailyRate) ? dailyRate : null;
              const optionLabel = formatPlanOptionLabel(product);
              const validDays = extractDaysFromDaysRaw(product.days_raw);
              const allowance = (product.allowance_label || "").trim() || "—";
              const kycBadge = shouldShowBadge(product, kycDistribution);

              return (
                <div
                  key={`${activeTab}-${product.option_api_id}${isPinned ? "-pin" : ""}`}
                  onClick={() => setSelectedId(product.option_api_id)}
                  className={`bt-bongsim-plan-card w-full cursor-pointer rounded-xl border-2 p-4 text-left transition lg:p-5 ${
                    active
                      ? "border-blue-400 bg-blue-50 shadow-sm"
                      : isPinned
                        ? "border-violet-300 bg-gradient-to-br from-violet-50/60 via-white to-blue-50/40 hover:border-violet-400"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {isPinned ? (
                          <div className="bt-bongsim-on-dark inline-flex items-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white shadow-md ring-2 ring-violet-300/80 lg:px-4 lg:py-2 lg:text-xs">
                            추천
                          </div>
                        ) : null}
                        <TravelerVerificationProductBadge state={kycBadge} size="sm" showHelpIcon />
                      </div>
                      <p className="text-xs font-semibold text-slate-800 lg:text-sm">{optionLabel}</p>
                      {activeTab === "fixed" ? (
                        <>
                          <p className="mt-1 text-lg font-bold !text-slate-900 lg:text-xl">{allowance}</p>
                          {validDays != null ? (
                            <p className="mt-0.5 text-xs !text-slate-600 lg:text-sm">
                              {validDays}일 이내 사용 · {product.plan_name.trim()} ·{" "}
                              {networkFamilyLabelKr(product.network_family)}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs !text-slate-600 lg:text-sm">
                              {product.plan_name.trim()} · {networkFamilyLabelKr(product.network_family)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-sm !text-slate-700 lg:text-base">
                          {allowance} · {product.plan_name.trim()} ·{" "}
                          {networkFamilyLabelKr(product.network_family)}
                        </p>
                      )}
                      {esimHasFreeData(product.network_family, product.plan_name) ? (
                        <p className="mt-1 text-xs font-bold text-teal-700 lg:text-sm">
                          구글맵·ChatGPT 데이터 무료
                        </p>
                      ) : null}
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      {totalShow != null && (
                        <p className="bt-bongsim-plan-price text-lg font-bold !text-slate-900 lg:text-xl">
                          {formatKrw(totalShow)}
                        </p>
                      )}
                      {dailyShow != null && (
                        <p className="mt-0.5 text-xs font-medium !text-slate-700 lg:text-sm">
                          일당 {formatKrwPerDay(dailyShow)}
                        </p>
                      )}
                    </div>
                  </div>

                  {active && (
                    <div className="mt-4 border-t border-blue-200 pt-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 lg:text-base">수량</span>
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
                          <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-slate-900 lg:text-lg">
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
                        <p className="bt-bongsim-plan-price mt-2 text-right text-lg font-bold !text-slate-900 lg:text-xl">
                          총 {formatKrw(totalKrw)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 lg:px-6">
          {!loading && !err && lowestPackageKrw != null ? (
            <p className="bt-bongsim-footer-lowest mb-3 text-center text-sm !text-slate-800 lg:text-base">
              <span className="font-medium">{TAB_LABELS[activeTab]} · {displayMatchedDays}일 기준 최저가</span>{" "}
              <span className="bt-bongsim-footer-lowest-price text-lg font-bold !text-slate-900 lg:text-xl">
                {formatKrw(lowestPackageKrw)}
              </span>
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[3rem] flex-1 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold !text-black transition hover:bg-slate-50 lg:text-base"
              style={{ color: "#000" }}
            >
              이전
            </button>
            <button
              type="button"
              disabled={!canComplete}
              onClick={() =>
                selectedProduct &&
                onComplete(selectedProduct, quantity, { kycDistribution })
              }
              className={`min-h-[3rem] flex-1 rounded-xl text-sm font-bold !text-black transition lg:text-base ${
                canComplete
                  ? "bg-blue-100 hover:bg-blue-200"
                  : "cursor-not-allowed bg-slate-200"
              }`}
              style={{ color: "#000" }}
            >
              선택완료
            </button>
          </div>
        </div>
      </div>
  );

  if (inline) {
    return (
      <div className="bt-bongsim-readable w-full overflow-hidden rounded-b-2xl border border-t-0 border-slate-200 bg-white text-slate-900 shadow-sm sm:-mt-px">
        {panel}
      </div>
    );
  }

  return (
    <RecommendModalShell open={open} onClose={onBack} maxWidthClassName="max-w-md lg:max-w-xl">
      {panel}
    </RecommendModalShell>
  );
}
