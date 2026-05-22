/** 서버 전용 — 웰컴페이먼츠 INIAPI 전체취소 (V1 NVP + V2 JSON 폴백) */
import "server-only";

import { createHash } from "node:crypto";
import { welcomepayIniapiOrigin } from "@/lib/bongsim/welcomepay";

/** Asia/Seoul 기준 `YYYYMMDDHHmmss` */
export function welcomepayCancelTimestampKst(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(/[-\s:]/g, "");
}

/** V1 NVP — INIAPIKey + type + paymethod + timestamp + clientIp + mid + tid */
export function welcomepayV1FullCancelHashData(input: {
  signKey: string;
  mid: string;
  tid: string;
  timestamp: string;
  paymethod?: string;
  clientIp?: string;
}): string {
  const type = "Refund";
  const paymethod = (input.paymethod ?? "Card").trim();
  const clientIp = (input.clientIp ?? "0.0.0.0").trim();
  const plain =
    input.signKey + type + paymethod + input.timestamp + clientIp + input.mid.trim() + input.tid.trim();
  return createHash("sha512").update(plain, "utf8").digest("hex");
}

/** V1 — `https://iniapi.paywelcome.co.kr/api/v1/refund` (form-urlencoded) */
export function welcomepayV1RefundUrl(): string {
  return `${welcomepayIniapiOrigin()}/api/v1/refund`;
}

/** V2 — `https://iniapi.paywelcome.co.kr/v2/pg/refund` (JSON) */
export function welcomepayV2RefundUrl(): string {
  return `${welcomepayIniapiOrigin()}/v2/pg/refund`;
}

export type WelcomepayCancelNvpBody = {
  mid: string;
  tid: string;
  msg: string;
  price: string;
  timestamp: string;
  hashData: string;
  type?: string;
  paymethod?: string;
  clientIp?: string;
};

export function buildWelcomepayCancelFormBody(input: {
  signKey: string;
  mid: string;
  tid: string;
  msg: string;
  priceKrw: number;
  timestamp?: string;
  paymethod?: string;
  clientIp?: string;
}): WelcomepayCancelNvpBody {
  const timestamp = input.timestamp ?? welcomepayCancelTimestampKst();
  const paymethod = input.paymethod ?? "Card";
  const clientIp =
    input.clientIp ?? ((process.env.WELCOMEPAY_CANCEL_CLIENT_IP ?? "").trim() || "0.0.0.0");
  const hashData = welcomepayV1FullCancelHashData({
    signKey: input.signKey,
    mid: input.mid,
    tid: input.tid,
    timestamp,
    paymethod,
    clientIp,
  });
  return {
    type: "Refund",
    paymethod,
    clientIp,
    mid: input.mid.trim(),
    tid: input.tid.trim(),
    msg: input.msg,
    price: String(Math.trunc(input.priceKrw)),
    timestamp,
    hashData,
  };
}

export function encodeWelcomepayCancelNvp(body: WelcomepayCancelNvpBody): string {
  const entries: [string, string][] = [
    ["type", body.type ?? "Refund"],
    ["paymethod", body.paymethod ?? "Card"],
    ["clientIp", body.clientIp ?? "0.0.0.0"],
    ["mid", body.mid],
    ["tid", body.tid],
    ["msg", body.msg],
    ["price", body.price],
    ["timestamp", body.timestamp],
    ["hashData", body.hashData],
  ];
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/** @deprecated `welcomepayV1RefundUrl` 사용 — stdpay `/v1/payapi/cancel` 는 404 */
export function welcomepayPayapiCancelUrl(): string {
  return welcomepayV1RefundUrl();
}

export type WelcomepayCancelApiResult = {
  httpStatus: number;
  api: "v1_nvp" | "v2_json";
  parsed: Record<string, unknown>;
  raw: string;
  ok: boolean;
  resultCode: string;
  resultMsg: string;
};

function parsePgJson(text: string): Record<string, unknown> {
  try {
    const j = JSON.parse(text) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
  } catch {
    /* NVP or plain */
  }
  const out: Record<string, unknown> = {};
  const sp = new URLSearchParams(text);
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function outcomeFromResponse(
  httpStatus: number,
  api: "v1_nvp" | "v2_json",
  parsed: Record<string, unknown>,
  raw: string,
): WelcomepayCancelApiResult {
  const resultCode = String(parsed.resultCode ?? parsed.ResultCode ?? "").trim();
  const resultMsg = String(parsed.resultMsg ?? parsed.ResultMsg ?? "").trim();
  const okPg = resultCode === "00" || resultCode === "0000";
  const ok = httpStatus >= 200 && httpStatus < 300 && okPg;
  return { httpStatus, api, parsed, raw, ok, resultCode, resultMsg };
}

function buildV2RefundBody(input: {
  signKey: string;
  mid: string;
  tid: string;
  msg: string;
  timestamp: string;
  clientIp: string;
}): Record<string, unknown> {
  const type = "refund";
  const data = { tid: input.tid.trim(), msg: input.msg };
  const dataStr = JSON.stringify(data);
  const hashPlain = input.signKey + input.mid.trim() + type + input.timestamp + dataStr;
  const hashData = createHash("sha512").update(hashPlain, "utf8").digest("hex");
  return {
    mid: input.mid.trim(),
    type,
    timestamp: input.timestamp,
    clientIp: input.clientIp,
    hashData,
    data,
  };
}

/** INIAPI V1 전체취소 요청 */
export async function requestWelcomepayV1FullCancel(input: {
  signKey: string;
  mid: string;
  tid: string;
  msg: string;
  priceKrw: number;
  clientIp?: string;
}): Promise<WelcomepayCancelApiResult> {
  const cancelBody = buildWelcomepayCancelFormBody(input);
  const res = await fetch(welcomepayV1RefundUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: encodeWelcomepayCancelNvp(cancelBody),
  });
  const raw = await res.text();
  const parsed = parsePgJson(raw);
  return outcomeFromResponse(res.status, "v1_nvp", parsed, raw);
}

/** INIAPI V2 전체취소 (V1 실패 시 폴백) */
export async function requestWelcomepayV2FullCancel(input: {
  signKey: string;
  mid: string;
  tid: string;
  msg: string;
  clientIp?: string;
}): Promise<WelcomepayCancelApiResult> {
  const timestamp = welcomepayCancelTimestampKst();
  const clientIp = (input.clientIp ?? process.env.WELCOMEPAY_CANCEL_CLIENT_IP ?? "0.0.0.0").trim();
  const body = buildV2RefundBody({
    signKey: input.signKey,
    mid: input.mid,
    tid: input.tid,
    msg: input.msg,
    timestamp,
    clientIp,
  });
  const res = await fetch(welcomepayV2RefundUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  const parsed = parsePgJson(raw);
  return outcomeFromResponse(res.status, "v2_json", parsed, raw);
}

/** V1 우선, HTTP 404·실패 시 V2 재시도 */
export async function requestWelcomepayFullCancel(input: {
  signKey: string;
  mid: string;
  tid: string;
  msg: string;
  priceKrw: number;
  clientIp?: string;
}): Promise<WelcomepayCancelApiResult> {
  const v1 = await requestWelcomepayV1FullCancel(input);
  if (v1.ok) return v1;
  if (v1.httpStatus === 404 || v1.resultCode === "ERR205") {
    const v2 = await requestWelcomepayV2FullCancel(input);
    if (v2.ok) return v2;
    return v2.httpStatus >= v1.httpStatus ? v2 : v1;
  }
  return v1;
}

export function welcomepayCancelFailMessage(r: WelcomepayCancelApiResult): string {
  if (r.httpStatus === 404) {
    return "PG 취소 API에 연결하지 못했습니다(404). iniapi 호스트·MID 환경(테스트/운영)을 확인해 주세요.";
  }
  if (r.resultCode === "ERR205") {
    return "PG 취소 서명(hashData)이 맞지 않습니다. WELCOMEPAY_SIGN_KEY(INIAPI Key)를 확인해 주세요.";
  }
  if (r.resultMsg) return r.resultMsg;
  if (r.raw) return r.raw.slice(0, 300);
  return `PG 취소 실패 (HTTP ${r.httpStatus})`;
}
