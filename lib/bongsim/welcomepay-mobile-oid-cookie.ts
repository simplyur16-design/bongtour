/** iPhone Safari 등 POST 본문 유실 시 `welcomepay-mobile-next` 주문번호 복구용 (prepare에서 설정). */
export const WELCOMEPAY_MOBILE_OID_COOKIE = "bongsim_welpay_p_oid";

const COOKIE_PATH = "/api/bongsim/checkout/welcomepay-mobile-next";

/** PG → 가맹점 cross-site POST 콜백에 쿠키가 실리도록 운영은 `SameSite=None`. */
function welpayOidCookieSameSite(): "None" | "Lax" {
  return process.env.NODE_ENV === "production" ? "None" : "Lax";
}

function welpayOidCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function welcomepayMobileOidCookieSetHeader(providerSessionId: string): string {
  const sid = providerSessionId.trim();
  const parts = [
    `${WELCOMEPAY_MOBILE_OID_COOKIE}=${encodeURIComponent(sid)}`,
    `Path=${COOKIE_PATH}`,
    "Max-Age=7200",
    "HttpOnly",
    `SameSite=${welpayOidCookieSameSite()}`,
  ];
  if (welpayOidCookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

export function welcomepayMobileOidCookieClearHeader(): string {
  const parts = [
    `${WELCOMEPAY_MOBILE_OID_COOKIE}=`,
    `Path=${COOKIE_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    `SameSite=${welpayOidCookieSameSite()}`,
  ];
  if (welpayOidCookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

/** 결제 폼 submit 직전 브라우저 `document.cookie` (HttpOnly fetch 누락·Safari 폴백). */
export function welcomepayMobileOidDocumentCookie(providerSessionId: string, httpsPage: boolean): string {
  const sid = encodeURIComponent(providerSessionId.trim());
  const sameSite = httpsPage ? "None" : "Lax";
  const secure = httpsPage ? "; Secure" : "";
  return `${WELCOMEPAY_MOBILE_OID_COOKIE}=${sid}; path=${COOKIE_PATH}; max-age=7200; SameSite=${sameSite}${secure}`;
}

export function pickOidFromWelpayCookie(req: Request): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== WELCOMEPAY_MOBILE_OID_COOKIE) continue;
    const value = trimmed.slice(eq + 1);
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return value.trim();
    }
  }
  return "";
}
