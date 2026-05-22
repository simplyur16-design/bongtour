/**
 * 웰컴페이먼츠 가이드(PC Web manual v1.10 / Mobile v1.10) 승인 요청·결제보안 검증.
 * @see docs/ops/welcomepay-merchant-manual-checklist.md
 */
import "server-only";

import { createHash } from "node:crypto";
import { generateTimestamp } from "@/lib/bongsim/welcomepay";

/** PC payAuth — `authToken`·`timestamp` 알파벳순 NVP 후 SHA-256 (샘플 WelStdPayUtil::makeSignature) */
export function generatePayAuthSignature(authToken: string, timestamp: string): string {
  const plain = `authToken=${authToken}&timestamp=${timestamp}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** PC 표준결제 승인 API 본문 (필수: mid, authToken, signature, timestamp / 선택: charset, format) */
export function buildPcPayAuthFormBody(input: {
  mid: string;
  authToken: string;
  timestamp?: string;
}): URLSearchParams {
  const mid = input.mid.trim();
  const authToken = input.authToken.trim();
  const timestamp = input.timestamp?.trim() || generateTimestamp();
  const signature = generatePayAuthSignature(authToken, timestamp);
  const body = new URLSearchParams();
  body.set("mid", mid);
  body.set("authToken", authToken);
  body.set("timestamp", timestamp);
  body.set("signature", signature);
  body.set("charset", "UTF-8");
  body.set("format", "JSON");
  return body;
}

/** 모바일 welpay 승인 — `P_REQ_URL` 로 P_MID·P_TID 만 전달 (샘플 WelPayMoResultUtf8) */
export function buildMobilePayApprovalFormBody(input: { pMid: string; pTid: string }): URLSearchParams {
  const body = new URLSearchParams();
  body.set("P_MID", input.pMid.trim());
  body.set("P_TID", input.pTid.trim());
  return body;
}

function authSignaturePlain(input: {
  mid: string;
  authTimestamp: string;
  moid: string;
  totPrice: string;
}): string {
  const mid = input.mid.trim();
  const tstamp = input.authTimestamp.trim();
  const moid = input.moid.trim();
  const totPrice = input.totPrice.trim();
  const tstampKey = tstamp.length > 0 ? Number.parseInt(tstamp.slice(-1), 10) : 0;
  switch (tstampKey) {
    case 1:
      return `MOID=${moid}&mid=${mid}&tstamp=${tstamp}`;
    case 2:
      return `MOID=${moid}&tstamp=${tstamp}&mid=${mid}`;
    case 3:
      return `mid=${mid}&MOID=${moid}&tstamp=${tstamp}`;
    case 4:
      return `mid=${mid}&tstamp=${tstamp}&MOID=${moid}`;
    case 5:
      return `tstamp=${tstamp}&mid=${mid}&MOID=${moid}`;
    case 6:
      return `tstamp=${tstamp}&MOID=${moid}&mid=${mid}`;
    case 7:
      return `TotPrice=${totPrice}&mid=${mid}&tstamp=${tstamp}`;
    case 8:
      return `TotPrice=${totPrice}&tstamp=${tstamp}&mid=${mid}`;
    case 9:
      return `TotPrice=${totPrice}&MOID=${moid}&tstamp=${tstamp}`;
    case 0:
    default:
      return `TotPrice=${totPrice}&tstamp=${tstamp}&MOID=${moid}`;
  }
}

/** 승인 응답 결제보안 — `authSignature` 검증 (샘플 WelStdPayUtil::makeSignatureAuth, 2016+) */
export function verifyWelcomepayAuthSignature(input: {
  mid: string;
  authTimestamp: string;
  moid: string;
  totPrice: string;
  authSignature: string;
}): boolean {
  const expected = authSignaturePlain(input);
  const got = input.authSignature.trim().toLowerCase();
  const exp = createHash("sha256").update(expected, "utf8").digest("hex");
  return got === exp;
}

export function pickAuthToken(m: Record<string, string>): string {
  return (m.authToken ?? m.AuthToken ?? m.AUTH_TOKEN ?? "").trim();
}

export function pickMid(m: Record<string, string>): string {
  return (m.mid ?? m.MID ?? m.P_MID ?? m.p_mid ?? "").trim();
}

export function pickMobileTid(m: Record<string, string>): string {
  return (m.P_TID ?? m.p_tid ?? m.TID ?? m.tid ?? "").trim();
}
