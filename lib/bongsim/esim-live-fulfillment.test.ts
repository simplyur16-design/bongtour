import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const usimsaRequest = vi.fn();
vi.mock("@/lib/usimsa/client", () => ({
  usimsaRequest: (...args: unknown[]) => usimsaRequest(...args),
}));

const solapiSend = vi.fn();
vi.mock("solapi", () => ({
  SolapiMessageService: vi.fn().mockImplementation(() => ({
    send: solapiSend,
    sendOne: solapiSend,
  })),
}));

import { isEsimLiveIssuanceAndSmsAllowed } from "@/lib/bongsim/esim-live-fulfillment";
import { sendEsimQrDeliveredAlimTalk } from "@/lib/bongsim/notifications/esim-qr-alimtalk";
import { submitUsimsaOrder } from "@/lib/bongsim/supplier/usimsa/order-api";
import { sendEsimQrDeliveredLmsFallback } from "@/lib/notification-service";

const ENV_KEYS = [
  "NODE_ENV",
  "WELCOMEPAY_ENV",
  "USIMSA_ENV",
  "BONGSIM_CHECKOUT_TEST_MODE",
  "SOLAPI_API_KEY",
  "SOLAPI_API_SECRET",
  "SOLAPI_FROM_PHONE",
  "SOLAPI_PFID",
  "SOLAPI_TPL_ESIM_QR_DELIVERED",
] as const;

describe("eSIM sandbox cannot issue or send SMS", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
    usimsaRequest.mockReset();
    solapiSend.mockReset();
  });

  function rememberEnv() {
    for (const key of ENV_KEYS) prev[key] = process.env[key];
  }

  function liveEnv() {
    rememberEnv();
    process.env.NODE_ENV = "production";
    process.env.WELCOMEPAY_ENV = "production";
    process.env.USIMSA_ENV = "production";
    delete process.env.BONGSIM_CHECKOUT_TEST_MODE;
  }

  it("allows live fulfillment only outside test and sandbox", () => {
    liveEnv();
    expect(isEsimLiveIssuanceAndSmsAllowed()).toBe(true);
    process.env.WELCOMEPAY_ENV = "test";
    expect(isEsimLiveIssuanceAndSmsAllowed()).toBe(false);
    process.env.WELCOMEPAY_ENV = "production";
    process.env.USIMSA_ENV = "development";
    expect(isEsimLiveIssuanceAndSmsAllowed()).toBe(false);
    process.env.USIMSA_ENV = "production";
    process.env.BONGSIM_CHECKOUT_TEST_MODE = "true";
    expect(isEsimLiveIssuanceAndSmsAllowed()).toBe(false);
  });

  it("does not call USIMSA when WelcomePay is sandbox", async () => {
    liveEnv();
    process.env.WELCOMEPAY_ENV = "test";
    const res = await submitUsimsaOrder({ orderId: "BT-1", products: [{ optionId: "opt", qty: 1 }] });
    expect(res).toEqual({ ok: true, skipped: "test_mode" });
    expect(usimsaRequest).not.toHaveBeenCalled();
  });

  it("does not call Solapi SMS or alimtalk in sandbox", async () => {
    liveEnv();
    process.env.WELCOMEPAY_ENV = "sandbox";
    process.env.SOLAPI_API_KEY = "key";
    process.env.SOLAPI_API_SECRET = "secret";
    process.env.SOLAPI_FROM_PHONE = "0212345678";
    process.env.SOLAPI_PFID = "pf";
    process.env.SOLAPI_TPL_ESIM_QR_DELIVERED = "tpl";
    const lms = await sendEsimQrDeliveredLmsFallback({
      orderId: "order-1",
      customerPhone: "01012345678",
      orderNumber: "BT-1",
      orderPageUrl: "https://bongtour.com/travel/esim/order/x/complete",
    });
    expect(lms.ok).toBe(true);
    const alim = await sendEsimQrDeliveredAlimTalk("order-1", {
      customerPhone: "01012345678",
      orderNumber: "BT-1",
      orderPageUrl: "https://bongtour.com/travel/esim/order/x/complete",
    });
    expect(alim.ok).toBe(true);
    expect(solapiSend).not.toHaveBeenCalled();
  });
});
