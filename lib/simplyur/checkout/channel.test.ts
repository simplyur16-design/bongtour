import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/simplyur/auth/mobile-access-token", () => ({
  readBearerToken: (req: Request) => {
    const h = req.headers.get("authorization") ?? "";
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m?.[1]?.trim() || "";
  },
}));

import {
  resolveSimplyurCheckoutChannel,
  simplyurBuyerLocaleForOrder,
} from "@/lib/simplyur/checkout/channel";

describe("simplyur checkout channel / buyer locale", () => {
  it("maps Bearer mobile session to simplyur_app", () => {
    const req = new Request("https://example.com/api/simplyur/checkout/confirm", {
      method: "POST",
      headers: { Authorization: "Bearer mobile.jwt.token" },
    });
    expect(resolveSimplyurCheckoutChannel({ req, bodyChannel: "simplyur_web" })).toBe(
      "simplyur_app",
    );
  });

  it("defaults cookie/web clients to simplyur_web", () => {
    const req = new Request("https://example.com/api/simplyur/checkout/confirm", {
      method: "POST",
    });
    expect(resolveSimplyurCheckoutChannel({ req })).toBe("simplyur_web");
  });

  it("honors explicit simplyur_app body when no Bearer", () => {
    const req = new Request("https://example.com/api/simplyur/checkout/confirm", {
      method: "POST",
    });
    expect(resolveSimplyurCheckoutChannel({ req, bodyChannel: "simplyur_app" })).toBe(
      "simplyur_app",
    );
  });

  it("keeps buyer_locale as en for simplyur orders", () => {
    expect(simplyurBuyerLocaleForOrder()).toBe("en");
  });
});
