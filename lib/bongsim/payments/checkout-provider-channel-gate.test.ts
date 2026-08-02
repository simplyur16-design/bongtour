import { describe, expect, it } from "vitest";
import { buildPaymentProviderCreateInput } from "@/lib/bongsim/payments/build-payment-provider-create-input";
import { assertCheckoutProviderAllowed } from "@/lib/bongsim/payments/checkout-provider-channel-gate";
import type { BongsimPaymentSessionRequestV1 } from "@/lib/bongsim/contracts/payment-session.v1";

// REGRESSION-FREEZE[bongsim-simplyur-payment-channel-gate]: channel×PG vitest — manifest

const urls = {
  success_url: "/ok",
  fail_url: "/fail",
  cancel_url: "/cancel",
};

function sessionReq(
  patch: Partial<BongsimPaymentSessionRequestV1> = {},
): BongsimPaymentSessionRequestV1 {
  return {
    schema: "bongsim.payment_session.request.v1",
    order_id: "o1",
    idempotency_key: "k1",
    provider: "eximbay",
    return_urls: urls,
    ...patch,
  };
}

describe("assertCheckoutProviderAllowed", () => {
  it("rejects welcomepay on simplyur channel", () => {
    const r = assertCheckoutProviderAllowed("welcomepay", "simplyur_web");
    expect(r).toEqual({ ok: false, providerDetail: "welcomepay_not_for_simplyur" });
  });

  it("rejects eximbay on non-simplyur channel", () => {
    const r = assertCheckoutProviderAllowed("eximbay", "web");
    expect(r).toEqual({ ok: false, providerDetail: "eximbay_simplyur_orders_only" });
  });

  it("rejects portone on non-simplyur channel", () => {
    const r = assertCheckoutProviderAllowed("portone", "web");
    expect(r).toEqual({ ok: false, providerDetail: "portone_simplyur_orders_only" });
  });

  it("allows welcomepay on domestic channel", () => {
    expect(assertCheckoutProviderAllowed("welcomepay", "web")).toEqual({ ok: true });
  });

  it("allows eximbay on simplyur channel", () => {
    expect(assertCheckoutProviderAllowed("eximbay", "simplyur_web")).toEqual({ ok: true });
  });

  it("allows portone on simplyur_app", () => {
    expect(assertCheckoutProviderAllowed("portone", "simplyur_app")).toEqual({ ok: true });
  });
});

describe("buildPaymentProviderCreateInput", () => {
  it("includes simplyur_locale and eximbay_ostype for race/happy parity", () => {
    const input = buildPaymentProviderCreateInput({
      provider: "eximbay",
      payment_attempt_id: "pa1",
      order_id: "o1",
      order_number: "ON1",
      buyer_email: "a@b.com",
      amount_krw: 15000,
      return_urls: urls,
      req: sessionReq({
        simplyur_locale: "ja",
        eximbay_ostype: "P",
        simplyur_portone_method: "paypal",
      }),
    });
    expect(input.simplyur_locale).toBe("ja");
    expect(input.eximbay_ostype).toBe("P");
    expect(input.simplyur_portone).toEqual({ method: "paypal", locale: "ja" });
  });
});
