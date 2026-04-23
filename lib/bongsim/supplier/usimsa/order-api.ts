import { usimsaRequest } from "@/lib/usimsa/client";
import type {
  UsimsaSubmitRequest,
  UsimsaSubmitResponse,
  UsimsaOrderQueryResponse,
  UsimsaCancelResponse,
} from "@/lib/bongsim/supplier/usimsa/types";

export async function submitUsimsaOrder(
  body: UsimsaSubmitRequest,
): Promise<UsimsaSubmitResponse> {
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
