import { usimsaRequest } from "@/lib/usimsa/client";
import {
  parseUsimsaDailyUsagePayload,
  parseUsimsaTopupPayload,
  type UsimsaDailyUsageHistoryRow,
} from "@/lib/bongsim/supplier/usimsa/usage-normalize";

export type { UsimsaDailyUsageHistoryRow };

export type UsimsaDailyUsageNormalized = {
  code: string;
  message: string;
  iccid: string | null;
  history: UsimsaDailyUsageHistoryRow[];
  todayUsageMb: number;
};

export type UsimsaTopupStatusNormalized = {
  code: string;
  message: string;
  iccid: string | null;
  activeTime: string | null;
  topupUsageMb: number;
};

/** GET /v2/topup/:topupId/usage/daily — 응답 필드 변형 허용 */
export async function fetchUsimsaTopupDailyUsage(topupId: string): Promise<UsimsaDailyUsageNormalized> {
  const raw = await usimsaRequest<unknown>({
    method: "GET",
    path: `/v2/topup/${encodeURIComponent(topupId)}/usage/daily`,
  });
  return parseUsimsaDailyUsagePayload(raw);
}

/** GET /v2/topup/:topupId — activeTime·누적 usage */
export async function fetchUsimsaTopupStatus(topupId: string): Promise<UsimsaTopupStatusNormalized> {
  const raw = await usimsaRequest<unknown>({
    method: "GET",
    path: `/v2/topup/${encodeURIComponent(topupId)}`,
  });
  return parseUsimsaTopupPayload(raw);
}
