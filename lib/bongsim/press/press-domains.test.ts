import { describe, expect, it } from "vitest";
import { isPressDomain, PRESS_ALLOWED_DOMAINS } from "@/lib/bongsim/press/press-domains";

describe("isPressDomain", () => {
  it("허용 도메인 exact match", () => {
    for (const d of PRESS_ALLOWED_DOMAINS) {
      expect(isPressDomain(`reporter@${d}`)).toBe(true);
      expect(isPressDomain(`Reporter@${d.toUpperCase()}`)).toBe(true);
    }
  });

  it("비직군 도메인 → false", () => {
    expect(isPressDomain("user@gmail.com")).toBe(false);
    expect(isPressDomain("user@joonbu.com.evil.com")).toBe(false);
    expect(isPressDomain("user@notjoonbu.com")).toBe(false);
  });

  it("잘못된 이메일 → false", () => {
    expect(isPressDomain("not-an-email")).toBe(false);
    expect(isPressDomain("@joonbu.com")).toBe(false);
  });
});
