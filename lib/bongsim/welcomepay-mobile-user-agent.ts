/** 운영 모바일 welpay POST 호스트 */
export const WELCOMEPAY_PRODUCTION_MOBILE_SUBMIT_HOST = "mobile.paywelcome.co.kr";

/**
 * iPhone·Android 등 — welpay(모바일 PG) vs PC INIStdPay 분기.
 * 서버(headers)·클라이언트(navigator) 공용 (server-only import 금지).
 */
export function isMobileWelpayUserAgent(ua: string): boolean {
  const u = ua.trim();
  if (!u) return false;
  // iPhone·iPod·iPad 및 iOS 브라우저(Chrome/Firefox/Edge)
  if (/\biPhone\b|\biPod\b|\biPad\b/i.test(u)) return true;
  if (/\b(CriOS|FxiOS|EdgiOS)\b/i.test(u)) return true;
  if (/Android|Mobi|IEMobile|BlackBerry|webOS|Opera Mini/i.test(u)) return true;
  return false;
}

export function isProductionWelpaySubmitUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === WELCOMEPAY_PRODUCTION_MOBILE_SUBMIT_HOST;
  } catch {
    return false;
  }
}

export function isProductionSiteHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === "bongtour.com" || h === "www.bongtour.com";
}
