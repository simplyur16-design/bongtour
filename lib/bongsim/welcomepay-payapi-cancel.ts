/** 서버 전용 — 웰컴페이먼츠 PAYAPI 전체취소 (연동가이드 v5.1.8 §3.2.1 `cancel/cancel`) */
import "server-only";

import { createHash } from "node:crypto";
import { generateMKey, welcomepayFullCancelUrl } from "@/lib/bongsim/welcomepay";

/** 웹결제 signKey — `WELCOMEPAY_SIGN_KEY` (관리자: 상점정보 > 계약정보 > 부가정보) */
export function resolveWelcomepaySignKey(): string {
  return (process.env.WELCOMEPAY_SIGN_KEY ?? "").trim();
}

/** @deprecated `resolveWelcomepaySignKey` — INIAPI Key 미사용 */
export function resolveWelcomepayIniapiSignKey(): string {
  return resolveWelcomepaySignKey();
}

/** Asia/Seoul 기준 `YYYYMMDDHHmmss` (14자) */
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

/**
 * PAYAPI 전체취소 signature — SHA256(`mid={mid}&mkey={mkey}&timestamp={timestamp}`)
 * 필드 순서·값은 요청 폼과 동일 (§2.2, §3.2.1). mkey = SHA256(signKey).
 */
export function welcomepayPayapiFullCancelSignature(input: {
  mid: string;
  mkey: string;
  timestamp: string;
}): string {
  const plain = `mid=${input.mid.trim()}&mkey=${input.mkey}&timestamp=${input.timestamp}`;
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export type WelcomepayCancelFormBody = {
  payType: string;
  mid: string;
  tid: string;
  price: string;
  currency: string;
  timestamp: string;
  signature: string;
  /** 모바일 망취소 시 `C` */
  cancelType?: string;
};

export function buildWelcomepayCancelFormBody(input: {
  signKey: string;
  mid: string;
  tid: string;
  priceKrw: number;
  timestamp?: string;
  payType?: string;
  currency?: string;
  cancelType?: string;
}): WelcomepayCancelFormBody {
  const timestamp = input.timestamp ?? welcomepayCancelTimestampKst();
  const mkey = generateMKey(input.signKey);
  const signature = welcomepayPayapiFullCancelSignature({
    mid: input.mid,
    mkey,
    timestamp,
  });
  const body: WelcomepayCancelFormBody = {
    payType: (input.payType ?? "card").trim(),
    mid: input.mid.trim(),
    tid: input.tid.trim(),
    price: String(Math.trunc(input.priceKrw)),
    currency: (input.currency ?? "WON").trim(),
    timestamp,
    signature,
  };
  if (input.cancelType?.trim()) {
    body.cancelType = input.cancelType.trim();
  }
  return body;
}

export function encodeWelcomepayCancelForm(body: WelcomepayCancelFormBody): string {
  const entries: [string, string][] = [
    ["payType", body.payType],
    ["mid", body.mid],
    ["tid", body.tid],
    ["price", body.price],
    ["currency", body.currency],
    ["timestamp", body.timestamp],
    ["signature", body.signature],
  ];
  if (body.cancelType) {
    entries.push(["cancelType", body.cancelType]);
  }
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

export type WelcomepayCancelApiResult = {
  httpStatus: number;
  api: "payapi_cancel";
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
  parsed: Record<string, unknown>,
  raw: string,
): WelcomepayCancelApiResult {
  const resultCode = String(parsed.resultCode ?? parsed.ResultCode ?? "").trim();
  const resultMsg = String(parsed.resultMsg ?? parsed.ResultMsg ?? "").trim();
  const okPg = resultCode === "00" || resultCode === "0000";
  const ok = httpStatus >= 200 && httpStatus < 300 && okPg;
  return { httpStatus, api: "payapi_cancel", parsed, raw, ok, resultCode, resultMsg };
}

/** PAYAPI 3.2.1 전체취소 — `POST {payapi}/cancel/cancel` */
export async function requestWelcomepayFullCancel(input: {
  signKey: string;
  mid: string;
  tid: string;
  priceKrw: number;
  cancelType?: string;
}): Promise<WelcomepayCancelApiResult> {
  const cancelBody = buildWelcomepayCancelFormBody({
    signKey: input.signKey,
    mid: input.mid,
    tid: input.tid,
    priceKrw: input.priceKrw,
    cancelType: input.cancelType,
  });
  const res = await fetch(welcomepayFullCancelUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: encodeWelcomepayCancelForm(cancelBody),
  });
  const raw = await res.text();
  const parsed = parsePgJson(raw);
  return outcomeFromResponse(res.status, parsed, raw);
}

export function welcomepayCancelFailMessage(r: WelcomepayCancelApiResult): string {
  if (r.httpStatus === 404) {
    return "PG 취소 API에 연결하지 못했습니다(404). payapi 호스트·MID 환경(테스트/운영)을 확인해 주세요.";
  }
  if (r.resultCode === "ERR206") {
    return "PG 취소 서명(signature)이 맞지 않습니다. WELCOMEPAY_SIGN_KEY(웹결제 signKey)를 확인해 주세요.";
  }
  if (r.resultMsg) return r.resultMsg;
  if (r.raw) return r.raw.slice(0, 300);
  return `PG 취소 실패 (HTTP ${r.httpStatus})`;
}
