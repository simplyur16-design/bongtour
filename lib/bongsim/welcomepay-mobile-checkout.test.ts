import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { pickOid, readWelcomepayCallbackFromRequest } from "@/lib/bongsim/welcomepay-callback-parse";
import { isMobileWelpayUserAgent } from "@/lib/bongsim/welcomepay-mobile-user-agent";
import { welcomepayMobileNextCallbackUrl } from "@/lib/bongsim/welcomepay";

const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";
const SAMSUNG_INTERNET_UA =
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";
const KAKAOTALK_WEBVIEW_UA =
  "Mozilla/5.0 (Linux; Android 12; SM-G991N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.4.5";
const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const SESSION_ID = "welcomepayMID_1717500000000";

describe("모바일 welpay 체크아웃 — iPhone·Android", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("UA 분기 (welpay vs PC INIStdPay)", () => {
    it("Android Chrome → welpay", () => {
      expect(isMobileWelpayUserAgent(ANDROID_CHROME_UA)).toBe(true);
    });

    it("Samsung Internet → welpay", () => {
      expect(isMobileWelpayUserAgent(SAMSUNG_INTERNET_UA)).toBe(true);
    });

    it("카카오톡 인앱 WebView(Android) → welpay", () => {
      expect(isMobileWelpayUserAgent(KAKAOTALK_WEBVIEW_UA)).toBe(true);
    });

    it("iPhone Safari → welpay", () => {
      expect(isMobileWelpayUserAgent(IPHONE_SAFARI_UA)).toBe(true);
    });

    it("Windows Chrome → PC", () => {
      expect(isMobileWelpayUserAgent(DESKTOP_CHROME_UA)).toBe(false);
    });
  });

  describe("P_NEXT_URL (welcomepay-mobile-next)", () => {
    it("prepare — P_OID·P_NOTI 쿼리 포함 (iOS·Android 공통 폴백)", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://bongtour.com";
      expect(welcomepayMobileNextCallbackUrl(SESSION_ID)).toBe(
        `https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next?P_OID=${encodeURIComponent(SESSION_ID)}&P_NOTI=${encodeURIComponent(SESSION_ID)}`,
      );
    });

    it("Android Chrome — POST urlencoded 본문에서 oid", async () => {
      const req = new Request("https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: `P_OID=${SESSION_ID}&P_NOTI=${SESSION_ID}&P_STATUS=00&P_TID=android_tid_001&P_AMT=15000`,
      });
      const m = await readWelcomepayCallbackFromRequest(req);
      expect(pickOid(m)).toBe(SESSION_ID);
      expect(m.P_TID).toBe("android_tid_001");
      expect(m.P_AMT).toBe("15000");
    });

    it("Android — GET만 오고 본문 없음 (쿼리 폴백)", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://bongtour.com";
      const req = new Request(`${welcomepayMobileNextCallbackUrl(SESSION_ID)}&P_STATUS=00&P_TID=android_get_tid`, {
        method: "GET",
      });
      const m = await readWelcomepayCallbackFromRequest(req);
      expect(pickOid(m)).toBe(SESSION_ID);
      expect(m.P_TID).toBe("android_get_tid");
    });

    it("Android — POST multipart (일부 WebView)", async () => {
      const fd = new FormData();
      fd.set("P_OID", SESSION_ID);
      fd.set("P_NOTI", SESSION_ID);
      fd.set("P_STATUS", "00");
      fd.set("P_TID", "android_multi_tid");
      const req = new Request("https://bongtour.com/api/bongsim/checkout/welcomepay-mobile-next", {
        method: "POST",
        body: fd,
      });
      const m = await readWelcomepayCallbackFromRequest(req);
      expect(pickOid(m)).toBe(SESSION_ID);
      expect(m.P_TID).toBe("android_multi_tid");
    });

    it("iPhone — GET 쿼리 폴백 (Safari POST 본문 유실)", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://bongtour.com";
      const req = new Request(`${welcomepayMobileNextCallbackUrl(SESSION_ID)}&P_STATUS=00`, {
        method: "GET",
      });
      const m = await readWelcomepayCallbackFromRequest(req);
      expect(pickOid(m)).toBe(SESSION_ID);
    });

    it("쿼리+본문 병합 시 본문 P_OID 우선", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://bongtour.com";
      const base = welcomepayMobileNextCallbackUrl("from_query");
      const req = new Request(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `P_OID=${SESSION_ID}&P_STATUS=00`,
      });
      const m = await readWelcomepayCallbackFromRequest(req);
      expect(pickOid(m)).toBe(SESSION_ID);
    });
  });
});
