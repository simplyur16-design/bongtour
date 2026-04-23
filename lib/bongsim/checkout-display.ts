import { funnelTripDayCount, funnelTripNights } from "./constants";
import { parseEsimPlanId } from "./esim-detail";
import { getCountryById, parseCovPlanId } from "./mock-data";
import type { FunnelState, MockPlan, NetworkType } from "./types";

export type CheckoutCountryLine = { code: string; nameKr: string; flag: string };

const NET_KO: Record<NetworkType, string> = {
  roaming: "로밍형",
  local: "현지망형",
};

/** 국가 요약: 커버리지 플랜 → URL 코드, 그다음 퍼널, 단일 eSIM/폴백은 국가 코드 기준. */
export function resolveCheckoutCountries(planId: string, plan: MockPlan, funnel: FunnelState): CheckoutCountryLine[] {
  const cov = parseCovPlanId(planId);
  if (cov) {
    const out: CheckoutCountryLine[] = [];
    for (const code of cov.codesKey.split("-").filter(Boolean)) {
      const c = getCountryById(code);
      if (c) out.push({ code: c.code, nameKr: c.nameKr, flag: c.flag });
    }
    if (out.length > 0) return out;
  }

  const fromFunnel = funnel.countryIds
    .map((id) => getCountryById(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ code: c.code, nameKr: c.nameKr, flag: c.flag }));
  if (fromFunnel.length > 0) return fromFunnel;

  const esim = parseEsimPlanId(planId);
  if (esim) {
    const c = getCountryById(esim.code);
    if (c) return [{ code: c.code, nameKr: c.nameKr, flag: c.flag }];
  }

  const c = getCountryById(plan.countryId);
  return c ? [{ code: c.code, nameKr: c.nameKr, flag: c.flag }] : [];
}

/** 네트워크 요약: 커버리지 ID 또는 퍼널 확정값, 단일 타입 요금제만 표시. */
export function resolveCheckoutNetworkLabel(planId: string, plan: MockPlan, funnel: FunnelState): string | null {
  const cov = parseCovPlanId(planId);
  if (cov) {
    const net: NetworkType = cov.netTag === "rm" ? "roaming" : "local";
    return NET_KO[net];
  }
  if (funnel.network === "roaming" || funnel.network === "local") {
    return NET_KO[funnel.network];
  }
  const nt = plan.networkTypes;
  if (nt.length === 1) return NET_KO[nt[0]!];
  return null;
}

export function formatCheckoutDateDots(ymd: string | null): string {
  if (!ymd) return "";
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  return `${p[0]}.${p[1]}.${p[2]}`;
}

export type CheckoutTripSummaryView = {
  hasSchedule: boolean;
  startYmd: string | null;
  endYmd: string | null;
  days: number | null;
  nights: number | null;
  planValidityDays: number;
};

/** 결제 화면용 여행 일정 요약(퍼널 우선, 없으면 요금제 일수만). */
export function buildCheckoutTripSummary(funnel: FunnelState, plan: MockPlan): CheckoutTripSummaryView {
  const planValidityDays = plan.validityDays;
  const daysFromFunnel =
    funnel.tripStart && funnel.tripEnd ? funnelTripDayCount(funnel) : 0;
  const hasSchedule = daysFromFunnel >= 1;
  const nights =
    hasSchedule && funnel.tripDurationNights != null
      ? funnel.tripDurationNights
      : hasSchedule
        ? funnelTripNights(funnel)
        : null;
  const days = hasSchedule ? (funnel.tripDurationDays ?? daysFromFunnel) : null;
  return {
    hasSchedule,
    startYmd: funnel.tripStart,
    endYmd: funnel.tripEnd,
    days,
    nights,
    planValidityDays,
  };
}
