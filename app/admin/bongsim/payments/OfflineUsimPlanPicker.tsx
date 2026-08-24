"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterOfflineUsimDestinations,
  isOfflineUsimDestinationSelected,
  offlineUsimDestinationLabel,
  offlineUsimPopularDestinations,
  offlineUsimSelectedSummary,
  toggleOfflineUsimDestinationSelection,
  type OfflineUsimDestinationOption,
} from "@/lib/bongsim/admin/offline-usim-destination-options";
import { filterPlanGroupsByTripDaysWindow } from "@/lib/bongsim/recommend/plan-display-filter";
import { sortPlanGroupsForDisplay, type PlanDisplayTab } from "@/lib/bongsim/recommend/plan-display-sort";
import { formatPlanOptionLabel } from "@/lib/bongsim/recommend/plan-option-label";
import { formatKrw, type ProductOption } from "@/lib/bongsim/recommend/product-option";
import { afterSupplyCostKrw } from "@/lib/bongsim/data/pricing-after-recommended-krw";

const DAY_CHIPS = [3, 5, 7, 10, 15, 30] as const;
const TAB_LABELS: Record<PlanDisplayTab, string> = {
  unlimited: "무제한",
  daily: "데일리",
  fixed: "종량제",
};
const ALL_TABS: PlanDisplayTab[] = ["unlimited", "daily", "fixed"];

export type OfflineUsimPlanSelection = {
  option_api_id: string;
  label: string;
  plan_name: string;
  days_raw: string;
  /** 고객 수납·카탈로그 정가(after.recommended_krw) */
  price_krw: number | null;
  /** 공급 원가(after.supply_krw) */
  supply_krw: number | null;
};

type Props = {
  value: string;
  onChange: (sel: OfflineUsimPlanSelection | null) => void;
  /** 기본: 오프라인 USIM 카탈로그. 무상 eSIM은 complimentary-esim plans API. */
  plansApiPath?: string;
  emptyPlansHint?: string;
};

type PlanGroups = {
  unlimited: ProductOption[];
  daily: ProductOption[];
  fixed: ProductOption[];
};

function networkLabel(network: string): string {
  const n = network.trim().toLowerCase();
  if (n === "local") return "로컬";
  if (n === "roaming") return "로밍";
  return network || "—";
}

function DestinationButton({
  dest,
  selected,
  onToggle,
}: {
  dest: OfflineUsimDestinationOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex min-h-[3.25rem] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-teal-600 bg-teal-50 ring-1 ring-teal-500/40"
          : "border-bt-border-soft bg-white hover:border-teal-300 hover:bg-teal-50/40"
      }`}
    >
      <span className="text-lg leading-none" aria-hidden>
        {dest.flag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-900">{dest.nameKr}</span>
        {dest.subtitleKr ? (
          <span className="block truncate text-xs text-slate-600">{dest.subtitleKr}</span>
        ) : null}
      </span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
          dest.kind === "pack" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-700"
        }`}
      >
        {dest.kind === "pack" ? "패키지" : "국가"}
      </span>
    </button>
  );
}

export default function OfflineUsimPlanPicker({
  value,
  onChange,
  plansApiPath,
  emptyPlansHint,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tripDays, setTripDays] = useState(7);
  const [activeTab, setActiveTab] = useState<PlanDisplayTab>("unlimited");
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [rawGroups, setRawGroups] = useState<PlanGroups>({ unlimited: [], daily: [], fixed: [] });
  const [matchedDays, setMatchedDays] = useState<number | null>(null);
  const [showAdvancedId, setShowAdvancedId] = useState(false);
  const [manualOptionId, setManualOptionId] = useState("");
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);

  const tripDaysFloored = Math.max(1, Math.floor(tripDays));

  const plansUrl =
    plansApiPath?.trim() || "/api/admin/bongsim/offline-usim/plans";

  const searchResults = useMemo(
    () => filterOfflineUsimDestinations(searchQuery),
    [searchQuery],
  );
  const searchCountries = useMemo(
    () => searchResults.filter((d) => d.kind === "country"),
    [searchResults],
  );
  const searchPacks = useMemo(
    () => searchResults.filter((d) => d.kind === "pack"),
    [searchResults],
  );
  const popular = useMemo(() => offlineUsimPopularDestinations(), []);

  const displayGroups = useMemo(() => {
    const windowed = filterPlanGroupsByTripDaysWindow(
      rawGroups,
      tripDaysFloored,
      undefined,
      matchedDays,
    );
    return sortPlanGroupsForDisplay(windowed, tripDaysFloored);
  }, [rawGroups, tripDaysFloored, matchedDays]);

  const tabCounts = useMemo(
    () => ({
      unlimited: displayGroups.unlimited.length,
      daily: displayGroups.daily.length,
      fixed: displayGroups.fixed.length,
    }),
    [displayGroups],
  );

  const visiblePlans = displayGroups[activeTab] ?? [];

  useEffect(() => {
    if (step !== 3 || selectedCodes.length === 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const q = new URLSearchParams({
          country: selectedCodes[0]!,
          days: String(tripDaysFloored),
          codes: selectedCodes.join(","),
        });
        const res = await fetch(`${plansUrl}?${q.toString()}`, {
          cache: "no-store",
        });
        // REGRESSION-FREEZE[bongsim-offline-usim-plan-picker]: 빈 응답 JSON 가드 — manifest
        const raw = await res.text();
        if (!raw.trim()) {
          throw new Error(`서버 응답이 비었습니다 (${res.status}). 잠시 후 다시 시도하세요.`);
        }
        let json: {
          groups?: Partial<PlanGroups>;
          matched_days?: number;
          error?: string;
          message?: string;
        };
        try {
          json = JSON.parse(raw) as typeof json;
        } catch {
          throw new Error(`서버 응답을 해석할 수 없습니다 (${res.status}).`);
        }
        if (!res.ok) {
          // REGRESSION-FREEZE[bongsim-admin-plans-pg-retry]: 한글 message 우선 — manifest
          throw new Error(
            (typeof json.message === "string" && json.message.trim()) ||
              (json.error === "query_failed"
                ? "플랜 목록 조회에 실패했습니다. 잠시 후 다시 시도하세요."
                : json.error === "connection_timeout"
                  ? "DB 연결이 지연되었습니다. 잠시 후 다시 시도하세요."
                  : json.error) ||
              "플랜 조회 실패",
          );
        }
        if (cancelled) return;
        setRawGroups({
          unlimited: json.groups?.unlimited ?? [],
          daily: json.groups?.daily ?? [],
          fixed: json.groups?.fixed ?? [],
        });
        const md =
          typeof json.matched_days === "number" && json.matched_days >= 1
            ? Math.trunc(json.matched_days)
            : tripDaysFloored;
        setMatchedDays(md);
        const nextTab = ALL_TABS.find((t) => (json.groups?.[t]?.length ?? 0) > 0) ?? "unlimited";
        setActiveTab(nextTab);
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "플랜을 불러오지 못했습니다.");
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
  }, [step, selectedCodes.join(","), tripDaysFloored, plansUrl]);

  useEffect(() => {
    const visibleTabs = ALL_TABS.filter((t) => tabCounts[t] > 0);
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]!);
    }
  }, [tabCounts, activeTab]);

  const selectPlan = (p: ProductOption) => {
    const label = `${p.plan_name.trim()} · ${p.days_raw} · ${formatPlanOptionLabel(p)} · ${networkLabel(p.network_family)}`;
    setSelectedSummary(label);
    onChange({
      option_api_id: p.option_api_id,
      label,
      plan_name: p.plan_name,
      days_raw: p.days_raw,
      price_krw:
        typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)
          ? p.recommended_price
          : null,
      supply_krw: afterSupplyCostKrw(p.price_block),
    });
  };

  const toggleDestination = (code: string) => {
    setSelectedCodes((prev) => toggleOfflineUsimDestinationSelection(prev, code));
    setSelectedSummary(null);
    onChange(null);
  };

  const goStep2 = () => {
    if (selectedCodes.length === 0) return;
    setStep(2);
    onChange(null);
  };

  const goStep3 = () => {
    if (tripDaysFloored < 1) return;
    setStep(3);
    onChange(null);
  };

  return (
    <div className="space-y-4 rounded-xl border border-teal-200/60 bg-white/80 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-900">
        <StepBadge n={1} label="여행지" active={step === 1} done={step > 1} />
        <span className="text-teal-400">→</span>
        <StepBadge n={2} label="일수" active={step === 2} done={step > 2} />
        <span className="text-teal-400">→</span>
        <StepBadge n={3} label="플랜" active={step === 3} done={Boolean(value)} />
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-xs text-teal-900/80">
            단일 국가는 여러 개 선택 가능(다국가 플랜). 패키지는 하나만 선택됩니다. 검색으로 국가·패키지를
            동시에 찾을 수 있습니다.
          </p>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="국가·패키지 검색 (예: 일본, 유럽, 동남아)"
            className="w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
          />
          {selectedCodes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleDestination(code)}
                  className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-900 hover:bg-teal-200"
                >
                  {offlineUsimDestinationLabel(code)} ×
                </button>
              ))}
            </div>
          ) : null}

          {!searchQuery.trim() ? (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">인기</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {popular.map((dest) => (
                    <li key={dest.code}>
                      <DestinationButton
                        dest={dest}
                        selected={isOfflineUsimDestinationSelected(selectedCodes, dest.code)}
                        onToggle={() => toggleDestination(dest.code)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          {searchQuery.trim() ? (
            <div className="space-y-3">
              {searchCountries.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-slate-600">단일 국가 ({searchCountries.length})</h3>
                  <ul className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                    {searchCountries.map((dest) => (
                      <li key={dest.code}>
                        <DestinationButton
                          dest={dest}
                          selected={isOfflineUsimDestinationSelected(selectedCodes, dest.code)}
                          onToggle={() => toggleDestination(dest.code)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {searchPacks.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-slate-600">다국가 패키지 ({searchPacks.length})</h3>
                  <ul className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                    {searchPacks.map((dest) => (
                      <li key={dest.code}>
                        <DestinationButton
                          dest={dest}
                          selected={isOfflineUsimDestinationSelected(selectedCodes, dest.code)}
                          onToggle={() => toggleDestination(dest.code)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {searchCountries.length === 0 && searchPacks.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={selectedCodes.length === 0}
            onClick={goStep2}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-40"
          >
            다음: 여행 일수
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-teal-950">{offlineUsimSelectedSummary(selectedCodes)}</p>
          <label className="block text-xs text-bt-text-muted-lavender">
            여행 일수
            <input
              type="number"
              min={1}
              max={90}
              value={tripDays}
              onChange={(e) => {
                setTripDays(Number.parseInt(e.target.value, 10) || 1);
                onChange(null);
              }}
              className="mt-1 w-full max-w-[8rem] rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {DAY_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setTripDays(d);
                  onChange(null);
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  tripDaysFloored === d
                    ? "bg-teal-700 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              이전
            </button>
            <button
              type="button"
              onClick={goStep3}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              다음: 플랜 선택
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm text-teal-950">
            <span className="font-semibold">{offlineUsimSelectedSummary(selectedCodes)}</span>
            <span className="text-slate-600"> · {tripDaysFloored}일</span>
            {matchedDays != null && matchedDays !== tripDaysFloored ? (
              <span className="ml-1 text-xs text-blue-800">
                (카탈로그 {matchedDays}일 플랜 표시)
              </span>
            ) : null}
          </p>

          {loading ? <p className="text-sm text-slate-600">플랜 불러오는 중…</p> : null}
          {loadErr ? <p className="text-sm text-red-600">{loadErr}</p> : null}

          {!loading && !loadErr ? (
            <>
              <div className="flex flex-wrap gap-2">
                {ALL_TABS.map((tab) =>
                  tabCounts[tab] > 0 ? (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        activeTab === tab
                          ? "bg-teal-700 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {TAB_LABELS[tab]} ({tabCounts[tab]})
                    </button>
                  ) : null,
                )}
              </div>

              {visiblePlans.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-900">
                  {emptyPlansHint ??
                    "선택한 조건에 맞는 플랜이 없습니다. 여행지·일수를 바꿔 보세요."}
                </p>
              ) : (
                <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {visiblePlans.map((p) => {
                    const selected = value === p.option_api_id;
                    const price =
                      typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)
                        ? p.recommended_price
                        : null;
                    const supply = afterSupplyCostKrw(p.price_block);
                    return (
                      <li key={p.option_api_id}>
                        <button
                          type="button"
                          onClick={() => selectPlan(p)}
                          className={`flex w-full flex-col rounded-lg border px-3 py-3 text-left text-sm transition ${
                            selected
                              ? "border-teal-600 bg-teal-50 ring-2 ring-teal-400/50"
                              : "border-slate-200 bg-white hover:border-teal-300"
                          }`}
                        >
                          <span className="font-semibold text-slate-900">{formatPlanOptionLabel(p)}</span>
                          <span className="mt-1 text-xs text-slate-600">
                            {p.plan_name} · {p.days_raw} · {networkLabel(p.network_family)}
                          </span>
                          <span className="mt-2 text-base font-bold text-teal-800">
                            {price != null ? formatKrw(price) : "가격 —"}
                          </span>
                          {supply != null ? (
                            <span className="mt-0.5 block text-xs text-slate-500">원가 {formatKrw(supply)}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              이전
            </button>
          </div>
        </div>
      ) : null}

      {value && selectedSummary ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          선택됨: {selectedSummary}
        </p>
      ) : null}

      <div className="border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvancedId((v) => !v)}
          className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
        >
          {showAdvancedId ? "option ID 직접 입력 숨기기" : "option ID 직접 입력 (고급)"}
        </button>
        {showAdvancedId ? (
          <label className="mt-2 block text-xs text-bt-text-muted-lavender">
            option_api_id
            <input
              value={manualOptionId || value}
              onChange={(e) => {
                const id = e.target.value;
                setManualOptionId(id);
                if (id.trim()) {
                  setSelectedSummary(id.trim());
                  onChange({
                    option_api_id: id.trim(),
                    label: id.trim(),
                    plan_name: "",
                    days_raw: "",
                    price_krw: null,
                    supply_krw: null,
                  });
                } else {
                  setSelectedSummary(null);
                  onChange(null);
                }
              }}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 font-mono text-sm"
              placeholder="유심사 옵션 ID"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function StepBadge({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        active ? "bg-teal-700 text-white" : done ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-600"
      }`}
    >
      <span className="font-bold">{n}</span>
      {label}
    </span>
  );
}
