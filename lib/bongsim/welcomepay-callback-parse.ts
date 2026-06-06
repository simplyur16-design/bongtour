/** PG 인증/승인 콜백 본문 파싱 (PC returnUrl · 모바일 P_NEXT_URL 공통). */

import { pickCaptureTidFromMap } from "@/lib/bongsim/refund/resolve-welcomepay-capture-tid";

export function parseWelcomepayPayload(text: string): Record<string, string> {
  const t = text.trim();
  const out: Record<string, string> = {};
  if (!t) return out;
  try {
    const j = JSON.parse(t) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) {
      for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
        if (v != null && typeof v !== "object") out[k] = String(v);
      }
      return out;
    }
  } catch {
    /* URL-encoded or plain */
  }
  const sp = new URLSearchParams(t);
  sp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export function resultCodeOf(m: Record<string, string>): string {
  const v =
    m.resultCode ??
    m.ResultCode ??
    m.RESULTCODE ??
    m.resultcode ??
    m.P_STATUS ??
    m.p_status ??
    "";
  return String(v).trim();
}

/** 인증 콜백 주문번호 — PC `orderNumber`, 모바일 `P_OID`·`P_NOTI`. 승인 응답 MOID는 여기서 쓰지 않음. */
export function pickOid(m: Record<string, string>): string {
  return (
    m.oid ??
    m.OID ??
    m.orderNumber ??
    m.OrderNumber ??
    m.ordernumber ??
    m.P_OID ??
    m.p_oid ??
    m.P_NOTI ??
    m.p_noti ??
    ""
  ).trim();
}

function mergeWelcomepayParamMaps(...maps: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      if (v != null && String(v).length > 0) out[k] = String(v);
    }
  }
  return out;
}

/** PG 콜백 Request — 쿼리·multipart·urlencoded·JSON 본문을 하나의 맵으로 병합. */
export async function readWelcomepayCallbackFromRequest(req: Request): Promise<Record<string, string>> {
  const fromQuery: Record<string, string> = {};
  try {
    const u = new URL(req.url);
    u.searchParams.forEach((v, k) => {
      fromQuery[k] = v;
    });
  } catch {
    /* ignore */
  }

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return fromQuery;
  }

  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    try {
      const fd = await req.formData();
      const fromForm: Record<string, string> = {};
      for (const [k, v] of fd.entries()) {
        if (typeof v === "string") fromForm[k] = v;
      }
      if (Object.keys(fromForm).length > 0) {
        return mergeWelcomepayParamMaps(fromQuery, fromForm);
      }
    } catch {
      /* fall through to raw text */
    }
  }

  try {
    const raw = await req.text();
    return mergeWelcomepayParamMaps(fromQuery, parseWelcomepayPayload(raw));
  } catch {
    return fromQuery;
  }
}

/** 승인·취소용 TID — `authToken`·`oid_` 폴백 제외 */
export function pickCaptureTid(m: Record<string, string>): string {
  return pickCaptureTidFromMap(m);
}

/** @deprecated `pickCaptureTid` 사용 */
export function pickTid(m: Record<string, string>): string {
  return pickCaptureTid(m) || (m.P_TID ?? m.p_tid ?? "").trim();
}

/** PG 인증 실패 콜백 — `P_RMESG1` 등 사용자·운영자용 메시지 */
export function pickWelcomepayPgCallbackMessage(m: Record<string, string>): string {
  return (
    m.P_RMESG1 ??
    m.p_rmesg1 ??
    m.P_RMESG2 ??
    m.p_rmesg2 ??
    m.P_RMESG3 ??
    m.resultMsg ??
    m.ResultMsg ??
    ""
  ).trim();
}

export function pickAmountKrw(m: Record<string, string>): number | null {
  const raw =
    m.TotPrice ??
    m.totalPrice ??
    m.price ??
    m.P_AMT ??
    m.amount ??
    m.P_AMT1 ??
    "";
  const n = Number.parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}
