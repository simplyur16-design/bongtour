"use server";

import { redirect } from "next/navigation";
import { submitMockCapturePayment } from "@/lib/bongsim/checkout/mock-capture-server";
import { buildCheckoutReturnSuccessPath } from "@/lib/bongsim/checkout/build-checkout-return-success-url";
import { bongsimPath } from "@/lib/bongsim/constants";
import { isMockPaymentCaptureAllowed } from "@/lib/bongsim/runtime/mock-payment-allowance";

export async function completeMockPaymentForm(formData: FormData) {
  const paymentAttemptId = String(formData.get("paymentAttemptId") ?? "").trim();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!isMockPaymentCaptureAllowed()) {
    redirect(
      `${bongsimPath("/checkout/return/fail")}?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent("disabled")}`,
    );
  }
  const res = await submitMockCapturePayment(paymentAttemptId);
  if (!res.ok) {
    redirect(
      `${bongsimPath("/checkout/return/fail")}?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(res.error)}`,
    );
  }
  redirect(buildCheckoutReturnSuccessPath({ orderId: res.order_id }));
}
