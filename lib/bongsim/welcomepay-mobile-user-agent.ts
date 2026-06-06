/**
 * iPhone·Android 등 — welpay(모바일 PG) vs PC INIStdPay 분기.
 * 서버(headers)·클라이언트(navigator) 공용 (server-only import 금지).
 */
export function isMobileWelpayUserAgent(ua: string): boolean {
  const u = ua.trim();
  if (!u) return false;
  if (/\biPhone\b|\biPod\b|\biPad\b/i.test(u)) return true;
  if (/Android|Mobi|IEMobile|BlackBerry|webOS|Opera Mini/i.test(u)) return true;
  return false;
}
