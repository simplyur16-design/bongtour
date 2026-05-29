"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import {
  extractDaysFromDaysRaw,
  formatKrw,
  formatKrwPerDay,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { esimHasFreeData } from "@/lib/bongsim/constants";
import { EsimVerificationGuideBox } from "@/components/bongsim/esim/EsimVerificationGuideBox";
import {
  getKycLabelDistribution,
  getKycLabelState,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import { sortPlanGroupsForDisplay } from "@/lib/bongsim/recommend/plan-display-sort";
import { filterPlanGroupsByTripDaysWindow } from "@/lib/bongsim/recommend/plan-display-filter";

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

const SECTION_LABELS: Record<PlanTab, string> = {
  unlimited: "무제한",
  daily: "데일리",
  fixed: "종량제",
};

const ALL_SECTIONS: PlanTab[] = ["unlimited", "daily", "fixed"];

/** mockup: 긴 리스트 일부 노출 후 "N건 더 보기" */
const SECTION_INITIAL_VISIBLE = 6;

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

function allowanceCapacityGbKey(label: string | null | undefined): number {
  const parsed = parseAllowance(label);
  if (parsed.kind === "mb") return parsed.mb / 1024;
  if (parsed.kind === "unlimited") return Number.POSITIVE_INFINITY;
  return -1;
}

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

function parseMbpsFromQos(qos_raw: string | null | undefined): string | null {
  const low = (qos_raw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]!);
    if (Number.isFinite(n)) {
      const m = n / 1000;
      const rounded = m >= 1 ? String(Math.round(m)) : m.toFixed(2).replace(/\.?0+$/, "");
      return `${rounded}Mbps`;
    }
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) {
    const n = parseFloat(mb[1]!);
    if (Number.isFinite(n)) {
      const rounded = n >= 1 ? String(Math.round(n)) : n.toFixed(2).replace(/\.?0+$/, "");
      return `${rounded}Mbps`;
    }
  }
  return null;
}

/** mockup card sub line (12px secondary) */
function cardSubLine(product: ProductOption): string {
  const pt = (product.plan_type || "").trim().toLowerCase();
  const allowance = (product.allowance_label || "").trim() || "—";
  if (pt === "unlimited") {
    const mbps = parseMbpsFromQos(product.qos_raw);
    return mbps ? `무제한 · 최대 ${mbps}` : "무제한";
  }
  if (pt === "daily") return `매일 ${allowance}`;
  if (pt === "fixed") return `총 ${allowance}`;
  return allowance;
}

function cardCarrierLabel(product: ProductOption): string {
  const opt = (product.option_label || "").trim();
  if (opt) return opt;
  return (product.network_family || "").trim() || "—";
}

function orderWithRecommendedFirst(
  plans: ProductOption[],
  recommendedId: string | null,
): ProductOption[] {
  if (!recommendedId) return plans;
  const pinned = plans.find((p) => p.option_api_id === recommendedId);
  if (!pinned) return plans;
  return [pinned, ...plans.filter((p) => p.option_api_id !== recommendedId)];
}

type Props = {
  open: boolean;
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

type PlanCardProps = {
  product: ProductOption;
  isRecommended: boolean;
  isSelected: boolean;
  displayMatchedDays: number;
  onSelect: () => void;
};

function AuthChip({ product }: { product: ProductOption }) {
  const required = getKycLabelState(product.flags) === "required";
  if (!required) {
    return (
      <span
        className="inline-flex items-center gap-[3px] rounded-md px-[7px] py-0.5 text-[11px]"
        style={{
          background: "#E1F5EE",
          color: "#04342C",
          border: "0.5px solid #5DCAA5",
        }}
      >
        <ShieldCheck className="h-[11px] w-[11px]" aria-hidden />
        인증 필요없음
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-md px-[7px] py-0.5 text-[11px]"
      style={{
        background: "#FAEEDA",
        color: "#412402",
        border: "0.5px solid #EF9F27",
      }}
    >
      <ShieldAlert className="h-[11px] w-[11px]" aria-hidden />
      인증 필요
    </span>
  );
}

function PlanCard({
  product,
  isRecommended,
  isSelected,
  displayMatchedDays,
  onSelect,
}: PlanCardProps) {
  const packageTotal = displayRecommended(product);
  const dailyRate = dailyRateFromProduct(product, displayMatchedDays);
  const allowance = (product.allowance_label || "").trim() || "—";
  const country = product.plan_name.trim() || "—";
  const carrier = cardCarrierLabel(product);
  const planType = (product.plan_type || "").trim().toLowerCase();
  const fixedDays = planType === "fixed" ? extractDaysFromDaysRaw(product.days_raw) : null;

  const borderStyle = isSelected
    ? { border: "2px solid #6366F1" }
    : isRecommended
      ? { border: "2px solid #AFA9EC" }
      : { border: "0.5px solid var(--color-border-tertiary, #e2e8f0)" };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg bg-white px-3.5 py-3 text-left transition hover:opacity-95"
      style={borderStyle}
      aria-pressed={isSelected}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-[5px]">
          {isRecommended ? (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: "#EEEDFE", color: "#26215C" }}
            >
              추천
            </span>
          ) : null}
          <AuthChip product={product} />
        </div>
        {planType === "fixed" ? (
          <>
            <div className="mb-1 text-lg font-medium text-slate-900">{allowance}</div>
            {fixedDays != null ? (
              <div className="mb-1 text-xs text-slate-400">{fixedDays}일 이내 사용</div>
            ) : null}
            <div className="text-xs text-slate-400">
              {country} · {carrier}
            </div>
          </>
        ) : (
          <>
            <div className="mb-1 text-xs text-slate-500">{cardSubLine(product)}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-medium text-slate-900">{allowance}</span>
              <span className="text-xs text-slate-400">
                {country} · {carrier}
              </span>
            </div>
          </>
        )}
        {esimHasFreeData(product.network_family, product.plan_name) ? (
          <p className="mt-1 text-[11px] font-medium text-teal-700">구글맵·ChatGPT 데이터 무료</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        {packageTotal != null && Number.isFinite(packageTotal) ? (
          <div className="whitespace-nowrap text-base font-medium text-slate-900">
            {formatKrw(packageTotal)}
          </div>
        ) : null}
        {dailyRate != null && Number.isFinite(dailyRate) ? (
          <div className="whitespace-nowrap text-[11px] text-slate-500">
            {formatKrwPerDay(dailyRate)}
          </div>
        ) : null}
      </div>
    </button>
  );
}

type PlanSectionProps = {
  section: PlanTab;
  plans: ProductOption[];
  recommendedId: string | null;
  displayMatchedDays: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function PlanSection({
  section,
  plans,
  recommendedId,
  displayMatchedDays,
  selectedId,
  onSelect,
}: PlanSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const disabled = plans.length === 0;
  const ordered = useMemo(
    () => orderWithRecommendedFirst(plans, recommendedId),
    [plans, recommendedId],
  );
  const visible = expanded ? ordered : ordered.slice(0, SECTION_INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, ordered.length - SECTION_INITIAL_VISIBLE);

  return (
    <section aria-label={SECTION_LABELS[section]}>
      <div
        className="mb-2.5 mt-3.5 flex items-center justify-between border-b border-slate-200 px-1 pb-2 pt-2.5"
        style={{ borderBottomWidth: "0.5px" }}
      >
        <div
          className={`text-sm font-medium ${disabled ? "text-slate-400" : "text-slate-900"}`}
        >
          {SECTION_LABELS[section]}{" "}
          <span className="font-normal text-slate-500">({plans.length})</span>
        </div>
        {disabled ? (
          <span className="text-xs text-slate-400">이 일정엔 해당 상품 없음</span>
        ) : null}
      </div>
      {visible.length > 0 ? (
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
        >
          {visible.map((product) => (
            <PlanCard
              key={product.option_api_id}
              product={product}
              isRecommended={recommendedId === product.option_api_id}
              isSelected={selectedId === product.option_api_id}
              displayMatchedDays={displayMatchedDays}
              onSelect={() => onSelect(product.option_api_id)}
            />
          ))}
        </div>
      ) : null}
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2.5 w-full cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2.5 text-[13px] text-slate-500"
          style={{ borderWidth: "0.5px" }}
        >
          {SECTION_LABELS[section]} {hiddenCount}건 더 보기
        </button>
      ) : null}
    </section>
  );
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity] = useState(1);
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
      setSelectedId(null);
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
        setRecommendedByAuth(json.recommended_by_auth ?? null);
        setRecommended(
          json.recommended && json.recommended.option_api_id ? json.recommended : null,
        );
        setAuthFilter("not_required");
        setSelectedId(null);
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

  const windowFilteredGroups = useMemo(
    () => filterPlanGroupsByTripDaysWindow(rawGroups, tripDaysFloored),
    [rawGroups, tripDaysFloored],
  );

  const groups = useMemo(() => {
    const filtered = !showAuthToggle
      ? windowFilteredGroups
      : filterGroupsByAuth(windowFilteredGroups, authFilter);
    return sortPlanGroupsForDisplay(filtered, tripDaysFloored);
  }, [windowFilteredGroups, authFilter, showAuthToggle, tripDaysFloored]);

  const authCounts = useMemo(() => {
    const countFor = (auth: AuthFilter) => {
      const g = filterGroupsByAuth(windowFilteredGroups, auth);
      return g.unlimited.length + g.daily.length + g.fixed.length;
    };
    return {
      not_required: countFor("not_required"),
      required: countFor("required"),
    };
  }, [windowFilteredGroups]);

  const activeRecommended = useMemo(() => {
    const pin = showAuthToggle ? recommendedByAuth?.[authFilter] ?? null : recommended;
    if (!pin?.option_api_id) return null;
    const inView = [...groups.unlimited, ...groups.daily, ...groups.fixed].some(
      (p) => p.option_api_id === pin.option_api_id,
    );
    return inView ? pin : null;
  }, [showAuthToggle, recommendedByAuth, authFilter, recommended, groups]);

  const recommendedBySection = useMemo(
    () => ({
      unlimited:
        activeRecommended?.rec_source === "unlimited" ? activeRecommended.option_api_id : null,
      daily: activeRecommended?.rec_source === "daily" ? activeRecommended.option_api_id : null,
      fixed: activeRecommended?.rec_source === "fixed" ? activeRecommended.option_api_id : null,
    }),
    [activeRecommended],
  );

  const allVisibleProducts = useMemo(
    () => [...groups.unlimited, ...groups.daily, ...groups.fixed],
    [groups],
  );

  const hasAnyPlansAtAll =
    windowFilteredGroups.unlimited.length > 0 ||
    windowFilteredGroups.daily.length > 0 ||
    windowFilteredGroups.fixed.length > 0;

  const hasVisiblePlans =
    groups.unlimited.length > 0 || groups.daily.length > 0 || groups.fixed.length > 0;

  const selectedProduct = useMemo(
    () =>
      selectedId != null
        ? allVisibleProducts.find((p) => p.option_api_id === selectedId) ?? null
        : null,
    [allVisibleProducts, selectedId],
  );

  const unitKrw = useMemo(() => {
    if (!selectedProduct) return null;
    return displayRecommended(selectedProduct);
  }, [selectedProduct]);

  const totalKrw = unitKrw != null && Number.isFinite(unitKrw) ? unitKrw * quantity : null;
  const canComplete = Boolean(selectedId && selectedProduct && quantity >= 1);

  useEffect(() => {
    setSelectedId(null);
  }, [authFilter]);

  if (!open) return null;

  const panel = (
    <div className={inline ? "flex flex-col text-slate-900" : "flex max-h-[92vh] flex-col"}>
      <div className="border-b border-slate-100 px-5 pb-4 pt-5">
        <p className="text-[13px] text-slate-500">
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
              onClick={() => setAuthFilter("not_required")}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition"
              style={
                authFilter === "not_required"
                  ? {
                      background: "#E1F5EE",
                      color: "#04342C",
                      border: "0.5px solid #0F6E56",
                    }
                  : {
                      background: "var(--color-background-primary, #fff)",
                      color: "var(--color-text-secondary, #64748b)",
                      border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
                    }
              }
            >
              <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
              인증 필요없음
              <span className="font-normal opacity-75">({authCounts.not_required})</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthFilter("required")}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition"
              style={
                authFilter === "required"
                  ? {
                      background: "#FAEEDA",
                      color: "#412402",
                      border: "0.5px solid #BA7517",
                    }
                  : {
                      background: "var(--color-background-primary, #fff)",
                      color: "var(--color-text-secondary, #64748b)",
                      border: "0.5px solid var(--color-border-tertiary, #e2e8f0)",
                    }
              }
            >
              <ShieldAlert className="h-[18px] w-[18px]" aria-hidden />
              인증 필요
              <span className="font-normal opacity-75">({authCounts.required})</span>
            </button>
          </div>
          {authFilter === "required" ? <EsimVerificationGuideBox /> : null}
        </div>
      ) : null}

      <div
        className={
          inline
            ? "max-h-[min(55vh,520px)] overflow-y-auto px-5 py-4"
            : "flex-1 overflow-y-auto px-5 py-4"
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
        {!loading && !err && hasVisiblePlans
          ? ALL_SECTIONS.map((section) => (
              <PlanSection
                key={section}
                section={section}
                plans={groups[section]}
                recommendedId={recommendedBySection[section]}
                displayMatchedDays={displayMatchedDays}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))
          : null}
      </div>

      <div className="border-t border-slate-100 px-5 py-4 lg:px-6">
        <p className="mb-3 text-center text-sm text-slate-800 lg:text-base">
          {totalKrw != null ? (
            <span className="text-lg font-bold text-slate-900 lg:text-xl">{formatKrw(totalKrw)}</span>
          ) : (
            <span className="text-slate-500">플랜을 선택해주세요</span>
          )}
        </p>
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
              selectedProduct && onComplete(selectedProduct, quantity, { kycDistribution })
            }
            className={`min-h-[3rem] flex-1 rounded-xl text-sm font-bold !text-black transition lg:text-base ${
              canComplete ? "bg-blue-100 hover:bg-blue-200" : "cursor-not-allowed bg-slate-200"
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
    <RecommendModalShell open={open} onClose={onBack} maxWidthClassName="max-w-2xl lg:max-w-3xl">
      {panel}
    </RecommendModalShell>
  );
}
