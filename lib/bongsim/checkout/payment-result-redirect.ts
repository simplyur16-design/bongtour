import { bongsimPath } from "@/lib/bongsim/constants";

/**
 * 결제 결과 전용 페이지(`/checkout/payment/result`)로 리다이렉트할 절대 URL.
 * `URLSearchParams`로 쿼리를 만들어 한글 `message` 등이 UTF-8로 올바르게 인코딩된다.
 */
export function buildCheckoutPaymentResultRedirectUrl(
  origin: string,
  input: { status: "fail" | "cancel" | "success"; orderId: string; message?: string },
): string {
  const q = new URLSearchParams();
  q.set("status", input.status);
  if (input.orderId.trim()) q.set("orderId", input.orderId.trim());
  const msg = input.message?.trim();
  if (msg) q.set("message", msg);
  return `${origin}${bongsimPath(`/checkout/payment/result?${q.toString()}`)}`;
}
