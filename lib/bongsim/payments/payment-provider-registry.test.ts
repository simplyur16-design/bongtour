import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS,
  getPaymentProviderAdapter,
} from "@/lib/bongsim/payments/payment-provider-registry";

describe("payment provider registry (PortOne removed 2026-10-30)", () => {
  it("keeps welcomepay and eximbay adapters", () => {
    expect(getPaymentProviderAdapter("welcomepay")).not.toBeNull();
    expect(getPaymentProviderAdapter("eximbay")).not.toBeNull();
  });

  it("no longer resolves a portone adapter (session → provider_not_supported)", () => {
    expect(getPaymentProviderAdapter("portone")).toBeNull();
    expect((BONGSIM_KNOWN_PAYMENT_PROVIDER_IDS as readonly string[]).includes("portone")).toBe(false);
  });
});
