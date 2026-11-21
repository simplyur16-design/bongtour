/**
 * Simplyur My eSIM — which usage number is measured against which cap.
 *
 * Root cause of "2.9 GB / 2.0 GB" (1.0.2): for DAILY plans the order line
 * `allowance_label` ("2GB") is the per-day allowance, but the usage route summed
 * every day of `usage/daily` history and showed it against that per-day cap.
 * Daily plans must compare TODAY's usage with the per-day cap; fixed plans compare
 * the cumulative total with the whole-trip cap.
 *
 * Pure (no server-only imports) so vitest can cover it.
 */
import { parseAllowanceLabel } from "@/lib/bongsim/mypage-esim-display";

export type SimplyurCapScope = "daily" | "total" | "none";

export type SimplyurUsageHistoryRow = { date: string; usageMb: number };

export type SimplyurLinePlanInfo = {
  allowance_label?: string | null;
  plan_type?: string | null;
  network_family?: string | null;
  option_label?: string | null;
  plan_line_excel?: string | null;
};

export type SimplyurUsageScope = {
  unlimited: boolean;
  cap_scope: SimplyurCapScope;
  /** Daily plans: per-day cap. Fixed plans: whole-plan cap. null when unknown/unlimited. */
  cap_mb: number | null;
  /** Usage counted against `cap_mb` (today for daily plans, cumulative otherwise). */
  used_mb: number;
  today_used_mb: number;
  cumulative_used_mb: number;
};

function finiteMb(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** yyyymmdd digits of a supplier date ("2026-11-21", "20261121", "2026-11-21T00:00:00+09:00"). */
export function usageDateKey(date: string): string {
  const digits = String(date ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(0, 8) : "";
}

/** Today's keys in Korea time (where the eSIM is used) and UTC (supplier fallback). */
export function todayUsageDateKeys(now: Date = new Date()): string[] {
  const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  const utc = now.toISOString().slice(0, 10).replace(/-/g, "");
  return kst === utc ? [kst] : [kst, utc];
}

/**
 * Same rule as the storefront (`lib/simplyur/plan-display.ts` resolveDataCategory):
 * a capped plan is a per-day allowance unless the catalog marks it `fixed`.
 * (`unlimited` rows with a GB label are "N GB a day, then slower" plans.)
 */
export function isDailyCapPlan(line: SimplyurLinePlanInfo): boolean {
  const pt = (line.plan_type ?? "").trim().toLowerCase();
  if (pt === "fixed") return false;
  if (!pt && (line.plan_line_excel ?? "").trim() === "종량제") return false;
  return true;
}

export function resolveSimplyurUsageScope(input: {
  line: SimplyurLinePlanInfo;
  history: SimplyurUsageHistoryRow[];
  supplierTodayUsageMb?: number | null;
  now?: Date;
}): SimplyurUsageScope {
  const allowance = parseAllowanceLabel(input.line.allowance_label ?? "");
  const keys = todayUsageDateKeys(input.now);
  const todayRow = input.history.find((h) => keys.includes(usageDateKey(h.date)));
  const historySum = input.history.reduce((s, h) => s + finiteMb(h.usageMb), 0);
  const supplierToday = finiteMb(input.supplierTodayUsageMb);
  const todayUsedMb = Math.max(todayRow ? finiteMb(todayRow.usageMb) : 0, supplierToday);
  // History may or may not contain today's row; never count today twice.
  const cumulativeUsedMb = todayRow
    ? historySum - finiteMb(todayRow.usageMb) + todayUsedMb
    : historySum + supplierToday;

  if (allowance.unlimited) {
    return {
      unlimited: true,
      cap_scope: "none",
      cap_mb: null,
      used_mb: todayUsedMb,
      today_used_mb: todayUsedMb,
      cumulative_used_mb: cumulativeUsedMb,
    };
  }
  const capMb = allowance.capMb != null && allowance.capMb > 0 ? allowance.capMb : null;
  if (capMb == null) {
    return {
      unlimited: false,
      cap_scope: "none",
      cap_mb: null,
      used_mb: cumulativeUsedMb,
      today_used_mb: todayUsedMb,
      cumulative_used_mb: cumulativeUsedMb,
    };
  }
  if (isDailyCapPlan(input.line)) {
    return {
      unlimited: false,
      cap_scope: "daily",
      cap_mb: capMb,
      used_mb: todayUsedMb,
      today_used_mb: todayUsedMb,
      cumulative_used_mb: cumulativeUsedMb,
    };
  }
  return {
    unlimited: false,
    cap_scope: "total",
    cap_mb: capMb,
    used_mb: cumulativeUsedMb,
    today_used_mb: todayUsedMb,
    cumulative_used_mb: cumulativeUsedMb,
  };
}
