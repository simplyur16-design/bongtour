/** USIMSA usage/daily · topup 응답 정규화 (server-only 없음 — vitest 가능) */

export type UsimsaDailyUsageHistoryRow = { date: string; usageMb: number };

export function pickFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeUsimsaDailyHistory(raw: unknown): UsimsaDailyUsageHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: UsimsaDailyUsageHistoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date.trim() : "";
    if (!date) continue;
    const usageMb =
      pickFiniteNumber(o.usageMb) ??
      pickFiniteNumber(o.usageMB) ??
      pickFiniteNumber(o.usage) ??
      0;
    out.push({ date, usageMb });
  }
  return out;
}

/** REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: daily·topup 사용량·활성화 파싱 — manifest */
/** REGRESSION-FREEZE[simplyur-eximbay-refund-inbound-usimsa]: install/register blocks refund — manifest */
export function parseUsimsaDailyUsagePayload(raw: unknown): {
  code: string;
  message: string;
  iccid: string | null;
  todayUsageMb: number;
  history: UsimsaDailyUsageHistoryRow[];
} {
  if (typeof raw !== "object" || raw === null) {
    return { code: "parse", message: "invalid_response", iccid: null, todayUsageMb: 0, history: [] };
  }
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "";
  const message = typeof o.message === "string" ? o.message : "";
  const usage = o.usage;
  let iccid: string | null = null;
  let history: UsimsaDailyUsageHistoryRow[] = [];
  let todayUsageMb = 0;
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    if (typeof u.iccid === "string" && u.iccid.trim()) iccid = u.iccid.trim();
    history = normalizeUsimsaDailyHistory(u.history);
    todayUsageMb = pickFiniteNumber(u.todayUsageMb) ?? pickFiniteNumber(u.todayUsageMB) ?? 0;
  }
  return { code, message, iccid, todayUsageMb, history };
}

const USIMSA_REGISTERED_STATUS_RE = /^(installed|registered|enabled|downloaded|activated)$/i;

function firstNonEmptyTime(t: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = t[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function usimsaTopupLooksRegistered(t: Record<string, unknown>): boolean {
  if (
    firstNonEmptyTime(t, [
      "installTime",
      "installedTime",
      "installedAt",
      "downloadTime",
      "registerTime",
      "registeredTime",
      "lastEnabledTime",
    ])
  ) {
    return true;
  }
  const status =
    (typeof t.status === "string" ? t.status : "") ||
    (typeof t.profileStatus === "string" ? t.profileStatus : "");
  return USIMSA_REGISTERED_STATUS_RE.test(status.trim());
}

/** REGRESSION-FREEZE[simplyur-eximbay-refund-inbound-usimsa]: installTime/register → registered — manifest */
export function parseUsimsaTopupPayload(raw: unknown): {
  code: string;
  message: string;
  iccid: string | null;
  activeTime: string | null;
  registered: boolean;
  topupUsageMb: number;
} {
  if (typeof raw !== "object" || raw === null) {
    return {
      code: "parse",
      message: "invalid_response",
      iccid: null,
      activeTime: null,
      registered: false,
      topupUsageMb: 0,
    };
  }
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "";
  const message = typeof o.message === "string" ? o.message : "";
  const topup = o.topup;
  if (!topup || typeof topup !== "object") {
    return { code, message, iccid: null, activeTime: null, registered: false, topupUsageMb: 0 };
  }
  const t = topup as Record<string, unknown>;
  const iccid = typeof t.iccid === "string" && t.iccid.trim() ? t.iccid.trim() : null;
  const activeRaw = typeof t.activeTime === "string" ? t.activeTime.trim() : "";
  const activeTime = activeRaw ? activeRaw : null;
  const topupUsageMb = pickFiniteNumber(t.usage) ?? 0;
  const registered = Boolean(activeTime) || usimsaTopupLooksRegistered(t);
  return { code, message, iccid, activeTime, registered, topupUsageMb };
}

export function combineUsimsaUsedMb(input: {
  history: UsimsaDailyUsageHistoryRow[];
  todayUsageMb: number;
  topupUsageMb: number;
}): number {
  const histSum = input.history.reduce(
    (s, h) => s + (Number.isFinite(h.usageMb) ? h.usageMb : 0),
    0,
  );
  const fromDaily = histSum + (Number.isFinite(input.todayUsageMb) ? input.todayUsageMb : 0);
  const fromTopup = Number.isFinite(input.topupUsageMb) ? input.topupUsageMb : 0;
  return Math.max(fromDaily, fromTopup);
}

export function formatUsimsaUsageAdminLabel(input: {
  unused: boolean;
  activated: boolean;
  totalUsedMb: number;
  topupCount: number;
}): string {
  if (input.topupCount === 0) return "발급 전·미사용";
  if (input.unused) return "미사용";
  if (input.totalUsedMb > 0.01) return `사용 ${input.totalUsedMb.toFixed(1)}MB`;
  if (input.activated) return "활성화됨";
  return "사용";
}
