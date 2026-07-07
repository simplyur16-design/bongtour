import { describe, expect, it } from "vitest";
import { buildSimplyurPortonePaymentId } from "@/lib/simplyur/payments/portone-payment-id";
import { isPortonePaidStatus } from "@/lib/simplyur/payments/portone-api";
import { SIMPLYUR_PORTONE_PROVIDER_ID } from "@/lib/simplyur/payments/providers/portone-payments";

describe("simplyur portone checkout", () => {
  it("paymentId from order + attempt", () => {
    const id = buildSimplyurPortonePaymentId("SU-20260408-001", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(id.startsWith("su-SU-20260408-001-")).toBe(true);
    expect(id.length).toBeLessThan(80);
  });

  it("provider id", () => {
    expect(SIMPLYUR_PORTONE_PROVIDER_ID).toBe("portone");
  });

  it("PAID status", () => {
    expect(isPortonePaidStatus("PAID")).toBe(true);
    expect(isPortonePaidStatus("READY")).toBe(false);
  });
});
