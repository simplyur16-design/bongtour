import { bongsimPath } from "@/lib/bongsim/constants";

/** 결제 실패·취소 후 체크아웃 복귀 — `orderId`로 상품·수량 복원 */
export function buildCheckoutRetryHref(input: {
  orderId?: string;
  optionApiId?: string;
  quantity?: number;
}): string {
  const orderId = input.orderId?.trim();
  if (orderId) {
    const q = new URLSearchParams({ orderId });
    return `${bongsimPath("/checkout")}?${q.toString()}`;
  }
  const optionApiId = input.optionApiId?.trim();
  if (optionApiId) {
    const q = new URLSearchParams({ optionApiId });
    const qty = input.quantity;
    if (qty != null && Number.isFinite(qty) && qty >= 1 && qty <= 99) {
      q.set("qty", String(Math.trunc(qty)));
    }
    return `${bongsimPath("/checkout")}?${q.toString()}`;
  }
  return bongsimPath("/checkout");
}
