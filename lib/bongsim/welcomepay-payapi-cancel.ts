/** 서버 전용 — 웰컴페이먼츠 PAYAPI 전체취소 */
import "server-only";

import { createHash } from "node:crypto";
import { welcomepayStdPayOrigin } from "@/lib/bongsim/welcomepay";

/** Asia/Seoul 기준 `YYYYMMDDHHmmss` (이니시스 계열 취소 전문 관례) */
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
 * 전체취소 hashData — 이니시스 NVP(v1) 전체취소와 동일 결합 순서.
 * `INIAPIKey` = 가맹점 `signKey`(웰컴 `WELCOMEPAY_SIGN_KEY`).
 */
export function welcomepayFullCancelHashData(input: {
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

export function welcomepayPayapiCancelUrl(): string {
  return `${welcomepayStdPayOrigin()}/v1/payapi/cancel`;
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
  const hashData = welcomepayFullCancelHashData({
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
