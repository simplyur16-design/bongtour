import { bongsimPath } from "@/lib/bongsim/constants";

// REGRESSION-FREEZE[bongsim-simplyur-payment-channel-gate]: WelcomePay result → bongsimPath only — manifest

/**
 * 결제 결과 전용 페이지(`/checkout/payment/result`)로 리다이렉트할 절대 URL.
 * `URLSearchParams`로 쿼리를 만들어 한글 `message` 등이 UTF-8로 올바르게 인코딩된다.
 */
export type CheckoutPaymentResultStatus = "fail" | "cancel" | "success" | "vbank_pending";

export function buildCheckoutPaymentResultRedirectUrl(
  origin: string,
  input: {
    status: CheckoutPaymentResultStatus;
    orderId: string;
    message?: string;
    pgCode?: string;
    orderNumber?: string;
    amount?: string;
    vbankAccount?: string;
    vbankBank?: string;
    vbankHolder?: string;
    vbankDue?: string;
  },
): string {
  const q = new URLSearchParams();
  q.set("status", input.status);
  if (input.orderId.trim()) q.set("orderId", input.orderId.trim());
  const on = input.orderNumber?.trim();
  if (on) q.set("orderNumber", on);
  const msg = input.message?.trim();
  if (msg) q.set("message", msg);
  const pgCode = input.pgCode?.trim();
  if (pgCode) q.set("pgCode", pgCode);
  const amount = input.amount?.trim();
  if (amount) q.set("amount", amount);
  const vbankAccount = input.vbankAccount?.trim();
  if (vbankAccount) q.set("vbankAccount", vbankAccount);
  const vbankBank = input.vbankBank?.trim();
  if (vbankBank) q.set("vbankBank", vbankBank);
  const vbankHolder = input.vbankHolder?.trim();
  if (vbankHolder) q.set("vbankHolder", vbankHolder);
  const vbankDue = input.vbankDue?.trim();
  if (vbankDue) q.set("vbankDue", vbankDue);
  return `${origin}${bongsimPath(`/checkout/payment/result?${q.toString()}`)}`;
}
