/** 서버 전용 — `node:crypto` 사용. 클라이언트 번들에서 import 금지. */
import "server-only";

import { createHash } from "node:crypto";
import { getSiteOrigin } from "@/lib/site-metadata";

/** test | production (default test) */
export type WelcomepayEnvKind = "test" | "production";

/** PG `returnUrl` / `P_NEXT_URL` / `closeUrl` — `NEXT_PUBLIC_SITE_URL` 등 사이트 SSOT (요청 Host·www 무관). */
export function welcomepayCheckoutCallbackOrigin(): string {
  return getSiteOrigin();
}

/** 가맹점 관리자에 등록하는 모바일 `P_NEXT_URL` (path만, 쿼리 없음). */
export function welcomepayMobileNextCallbackUrlRegistered(): string {
  return `${welcomepayCheckoutCallbackOrigin()}/api/bongsim/checkout/welcomepay-mobile-next`;
}

/**
 * @deprecated prepare·폼에는 `welcomepayMobileNextCallbackUrlRegistered()`만 사용(PG 등록 URL과 완전 일치).
 * 쿼리 붙인 URL은 PG 사전 거절(01) 원인이 될 수 있음. oid는 hidden `P_OID`·`P_NOTI`·쿠키로 복구.
 */
export function welcomepayMobileNextCallbackUrl(providerSessionId?: string): string {
  const base = welcomepayMobileNextCallbackUrlRegistered();
  const sid = (providerSessionId ?? "").trim();
  if (!sid) return base;
  const q = new URLSearchParams();
  q.set("P_OID", sid);
  q.set("P_NOTI", sid);
  return `${base}?${q.toString()}`;
}

export function resolveWelcomepayEnv(): WelcomepayEnvKind {
  const raw = (process.env.WELCOMEPAY_ENV ?? "").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  if (raw === "test") return "test";
  // 배포(NODE_ENV=production)에서 WELCOMEPAY_ENV 미설정 시 운영 PG 사용 — iPhone/Android tmobile 오송신 방지
  if (process.env.NODE_ENV === "production") return "production";
  return "test";
}

export function welcomepayStdPayOrigin(): string {
  return resolveWelcomepayEnv() === "production"
    ? "https://stdpay.paywelcome.co.kr"
    : "https://tstdpay.paywelcome.co.kr";
}

/** PAYAPI 호스트 — 취소·조회 등 (연동가이드 v5.1.8) */
export function welcomepayPayapiOrigin(): string {
  return resolveWelcomepayEnv() === "production"
    ? "https://payapi.paywelcome.co.kr"
    : "https://tpayapi.paywelcome.co.kr";
}

/** PAYAPI 3.2.1 전체취소 */
export function welcomepayFullCancelUrl(): string {
  return `${welcomepayPayapiOrigin()}/cancel/cancel`;
}

export function welcomepayStdPayScriptUrl(): string {
  return `${welcomepayStdPayOrigin()}/stdjs/INIStdPay.js`;
}

export function welcomepayPayAuthUrl(): string {
  return `${welcomepayStdPayOrigin()}/api/payAuth`;
}

/** 스마트폰 웰페이 결제창 POST 대상 (trailing slash 유지). */
export function welcomepayMobileWelpaySubmitUrl(): string {
  return resolveWelcomepayEnv() === "production"
    ? "https://mobile.paywelcome.co.kr/smart/welpay/"
    : "https://tmobile.paywelcome.co.kr/smart/welpay/";
}

/** 모바일 welpay 필수 `P_RESERVED` — IDC센터코드 + 금액위변조 hash (이니시스 stdpay_m). */
export const WELCOMEPAY_MOBILE_P_RESERVED = "centerCd=Y&amt_hash=Y";

/** 모바일 금액위변조 HashKey — 미설정 시 `WELCOMEPAY_SIGN_KEY` 사용. */
export function resolveWelcomepayMobileHashKey(): string {
  return (process.env.WELCOMEPAY_MOBILE_HASH_KEY ?? process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
}

/** 모바일 welpay `P_TIMESTAMP` — PC 표준결제와 동일하게 Unix epoch 밀리초 문자열. */
export function generateMobileWelpayTimestamp(): string {
  return generateTimestamp();
}

/**
 * 모바일 welpay `P_CHKFAKE` — BASE64(SHA512(P_AMT + P_OID + P_TIMESTAMP + HashKey)).
 */
export function generateMobileWelpayPChkfake(input: {
  pAmt: string;
  pOid: string;
  pTimestamp: string;
  hashKey: string;
}): string {
  const data =
    `${input.pAmt.trim()}${input.pOid.trim()}${input.pTimestamp.trim()}${input.hashKey.trim()}`;
  return createHash("sha512").update(data, "utf8").digest("base64");
}

/** 승인/인증 콜백 URL이 웰컴페이먼츠 호스트인지(오픈 리다이렉트 방지). */
export function isPaywelcomeHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "paywelcome.co.kr" || h.endsWith(".paywelcome.co.kr");
  } catch {
    return false;
  }
}

/**
 * 웰컴페이먼츠 PC 표준결제·모바일 welpay 공통 타임스탬프.
 * Unix epoch 밀리초(`Date.now().toString()`), 통상 13자 — PG 길이 제한(1~20자) 준수.
 * PHP `SignatureUtil->getTimestamp()` 밀리초 타임스탬프와 동일 규약.
 * `generatePcStdPaySignature` / 폼 `timestamp` 필드와 반드시 동일 값으로 사용.
 */
export function generateTimestamp(): string {
  return Date.now().toString();
}

/** `mKey` = SHA256(signKey) — 16진 소문자 문자열 */
export function generateMKey(signKey: string): string {
  return createHash("sha256").update(signKey, "utf8").digest("hex");
}

/**
 * 키를 알파벳순 정렬한 뒤 `key=value&...` 로 이어 붙인 문자열의 SHA256(16진 소문자).
 */
export function generateSignature(params: Record<string, string>): string {
  const keys = Object.keys(params).sort((a, b) => a.localeCompare(b));
  const plain = keys.map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** PC 표준결제 사전 서명: SHA256("mKey={mKey}&oid={oid}&price={price}&timestamp={timestamp}") */
export function generatePcStdPaySignature(input: {
  mKey: string;
  oid: string;
  price: string;
  timestamp: string;
}): string {
  const plain = `mKey=${input.mKey}&oid=${input.oid}&price=${input.price}&timestamp=${input.timestamp}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** @deprecated `generateMobileWelpayPChkfake` — 구 v1.10 SHA256(mkey) 방식. 신규 연동 금지. */
export function generateMobileSignature(input: {
  mKey: string;
  pAmt: string;
  pOid: string;
  pTimestamp: string;
}): string {
  const plain = `mkey=${input.mKey}&P_AMT=${input.pAmt}&P_OID=${input.pOid}&P_TIMESTAMP=${input.pTimestamp}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function generateOrderNumber(mid: string): string {
  const m = mid.trim();
  return `${m}_${Date.now()}`;
}
