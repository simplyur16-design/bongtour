import { describe, expect, it } from "vitest";
import {
  isMobileWelpayUserAgent,
  isProductionWelpaySubmitUrl,
} from "@/lib/bongsim/welcomepay-mobile-user-agent";

describe("isMobileWelpayUserAgent", () => {
  it("iPhone Safari → welpay", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    expect(isMobileWelpayUserAgent(ua)).toBe(true);
  });

  it("iPhone Chrome(CriOS) → welpay", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/121.0.0.0 Mobile/15E148 Safari/604.1";
    expect(isMobileWelpayUserAgent(ua)).toBe(true);
  });

  it("운영 모바일 PG URL", () => {
    expect(isProductionWelpaySubmitUrl("https://mobile.paywelcome.co.kr/smart/wcard/")).toBe(true);
    expect(isProductionWelpaySubmitUrl("https://tmobile.paywelcome.co.kr/smart/wcard/")).toBe(false);
  });

  it("Android Chrome → welpay", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";
    expect(isMobileWelpayUserAgent(ua)).toBe(true);
  });

  it("Samsung Internet → welpay", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
    expect(isMobileWelpayUserAgent(ua)).toBe(true);
  });

  it("Windows Chrome desktop → PC", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(isMobileWelpayUserAgent(ua)).toBe(false);
  });
});
