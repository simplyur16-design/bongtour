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
type PlanTab = "unlimited" | "daily" | "fixed";

type RecommendedPlan = ProductOption & { rec_source: PlanTab };

type PlanGroups = {
  unlimited: ProductOption[];
  daily: ProductOption[];
  fixed: ProductOption[];
};

const TAB_LABELS: Record<PlanTab, string> = {
  unlimited: "무제한",
  daily: "데일리",
  fixed: "종량제",
};

const ALL_PLAN_TABS: PlanTab[] = ["unlimited", "daily", "fixed"];

const PLAN_TYPE_HELP = `무제한: 데이터 양은 무제한, 속도는 일정하게 유지돼요(영상은 화질 제한될 수 있어요).
데일리: 매일 정해진 용량까지 고속, 소진 후 다음날까지 느려졌다가 매일 초기화돼요.
종량제: 전체 기간 동안 정해진 용량까지 고속, 다 쓰면 종료(충전 연장 가능).`;

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

function parseMbpsFromQos(qos_raw: string | null | undefined): number | null {
  const low = (qos_raw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]);
    return Number.isFinite(n) ? n / 1000 : null;
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) {
    const n = parseFloat(mb[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMbpsLabel(qos_raw: string | null | undefined): string {
  const m = parseMbpsFromQos(qos_raw);
  if (m == null) return "—";
  const rounded = m >= 1 ? String(Math.round(m)) : m.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}Mbps`;
}

function structureBadgeText(tab: PlanTab, product: ProductOption): string {
  const allowance = (product.allowance_label || "").trim() || "—";
  const qos = (product.qos_raw || "").trim() || "—";
  switch (tab) {
    case "unlimited":
      return `무제한 · 최대 ${formatMbpsLabel(product.qos_raw)}`;
    case "daily":
      return `매일 ${allowance} 고속 · 소진 후 ${qos}`;
    case "fixed":
      return `총 ${allowance} 고속 · 소진 시 종료`;
    default:
      return "";
  }
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
  onComplete: (product: ProductOption, quantity: number) => void;
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
  const [groups, setGroups] = useState<PlanGroups>({ unlimited: [], daily: [], fixed: [] });
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
      setGroups({ unlimited: [], daily: [], fixed: [] });
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
        const rawDaily = json.groups?.daily ?? [];
        const nextGroups: PlanGroups = {
          unlimited: json.groups?.unlimited ?? [],
          daily:
            allSelectedCodes.length >= 2
              ? sortDailyGroupDescByCapacity(rawDaily)
              : rawDaily,
          fixed: json.groups?.fixed ?? [],
        };
        const nextRecommended =
          json.recommended && json.recommended.option_api_id ? json.recommended : null;
        setGroups(nextGroups);
        setRecommended(nextRecommended);
        const visibleAfterLoad = ALL_PLAN_TABS.filter((t) => (nextGroups[t]?.length ?? 0) > 0);
        const recTab = nextRecommended?.rec_source;
        const nextTab =
          recTab && visibleAfterLoad.includes(recTab) ? recTab : (visibleAfterLoad[0] ?? "unlimited");
        setActiveTab(nextTab);
      } catch {
        if (!cancelled) {
          setErr("플랜을 불러오지 못했습니다.");
          setRecommended(null);
          setGroups({ unlimited: [], daily: [], fixed: [] });
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

  const tabCards = useMemo(() => {
    const list = groups[activeTab] ?? [];
    const recId = recommended?.rec_source === activeTab ? recommended.option_api_id : null;
    const pinned = recId ? list.find((p) => p.option_api_id === recId) : null;
    const rest = recId ? list.filter((p) => p.option_api_id !== recId) : list;
    const rows: { product: ProductOption; isPinned: boolean }[] = [];
    if (pinned) rows.push({ product: pinned, isPinned: true });
    for (const p of rest) rows.push({ product: p, isPinned: false });
    return rows;
  }, [groups, activeTab, recommended]);

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
  }, [activeTab]);

  const totalKrw = unitKrw != null && Number.isFinite(unitKrw) ? unitKrw * quantity : null;

  const lowestPackageKrw = useMemo(() => {
    let min: number | null = null;
    for (const product of allProductsInView) {
      const total = displayRecommended(product);
      if (total == null || !Number.isFinite(total) || total <= 0) continue;
      if (min == null || total < min) min = total;
    }
    return min;
  }, [allProductsInView]);

  const canComplete = Boolean(selectedId && selectedProduct && quantity >= 1);

  const hasAnyPlans =
    groups.unlimited.length > 0 || groups.daily.length > 0 || groups.fixed.length > 0;

  const visibleTabs = useMemo(
    () => ALL_PLAN_TABS.filter((tab) => groups[tab].length > 0),
    [groups],
  );

  useEffect(() => {
    if (!open || loading) return;
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]!);
    }
  }, [open, loading, visibleTabs, activeTab]);

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

        <div className="border-b border-slate-100 px-5">
          {visibleTabs.length > 0 ? (
            <div className="flex gap-1 py-3" role="tablist" aria-label="플랜 유형">
              {visibleTabs.map((tab) => {
                const selected = activeTab === tab;
                const count = groups[tab].length;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab)}
                    className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-bold transition lg:text-base ${
                      selected
                        ? "bg-teal-700 text-white shadow-sm"
                        : "bg-slate-100 !text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                    <span
                      className={`ml-1 text-xs font-semibold ${
                        selected ? "text-white/90" : "!text-slate-700"
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
          {!loading && !err && !hasAnyPlans && (
            <p className="py-8 text-center text-sm text-slate-600 lg:text-base">
              해당 조건의 상품이 없습니다.
            </p>
          )}
          {!loading && !err && hasAnyPlans && tabCards.length === 0 && (
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
              const badge = structureBadgeText(activeTab, product);
              const validDays = extractDaysFromDaysRaw(product.days_raw);

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
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isPinned ? (
                      <div className="bt-bongsim-on-dark inline-flex items-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white shadow-md ring-2 ring-violet-300/80 lg:px-4 lg:py-2 lg:text-xs">
                        추천
                      </div>
                    ) : null}
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-800 lg:text-sm">
                      {badge}
                    </span>
                  </div>

                  {activeTab === "fixed" ? (
                    <>
                      <p className="text-xl font-bold !text-slate-900 lg:text-2xl">
                        {(product.allowance_label || "").trim() || "—"}
                      </p>
                      {validDays != null ? (
                        <p className="mt-0.5 text-xs !text-slate-600 lg:text-sm">
                          {validDays}일 이내 사용
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs !text-slate-600 lg:text-sm">
                        {networkFamilyLabelKr(product.network_family)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold !text-slate-800 lg:text-base">
                        {product.plan_name.trim()}
                      </p>
                      <p className="mt-1 text-lg font-bold !text-slate-900 lg:text-xl">
                        {(product.allowance_label || "").trim() || "—"}
                      </p>
                      <p className="mt-0.5 text-xs !text-slate-600 lg:text-sm">
                        {networkFamilyLabelKr(product.network_family)}
                      </p>
                    </>
                  )}

                  {totalShow != null && (
                    <div className="mt-2">
                      <p className="bt-bongsim-plan-price text-lg font-bold !text-slate-900 lg:text-xl">
                        {formatKrw(totalShow)}
                      </p>
                    </div>
                  )}
                  {dailyShow != null && (
                    <p className="mt-0.5 text-xs font-medium !text-slate-700 lg:text-sm">
                      일당 {formatKrwPerDay(dailyShow)}
                    </p>
                  )}

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
              onClick={() => selectedProduct && onComplete(selectedProduct, quantity)}
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
