import { usimsaRequest } from "@/lib/usimsa/client";
import { getUsimsaConfigWithProductionHost } from "@/lib/usimsa/config";
import type {
  UsimsaSubmitRequest,
  UsimsaSubmitResponse,
  UsimsaOrderQueryResponse,
  UsimsaCancelResponse,
  UsimsaUsimOrderRequest,
  UsimsaUsimOrderResponse,
} from "@/lib/bongsim/supplier/usimsa/types";
import {
  isUsimsaCancelSuccess,
  USIMSA_CANCEL_CODE,
} from "@/lib/bongsim/supplier/usimsa/types";
import { isBongsimCheckoutTestMode } from "@/lib/bongsim/test-mode";

export type SubmitUsimsaOrderResult =
  | UsimsaSubmitResponse
  | { ok: true; skipped: "test_mode" };

export type SubmitUsimsaUsimOrderResult =
  | UsimsaUsimOrderResponse
  | { ok: true; skipped: "test_mode"; topupId: string };

export class UsimsaCancelError extends Error {
  readonly topupId: string;
  readonly code: string;

  constructor(topupId: string, code: string, message: string) {
    super(`USIMSA cancel rejected topupId=${topupId} code=${code} message=${message}`);
    this.name = "UsimsaCancelError";
    this.topupId = topupId;
    this.code = code;
  }
}

export async function submitUsimsaOrder(
  body: UsimsaSubmitRequest,
): Promise<SubmitUsimsaOrderResult> {
  if (isBongsimCheckoutTestMode()) {
    console.log("[BONGSIM_TEST_MODE] USIMSA 발급 스킵 - orderId:", body.orderId);
    return { ok: true, skipped: "test_mode" as const };
  }
  return usimsaRequest<UsimsaSubmitResponse>({
    method: "POST",
    path: "/v2/order",
    body,
  });
}

/** POST /v2/order/usim — 물리 USIM(ICCID)에 플랜 활성화. REGRESSION-FREEZE[bongsim-usim-fulfillment] */
export async function submitUsimsaUsimOrder(
  body: UsimsaUsimOrderRequest,
): Promise<SubmitUsimsaUsimOrderResult> {
  if (isBongsimCheckoutTestMode()) {
    console.log("[BONGSIM_TEST_MODE] USIMSA USIM 발급 스킵 - orderId:", body.orderId, "iccid:", body.iccid);
    return {
      ok: true,
      skipped: "test_mode" as const,
      topupId: `test_mode_usim_${body.orderId}_${body.iccid.slice(-6)}`,
    };
  }
  return usimsaRequest<UsimsaUsimOrderResponse>({
    method: "POST",
    path: "/v2/order/usim",
    body,
  });
}

export async function queryUsimsaOrder(
  orderId: string,
): Promise<UsimsaOrderQueryResponse> {
  return usimsaRequest<UsimsaOrderQueryResponse>({
    method: "GET",
    path: `/v2/order/${encodeURIComponent(orderId)}`,
  });
}

/**
 * POST https://open-api.usimsa.com/api/v2/cancel/{topupId}
 * `topupId` = `bongsim_fulfillment_topup.topup_id`
 */
export async function cancelUsimsaTopup(topupId: string): Promise<UsimsaCancelResponse> {
  const id = topupId.trim();
  if (!id) {
    throw new UsimsaCancelError(topupId, "CLIENT", "empty topupId");
  }

  const res = await usimsaRequest<UsimsaCancelResponse>({
    method: "POST",
    path: `/v2/cancel/${encodeURIComponent(id)}`,
    config: getUsimsaConfigWithProductionHost(),
  });

  const code = String(res?.code ?? "").trim();
  const message = String(res?.message ?? "").trim();

  if (isUsimsaCancelSuccess(code)) {
    if (code === USIMSA_CANCEL_CODE.ALREADY_CANCELED) {
      console.info("[usimsa:cancel] already_canceled", { topupId: id, code, message });
    }
    return res;
  }

  console.error("[usimsa:cancel] failed", { topupId: id, code: code || "(empty)", message });
  throw new UsimsaCancelError(id, code || "UNKNOWN", message || "cancel rejected");
}

/** POST /v2/cancel/usim/{topupId} */
export async function cancelUsimsaUsimTopup(topupId: string): Promise<UsimsaCancelResponse> {
  const id = topupId.trim();
  if (!id) {
    throw new UsimsaCancelError(topupId, "CLIENT", "empty topupId");
  }

  const res = await usimsaRequest<UsimsaCancelResponse>({
    method: "POST",
    path: `/v2/cancel/usim/${encodeURIComponent(id)}`,
    config: getUsimsaConfigWithProductionHost(),
  });

  const code = String(res?.code ?? "").trim();
  const message = String(res?.message ?? "").trim();

  if (isUsimsaCancelSuccess(code)) {
    if (code === USIMSA_CANCEL_CODE.ALREADY_CANCELED) {
      console.info("[usimsa:cancel:usim] already_canceled", { topupId: id, code, message });
    }
    return res;
  }

  console.error("[usimsa:cancel:usim] failed", { topupId: id, code: code || "(empty)", message });
  throw new UsimsaCancelError(id, code || "UNKNOWN", message || "cancel rejected");
}
