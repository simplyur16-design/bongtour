import type { BongsimPaymentSessionClientV1 } from "@/lib/bongsim/contracts/payment-session.v1";

export type SimplyurPortoneSessionClient = Extract<BongsimPaymentSessionClientV1, { kind: "portone_v2" }>;

/** Browser PortOne.requestPayment — dynamic import @portone/browser-sdk/v2 */
export async function requestSimplyurPortonePayment(client: SimplyurPortoneSessionClient): Promise<void> {
  const PortOne = await import("@portone/browser-sdk/v2");
  const response = await PortOne.requestPayment({
    storeId: client.store_id,
    channelKey: client.channel_key,
    paymentId: client.payment_id,
    orderName: client.order_name,
    totalAmount: client.total_amount_krw,
    currency: client.currency,
    payMethod: "CARD",
    customer: { email: client.customer_email },
    ...(client.is_test_channel ? { isTestChannel: true } : {}),
  });

  if (response && typeof response === "object" && "code" in response && response.code != null) {
    const message =
      "message" in response && typeof response.message === "string"
        ? response.message
        : "Payment was not completed.";
    throw new Error(message);
  }
}
