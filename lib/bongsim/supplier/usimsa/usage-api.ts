import { usimsaRequest } from "@/lib/usimsa/client";

export type UsimsaDailyUsageHistoryRow = { date: string; usageMb: number };

export type UsimsaDailyUsageNormalized = {
  code: string;
  message: string;
  iccid: string | null;
  history: UsimsaDailyUsageHistoryRow[];
};

function pickNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeHistory(raw: unknown): UsimsaDailyUsageHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: UsimsaDailyUsageHistoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date.trim() : "";
    if (!date) continue;
    const usageMb = pickNum(o.usageMb) ?? pickNum(o.usageMB) ?? 0;
    out.push({ date, usageMb });
  }
  return out;
}

/** GET /v2/topup/:topupId/usage/daily — 응답 필드 변형 허용 */
export async function fetchUsimsaTopupDailyUsage(topupId: string): Promise<UsimsaDailyUsageNormalized> {
  const raw = await usimsaRequest<unknown>({
    method: "GET",
    path: `/v2/topup/${encodeURIComponent(topupId)}/usage/daily`,
  });
  if (typeof raw !== "object" || raw === null) {
    return { code: "parse", message: "invalid_response", iccid: null, history: [] };
  }
  const o = raw as Record<string, unknown>;
  const code = typeof o.code === "string" ? o.code : "";
  const message = typeof o.message === "string" ? o.message : "";
  const usage = o.usage;
  let iccid: string | null = null;
  let history: UsimsaDailyUsageHistoryRow[] = [];
  if (usage && typeof usage === "object") {
    const u = usage as Record<string, unknown>;
    if (typeof u.iccid === "string" && u.iccid.trim()) iccid = u.iccid.trim();
    history = normalizeHistory(u.history);
  }
  return { code, message, iccid, history };
}
