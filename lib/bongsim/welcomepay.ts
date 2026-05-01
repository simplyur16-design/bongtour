/** 서버 전용 — `node:crypto` 사용. 클라이언트 번들에서 import 금지. */
import "server-only";

import { createHash } from "node:crypto";

/** test | production (default test) */
export type WelcomepayEnvKind = "test" | "production";

export function resolveWelcomepayEnv(): WelcomepayEnvKind {
  const raw = (process.env.WELCOMEPAY_ENV ?? "test").trim().toLowerCase();
  if (raw === "production" || raw === "prod" || raw === "live") return "production";
  return "test";
}

export function welcomepayStdPayOrigin(): string {
  return resolveWelcomepayEnv() === "production"
    ? "https://stdpay.paywelcome.co.kr"
    : "https://tstdpay.paywelcome.co.kr";
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

/**
 * 모바일 welpay `P_TIMESTAMP` — PC 표준결제와 동일하게 Unix epoch 밀리초 문자열.
 * `generateMobileSignature` 입력값과 반드시 일치해야 함.
 */
export function generateMobileWelpayTimestamp(): string {
  return generateTimestamp();
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

/** 모바일 등: SHA256("mkey={mKey}&P_AMT={amt}&P_OID={oid}&P_TIMESTAMP={ts}") — mkey 소문자 */
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
