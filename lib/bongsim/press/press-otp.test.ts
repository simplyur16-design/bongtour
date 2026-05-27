import { describe, expect, it } from "vitest";
import {
  generatePressOtpCode,
  isPressOtpAttemptLocked,
  normalizeWorkEmail,
  pressOtpAttemptsRemaining,
  PRESS_OTP_MAX_ATTEMPTS,
} from "@/lib/bongsim/press/press-otp-helpers";

describe("press OTP helpers", () => {
  it("normalizeWorkEmail — 유효/무효", () => {
    expect(normalizeWorkEmail("  Reporter@joonbu.com  ")).toBe("reporter@joonbu.com");
    expect(normalizeWorkEmail("bad")).toBeNull();
  });

  it("generatePressOtpCode — 6자리 숫자", () => {
    const code = generatePressOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("5회 실패 후 잠금", () => {
    expect(isPressOtpAttemptLocked(PRESS_OTP_MAX_ATTEMPTS - 1)).toBe(false);
    expect(isPressOtpAttemptLocked(PRESS_OTP_MAX_ATTEMPTS)).toBe(true);
    expect(pressOtpAttemptsRemaining(4)).toBe(1);
    expect(pressOtpAttemptsRemaining(5)).toBe(0);
  });
});
