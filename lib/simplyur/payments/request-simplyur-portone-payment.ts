import type { BongsimPaymentSessionClientV1 } from "@/lib/bongsim/contracts/payment-session.v1";

export type SimplyurPortoneSessionClient = Extract<BongsimPaymentSessionClientV1, { kind: "portone_v2" }>;

export type SimplyurPortonePaymentCallbacks = {
  onSuccess: () => void | Promise<void>;
  onFail: (message: string) => void;
};

function portoneSdkError(response: unknown): string | null {
  if (response && typeof response === "object" && "code" in response && response.code != null) {
    return "message" in response && typeof response.message === "string"
      ? response.message
      : "Payment was not completed.";
  }
  return null;
}

/** KICC overseas — WeChat Pay or Alipay Plus via PortOne.requestPayment */
export async function requestSimplyurPortoneKiccPayment(
  client: SimplyurPortoneSessionClient,
): Promise<void> {
  const PortOne = await import("@portone/browser-sdk/v2");

  const base = {
    storeId: client.store_id,
    channelKey: client.channel_key,
    paymentId: client.payment_id,
    orderName: client.order_name,
    totalAmount: client.total_amount_minor,
    currency: client.charge_currency,
    customer: { email: client.customer_email },
    ...(client.is_test_channel ? { isTestChannel: true } : {}),
    ...(client.notice_url ? { noticeUrls: [client.notice_url] } : {}),
  };

  let response: unknown;
  if (client.portone_method === "kicc_wechat") {
    response = await PortOne.requestPayment({
      ...base,
      payMethod: "EASY_PAY",
      easyPay: { easyPayProvider: "WECHAT" },
    });
  } else if (client.portone_method === "kicc_alipay_plus") {
    response = await PortOne.requestPayment({
      ...base,
      payMethod: "ALIPAY_PLUS",
      alipayPlus: { easyPayProvider: "ALIPAY" },
    });
  } else {
    throw new Error("unexpected_kicc_method");
  }

  const err = portoneSdkError(response);
  if (err) throw new Error(err);
}

/**
 * PayPal SPB — renders button into `.portone-ui-container` via loadPaymentUI.
 * REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PayPal loadPaymentUI — manifest
 */
export async function loadSimplyurPortonePayPalUi(
  client: SimplyurPortoneSessionClient,
  callbacks: SimplyurPortonePaymentCallbacks,
): Promise<void> {
  if (client.portone_method !== "paypal") {
    throw new Error("expected_paypal_method");
  }

  const PortOne = await import("@portone/browser-sdk/v2");

  const requestData = {
    uiType: "PAYPAL_SPB" as const,
    storeId: client.store_id,
    channelKey: client.channel_key,
    paymentId: client.payment_id,
    orderName: client.order_name,
    totalAmount: client.total_amount_minor,
    currency: client.charge_currency,
    ...(client.is_test_channel ? { isTestChannel: true } : {}),
    ...(client.notice_url ? { noticeUrls: [client.notice_url] } : {}),
  };

  await PortOne.loadPaymentUI(requestData, {
    onPaymentSuccess: () => {
      void callbacks.onSuccess();
    },
    onPaymentFail: (error) => {
      const msg =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
          ? error.message
          : "PayPal payment was not completed.";
      callbacks.onFail(msg);
    },
  });
}

/** Dispatch PayPal UI or KICC requestPayment based on session method. */
export async function runSimplyurPortoneCheckout(
  client: SimplyurPortoneSessionClient,
  paypalCallbacks?: SimplyurPortonePaymentCallbacks,
): Promise<void> {
  if (client.portone_method === "paypal") {
    if (!paypalCallbacks) throw new Error("paypal_callbacks_required");
    await loadSimplyurPortonePayPalUi(client, paypalCallbacks);
    return;
  }
  await requestSimplyurPortoneKiccPayment(client);
}
