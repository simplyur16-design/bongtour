import { usimsaRequest } from "@/lib/usimsa/client";
import type {
  UsimsaSubmitRequest,
  UsimsaSubmitResponse,
  UsimsaOrderQueryResponse,
  UsimsaCancelResponse,
} from "@/lib/bongsim/supplier/usimsa/types";
import { isBongsimCheckoutTestMode } from "@/lib/bongsim/test-mode";

export type SubmitUsimsaOrderResult =
  | UsimsaSubmitResponse
  | { ok: true; skipped: "test_mode" };

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

export async function queryUsimsaOrder(
  orderId: string,
): Promise<UsimsaOrderQueryResponse> {
  return usimsaRequest<UsimsaOrderQueryResponse>({
    method: "GET",
    path: `/v2/order/${encodeURIComponent(orderId)}`,
  });
}

export async function cancelUsimsaTopup(
  topupId: string,
  kind: "esim" | "usim" = "esim",
): Promise<UsimsaCancelResponse> {
  const path = kind === "usim"
    ? `/v2/cancel/usim/${encodeURIComponent(topupId)}`
    : `/v2/cancel/${encodeURIComponent(topupId)}`;
  return usimsaRequest<UsimsaCancelResponse>({
    method: "POST",
    path,
  });
}
