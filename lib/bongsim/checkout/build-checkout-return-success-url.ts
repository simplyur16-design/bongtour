import { bongsimPath } from "@/lib/bongsim/constants";

export function buildCheckoutReturnSuccessPath(params: {
  orderId: string;
  orderNumber?: string | null;
}): string {
  const q = new URLSearchParams();
  q.set("orderId", params.orderId.trim());
  const on = (params.orderNumber ?? "").trim();
  if (on) q.set("orderNumber", on);
  const readKey = process.env.BONGSIM_ORDER_READ_KEY?.trim();
  if (readKey) q.set("read_key", readKey);
  return `${bongsimPath(`/checkout/return/success?${q.toString()}`)}`;
}

/** PG·모바일 승인 후 `checkout/return/success` 리다이렉트 URL (read_key 포함). */
export function buildCheckoutReturnSuccessUrl(
  origin: string,
  params: { orderId: string; orderNumber?: string | null },
): string {
  return `${origin}${buildCheckoutReturnSuccessPath(params)}`;
}
