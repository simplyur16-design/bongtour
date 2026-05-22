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

/** 인증 콜백 주문번호 — PC는 `orderNumber`, 모바일은 `P_OID`·`P_NOTI`(라우트 폴백). 승인 응답 MOID는 여기서 쓰지 않음. */
export function pickOid(m: Record<string, string>): string {
  return (
    m.oid ??
    m.OID ??
    m.orderNumber ??
    m.OrderNumber ??
    m.ordernumber ??
    m.P_OID ??
    m.p_oid ??
    ""
  ).trim();
}

/** 승인·취소용 TID — `authToken`·`oid_` 폴백 제외 */
export function pickCaptureTid(m: Record<string, string>): string {
  return pickCaptureTidFromMap(m);
}

/** @deprecated `pickCaptureTid` 사용 */
export function pickTid(m: Record<string, string>): string {
  return pickCaptureTid(m) || (m.P_TID ?? m.p_tid ?? "").trim();
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
