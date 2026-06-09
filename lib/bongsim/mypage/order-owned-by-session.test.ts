import { describe, expect, it } from "vitest";
import { bongsimBuyerSessionIdentity } from "@/lib/bongsim/mypage/order-owned-by-session";

describe("bongsimBuyerSessionIdentity", () => {
  it("normalizes email and user id", () => {
    expect(
      bongsimBuyerSessionIdentity({
        user: { email: "  User@Example.COM ", id: "  uid-1  " },
      }),
    ).toEqual({ email: "user@example.com", userId: "uid-1" });
  });

  it("empty session", () => {
    expect(bongsimBuyerSessionIdentity(null)).toEqual({ email: "", userId: "" });
  });
});
