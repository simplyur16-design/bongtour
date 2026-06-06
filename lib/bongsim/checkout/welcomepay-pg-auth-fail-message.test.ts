import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isWelcomepayAuthSuccessCode,
  welcomepayPgAuthFailMessage,
} from "@/lib/bongsim/checkout/welcomepay-fail-message";

describe("welcomepayPgAuthFailMessage", () => {
  it("resultCode 01 — 테스트 환경 안내", () => {
    process.env.WELCOMEPAY_ENV = "test";
    const msg = welcomepayPgAuthFailMessage({ resultCode: "01" });
    expect(msg).toContain("테스트");
  });

  it("resultCode 01 — 운영은 PG 문구 우선", () => {
    process.env.WELCOMEPAY_ENV = "production";
    const msg = welcomepayPgAuthFailMessage({
      resultCode: "01",
      pgMessage: "사용자가 결제를 취소하였습니다.",
    });
    expect(msg).toBe("사용자가 결제를 취소하였습니다.");
  });

  it("resultCode 01 — 운영·PG문구 없음", () => {
    process.env.WELCOMEPAY_ENV = "production";
    const msg = welcomepayPgAuthFailMessage({ resultCode: "01" });
    expect(msg).toContain("결제창을 열기 전");
  });

  it("isWelcomepayAuthSuccessCode — 모바일 00·0", () => {
    expect(isWelcomepayAuthSuccessCode("0000")).toBe(true);
    expect(isWelcomepayAuthSuccessCode("00")).toBe(true);
    expect(isWelcomepayAuthSuccessCode("0")).toBe(true);
    expect(isWelcomepayAuthSuccessCode("01")).toBe(false);
  });
});
