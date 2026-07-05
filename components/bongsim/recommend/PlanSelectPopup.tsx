"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { CountryPurchaseNoticeList } from "@/components/bongsim/recommend/CountryPurchaseNotice";
import { DayUsageSummary } from "@/components/bongsim/recommend/DayUsageSummary";
import { KycPlanSelectNotice } from "@/components/bongsim/recommend/KycPlanSelectNotice";
import { PlanCoverageCountriesPanel } from "@/components/bongsim/recommend/PlanCoverageCountriesPanel";
import { RecommendModalShell } from "@/components/bongsim/recommend/RecommendModalShell";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";
import {
  extractDaysFromDaysRaw,
  formatKrw,
  formatKrwPerDay,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { EsimFreeDataBenefitLine } from "@/components/bongsim/recommend/EsimFreeDataBenefitLine";
import { EsimVerificationGuideBox } from "@/components/bongsim/esim/EsimVerificationGuideBox";
import {
  getKycLabelDistribution,
  getKycLabelState,
  hasBinaryAuthDistribution,
  shouldShowBadge,
  type KycBadgeState,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import { sortPlanGroupsForDisplay } from "@/lib/bongsim/recommend/plan-display-sort";
import { filterPlanGroupsByTripDaysWindow } from "@/lib/bongsim/recommend/plan-display-filter";
import {
  classifyPlanSpeedTier,
  PLAN_SPEED_TIER_LABEL,
} from "@/lib/bongsim/recommend/plan-speed-tier";

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

const TAB_LABELS: Record<PlanTab, string> = {
  unlimited: "무제한",
  daily: "데일리",
  fixed: "종량제",
};

const ALL_PLAN_TABS: PlanTab[] = ["unlimited", "daily", "fixed"];

const PLAN_QUANTITY_MIN = 1;
const PLAN_QUANTITY_MAX = 15;

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

function cardsForTab(
  tab: PlanTab,
  groups: PlanGroups,
  activeRecommended: RecommendedPlan | null,
): Array<{ product: ProductOption; isPinned: boolean }> {
  const list = groups[tab] ?? [];
  const recId =
    activeRecommended?.rec_source === tab ? activeRecommended.option_api_id : null;
  return orderWithRecommendedFirst(list, recId).map((product) => ({
    product,
    isPinned: recId === product.option_api_id,
  }));
}

function cardSpeedSubLine(product: ProductOption): string {
  const tier = classifyPlanSpeedTier(product);
  if (tier != null) return PLAN_SPEED_TIER_LABEL[tier];
  return cardSubLine(product);
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
  kycDistribution: KycLabelDistribution;
  layout: "mobile" | "desktop";
  quantity: number;
  onQuantityDecrease: (e: MouseEvent) => void;
  onQuantityIncrease: (e: MouseEvent) => void;
  onSelect: () => void;
};

function onPlanCardSelectKeyDown(onSelect: () => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
}

function CardQuantityControls({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  onDecrease: (e: MouseEvent) => void;
  onIncrease: (e: MouseEvent) => void;
}) {
  return (
    <div className="mt-[8px] flex items-center justify-end gap-[6px]">
      <button
        type="button"
        aria-label="수량 감소"
        onClick={onDecrease}
        disabled={quantity <= PLAN_QUANTITY_MIN}
        className="h-[28px] w-[28px] rounded-md border border-[#E5E5E5] bg-[#FFFFFF] text-[14px] text-[#1F1B2D] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
      >
        −
      </button>
      <span className="min-w-[20px] text-center text-[14px] font-medium text-[#1F1B2D]">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="수량 증가"
        onClick={onIncrease}
        disabled={quantity >= PLAN_QUANTITY_MAX}
        className="h-[28px] w-[28px] rounded-md border border-[#E5E5E5] bg-[#FFFFFF] text-[14px] text-[#1F1B2D] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
      >
        +
      </button>
    </div>
  );
}

function AuthChipMobile({ badge }: { badge: KycBadgeState }) {
  if (badge == null) return null;
  if (badge === "not_required") {
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

function PlanInlineConfirmBar({
  totalKrw,
  canComplete,
  onConfirm,
  barRef,
}: {
  totalKrw: number | null;
  canComplete: boolean;
  onConfirm: () => void;
  barRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={barRef}
      className="rounded-2xl border-2 border-teal-300 bg-teal-50/95 p-4 shadow-[0_8px_24px_-8px_rgba(15,118,110,0.35)] ring-1 ring-teal-100"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">선택한 플랜</span>
        {totalKrw != null ? (
          <span className="text-lg font-bold tabular-nums text-slate-900">{formatKrw(totalKrw)}</span>
        ) : (
          <span className="text-sm text-slate-500">금액 확인 중</span>
        )}
      </div>
      <button
        type="button"
        disabled={!canComplete}
        onClick={onConfirm}
        className={`min-h-[3rem] w-full rounded-xl text-sm font-bold transition lg:text-base ${
          canComplete
            ? "bg-teal-700 text-white shadow-md hover:bg-teal-800"
            : "cursor-not-allowed bg-slate-200 text-slate-400"
        }`}
      >
        선택완료
      </button>
    </div>
  );
}

function AuthChipDesktop({ badge }: { badge: KycBadgeState }) {
  if (badge == null) return null;
  if (badge === "not_required") {
    return (
      <span className="inline-flex items-center gap-[3px] rounded-md border-[0.5px] border-[#5DCAA5] bg-[#E1F5EE] px-[7px] py-0.5 text-[10px] text-[#04342C]">
        <ShieldCheck className="h-[10px] w-[10px]" aria-hidden />
        인증 필요없음
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[3px] rounded-md border-[0.5px] border-[#BA7517] bg-[#FAEEDA] px-[7px] py-0.5 text-[10px] text-[#412402]">
      <ShieldAlert className="h-[10px] w-[10px]" aria-hidden />
      인증 필요
    </span>
  );
}

function PlanCard({
  product,
  isRecommended,
  isSelected,
  displayMatchedDays,
  kycDistribution,
  layout,
  quantity,
  onQuantityDecrease,
  onQuantityIncrease,
  onSelect,
}: PlanCardProps) {
  const kycBadge = shouldShowBadge(product, kycDistribution);
  const packageTotal = displayRecommended(product);
  const dailyRate = dailyRateFromProduct(product, displayMatchedDays);
  const allowance = (product.allowance_label || "").trim() || "—";
  const country = product.plan_name.trim() || "—";
  const carrier = cardCarrierLabel(product);
  const planType = (product.plan_type || "").trim().toLowerCase();
  const fixedDays = planType === "fixed" ? extractDaysFromDaysRaw(product.days_raw) : null;

  if (layout === "desktop") {
    const borderClass = isSelected
      ? "border-2 border-[#6366F1]"
      : isRecommended
        ? "border-2 border-[#AFA9EC]"
        : "border-[0.5px] border-[#E5E5E5]";
    const desktopSubLine =
      planType === "fixed"
        ? fixedDays != null
          ? `${fixedDays}일 이내 사용`
          : "—"
        : cardSpeedSubLine(product);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={onPlanCardSelectKeyDown(onSelect)}
        className={`flex w-full cursor-pointer flex-col rounded-lg bg-[#FFFFFF] p-[10px_12px] text-left transition hover:opacity-95 ${borderClass}`}
        aria-pressed={isSelected}
      >
        {isRecommended ? (
          <span className="mb-1 inline-block self-start rounded-full border-0 bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-medium text-[#26215C]">
            추천
          </span>
        ) : null}

        <div className="flex gap-[8px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
            <div className="text-[18px] font-medium leading-none text-[#1F1B2D]">{allowance}</div>
            <div className="text-[13px] font-medium text-[#1F1B2D]">{desktopSubLine}</div>
            <div className="truncate text-[11px] text-[#9CA3AF]">{country}</div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-center gap-[2px]">
            {packageTotal != null && Number.isFinite(packageTotal) ? (
              <div className="whitespace-nowrap text-[18px] font-medium text-[#1F1B2D]">
                {formatKrw(packageTotal)}
              </div>
            ) : null}
            {dailyRate != null && Number.isFinite(dailyRate) ? (
              <div className="whitespace-nowrap text-[10px] text-[#6B7280]">
                {formatKrwPerDay(dailyRate)}
              </div>
            ) : null}
            {isSelected ? (
              <CardQuantityControls
                quantity={quantity}
                onDecrease={onQuantityDecrease}
                onIncrease={onQuantityIncrease}
              />
            ) : null}
          </div>
        </div>

        <EsimFreeDataBenefitLine product={product} variant="plan" />

        {kycBadge != null ? (
          <div className="mt-[6px]">
            <AuthChipDesktop badge={kycBadge} />
          </div>
        ) : null}
      </div>
    );
  }

  const borderStyle = isSelected
    ? { border: "2px solid #6366F1" }
    : isRecommended
      ? { border: "2px solid #AFA9EC" }
      : { border: "0.5px solid var(--color-border-tertiary, #e2e8f0)" };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onPlanCardSelectKeyDown(onSelect)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-white px-3.5 py-3 text-left transition hover:opacity-95"
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
          <AuthChipMobile badge={kycBadge} />
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
        <EsimFreeDataBenefitLine product={product} variant="plan" />
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
        {isSelected ? (
          <CardQuantityControls
            quantity={quantity}
            onDecrease={onQuantityDecrease}
            onIncrease={onQuantityIncrease}
          />
        ) : null}
      </div>
    </div>
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
  const [activeTab, setActiveTab] = useState<PlanTab>("unlimited");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [matchedDays, setMatchedDays] = useState<number | null>(null);
  const skipClearSelectionRef = useRef(false);
  const inlineConfirmRef = useRef<HTMLDivElement | null>(null);

  const tripDaysFloored = Math.max(1, Math.floor(tripDays));
  const displayMatchedDays = matchedDays ?? tripDaysFloored;
  const showDayMatchNotice =
    activeTab !== "fixed" && matchedDays != null && tripDaysFloored !== matchedDays;

  useEffect(() => {
    if (!open) {
      setRecommended(null);
      setRecommendedByAuth(null);
      setKycDistribution("none");
      setAuthFilter("not_required");
      setRawGroups({ unlimited: [], daily: [], fixed: [] });
      setActiveTab("unlimited");
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
        setRecommendedByAuth(json.recommended_by_auth ?? null);
        const nextRecommended =
          json.recommended && json.recommended.option_api_id ? json.recommended : null;
        setRecommended(nextRecommended);
        const defaultAuth: AuthFilter = "not_required";
        setAuthFilter(defaultAuth);
        const showBinary = hasBinaryAuthDistribution([
          ...nextGroups.unlimited,
          ...nextGroups.daily,
          ...nextGroups.fixed,
        ]);
        const windowed = filterPlanGroupsByTripDaysWindow(nextGroups, tripDaysFloored);
        const visibleGroups = showBinary
          ? filterGroupsByAuth(windowed, defaultAuth)
          : windowed;
        const pin = showBinary
          ? json.recommended_by_auth?.[defaultAuth] ?? null
          : nextRecommended;
        const visibleTabs = ALL_PLAN_TABS.filter((t) => (visibleGroups[t]?.length ?? 0) > 0);
        const recTab = pin?.rec_source;
        setActiveTab(
          recTab && visibleTabs.includes(recTab) ? recTab : (visibleTabs[0] ?? "unlimited"),
        );
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

  const allCatalogProducts = useMemo(
    () => [...rawGroups.unlimited, ...rawGroups.daily, ...rawGroups.fixed],
    [rawGroups],
  );

  const showAuthToggle = hasBinaryAuthDistribution(allCatalogProducts);

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

  const tabCounts = useMemo(
    () => ({
      unlimited: groups.unlimited.length,
      daily: groups.daily.length,
      fixed: groups.fixed.length,
    }),
    [groups],
  );

  const activeRecommended = useMemo(() => {
    const pin = showAuthToggle ? recommendedByAuth?.[authFilter] ?? null : recommended;
    if (!pin?.option_api_id) return null;
    const inView = (groups[pin.rec_source as PlanTab] ?? []).some(
      (p) => p.option_api_id === pin.option_api_id,
    );
    return inView ? pin : null;
  }, [showAuthToggle, recommendedByAuth, authFilter, recommended, groups]);

  const tabCards = useMemo(
    () => cardsForTab(activeTab, groups, activeRecommended),
    [groups, activeTab, activeRecommended],
  );

  const gridColumns = useMemo(
    () =>
      ALL_PLAN_TABS.map((tab) => ({
        tab,
        cards: cardsForTab(tab, groups, activeRecommended),
      })),
    [groups, activeRecommended],
  );

  const allVisibleProducts = useMemo(() => tabCards.map((r) => r.product), [tabCards]);

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

  const handleComplete = () => {
    if (!selectedProduct || !canComplete) return;
    onComplete(selectedProduct, quantity, { kycDistribution });
  };

  const handleQuantityDecrease = (e: MouseEvent) => {
    e.stopPropagation();
    setQuantity((q) => Math.max(PLAN_QUANTITY_MIN, q - 1));
  };

  const handleQuantityIncrease = (e: MouseEvent) => {
    e.stopPropagation();
    setQuantity((q) => Math.min(PLAN_QUANTITY_MAX, q + 1));
  };

  useEffect(() => {
    setQuantity(1);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const frame = requestAnimationFrame(() => {
      inlineConfirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  useEffect(() => {
    if (skipClearSelectionRef.current) {
      skipClearSelectionRef.current = false;
      return;
    }
    setSelectedId(null);
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
        <div className="mt-3">
          <CountryPurchaseNoticeList countryCode={countryCode} compact />
        </div>
        <KycPlanSelectNotice distribution={kycDistribution} compact />
        <DayUsageSummary
          className="mt-3"
          tripDays={tripDaysFloored}
          product={selectedProduct}
          priceKrw={unitKrw}
        />
        {isRegionPackCode(countryCode) ? (
          <PlanCoverageCountriesPanel destinationCode={countryCode} className="mt-3" />
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-[#767676]">
          상품마다 활성화 정책·망(로밍/로컬)이 다릅니다. 선택한 카드의 조건을 확인해 주세요.
        </p>
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
      ) : kycDistribution === "required_only" ? (
        <div className="border-b border-slate-100 px-5 pb-3 pt-3">
          <KycPlanSelectNotice distribution={kycDistribution} />
        </div>
      ) : null}

      {hasAnyPlansAtAll ? (
        <div className="border-b border-slate-100 px-5 lg:hidden">
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
                  className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-bold transition ${
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
        </div>
      ) : null}

      <div
        className={
          inline
            ? "max-h-[min(55vh,520px)] overflow-y-auto px-5 py-4 lg:max-h-[min(70vh,640px)]"
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

        {/* Mobile: single tab + vertical card list (unchanged) */}
        <div className="space-y-3 lg:hidden">
          {!loading && !err && hasVisiblePlans && tabCards.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-600">
              이 유형의 플랜이 없습니다.
            </p>
          )}
          {!loading &&
            !err &&
            tabCards.map(({ product, isPinned }) => {
              const isCardSelected = selectedId === product.option_api_id;
              return (
                <Fragment key={`m-${activeTab}-${product.option_api_id}${isPinned ? "-pin" : ""}`}>
                  <PlanCard
                    product={product}
                    isRecommended={isPinned}
                    isSelected={isCardSelected}
                    displayMatchedDays={displayMatchedDays}
                    kycDistribution={kycDistribution}
                    layout="mobile"
                    quantity={quantity}
                    onQuantityDecrease={handleQuantityDecrease}
                    onQuantityIncrease={handleQuantityIncrease}
                    onSelect={() => setSelectedId(product.option_api_id)}
                  />
                  {isCardSelected ? (
                    <PlanInlineConfirmBar
                      barRef={inlineConfirmRef}
                      totalKrw={totalKrw}
                      canComplete={canComplete}
                      onConfirm={handleComplete}
                    />
                  ) : null}
                </Fragment>
              );
            })}
        </div>

        {/* PC (lg+): 3-column grid with tab headers + column emphasis */}
        {!loading && !err && hasVisiblePlans ? (
          <div className="hidden lg:block">
            <div className="mb-[8px] grid grid-cols-3 gap-[8px]" role="tablist" aria-label="플랜 유형">
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
                    className={`min-h-10 rounded-lg px-2 text-[13px] font-medium transition ${
                      disabled
                        ? "cursor-not-allowed border-[0.5px] border-[#E5E5E5] bg-[#F3F4F6] text-[#9CA3AF]"
                        : selected
                          ? "border-2 border-[#0F6E56] bg-[#E1F5EE] text-[#04342C]"
                          : "border-[0.5px] border-[#E5E5E5] bg-[#FFFFFF] text-[#6B7280]"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                    <span className="ml-1 font-normal">({count})</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 items-start gap-[8px]">
              {gridColumns.map(({ tab, cards }) => {
                const isActiveColumn = activeTab === tab;
                return (
                  <div
                    key={tab}
                    className={`flex flex-col gap-[8px] ${
                      isActiveColumn
                        ? "opacity-100"
                        : "opacity-[0.35] transition-opacity duration-150 hover:opacity-70"
                    }`}
                  >
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-[#9CA3AF]">
                        이 유형의 플랜이 없습니다.
                      </p>
                    ) : (
                      cards.map(({ product, isPinned }) => {
                        const isCardSelected = selectedId === product.option_api_id;
                        return (
                          <Fragment key={`d-${tab}-${product.option_api_id}${isPinned ? "-pin" : ""}`}>
                            <PlanCard
                              product={product}
                              isRecommended={isPinned}
                              isSelected={isCardSelected}
                              displayMatchedDays={displayMatchedDays}
                              kycDistribution={kycDistribution}
                              layout="desktop"
                              quantity={quantity}
                              onQuantityDecrease={handleQuantityDecrease}
                              onQuantityIncrease={handleQuantityIncrease}
                              onSelect={() => {
                                if (isActiveColumn) {
                                  setSelectedId(product.option_api_id);
                                  return;
                                }
                                skipClearSelectionRef.current = true;
                                setActiveTab(tab);
                                setSelectedId(product.option_api_id);
                              }}
                            />
                            {isCardSelected ? (
                              <PlanInlineConfirmBar
                                barRef={inlineConfirmRef}
                                totalKrw={totalKrw}
                                canComplete={canComplete}
                                onConfirm={handleComplete}
                              />
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 px-5 py-4 lg:px-6">
        {canComplete ? (
          <p className="mb-3 text-center text-xs text-slate-500 lg:text-sm">
            선택한 플랜 바로 아래에서 확인할 수 있어요
          </p>
        ) : (
          <div className="mb-3 flex items-center justify-end">
            <div className="flex items-center">
              <span className="mr-[8px] text-[13px] text-[#6B7280]">총 금액</span>
              <span className="text-[13px] text-[#6B7280]">플랜을 선택해주세요</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onBack}
          className="min-h-[3rem] w-full rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold !text-black transition hover:bg-slate-50 lg:text-base"
          style={{ color: "#000" }}
        >
          이전
        </button>
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
    <RecommendModalShell open={open} onClose={onBack} maxWidthClassName="max-w-md lg:max-w-5xl">
      {panel}
    </RecommendModalShell>
  );
}
