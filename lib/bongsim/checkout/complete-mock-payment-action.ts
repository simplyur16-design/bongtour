"use server";

import { redirect } from "next/navigation";
import { submitMockCapturePayment } from "@/lib/bongsim/checkout/mock-capture-server";
import { buildCheckoutReturnSuccessPath } from "@/lib/bongsim/checkout/build-checkout-return-success-url";
import { bongsimPath } from "@/lib/bongsim/constants";
import { isMockPaymentCaptureAllowed } from "@/lib/bongsim/runtime/mock-payment-allowance";
import { getPgPool } from "@/lib/bongsim/db/pool";

function parseSuccessUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const success = (raw as Record<string, unknown>).success_url;
  return typeof success === "string" && success.trim() ? success.trim() : null;
}

async function mockSuccessRedirect(paymentAttemptId: string, orderId: string): Promise<string> {
  const pool = getPgPool();
  if (pool) {
    try {
      const r = await pool.query<{ return_urls: unknown; order_number: string }>(
        `SELECT pa.return_urls, o.order_number
         FROM bongsim_payment_attempt pa
         JOIN bongsim_order o ON o.order_id = pa.order_id
         WHERE pa.payment_attempt_id = $1
         LIMIT 1`,
        [paymentAttemptId],
      );
      const stored = parseSuccessUrl(r.rows[0]?.return_urls);
      if (stored) {
        try {
          const u = new URL(stored, "http://local");
          if (!u.searchParams.get("orderId")) u.searchParams.set("orderId", orderId);
          const on = (r.rows[0]?.order_number ?? "").trim();
          if (on && !u.searchParams.get("orderNumber")) u.searchParams.set("orderNumber", on);
          if (stored.startsWith("http://") || stored.startsWith("https://")) {
            return u.toString();
          }
          return `${u.pathname}${u.search}`;
        } catch {
          return stored;
        }
      }
    } catch {
      /* fallback */
    }
  }
  return buildCheckoutReturnSuccessPath({ orderId });
}

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
  redirect(await mockSuccessRedirect(paymentAttemptId, res.order_id));
}
