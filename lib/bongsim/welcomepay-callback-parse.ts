/** PG 인증/승인 콜백 본문 파싱 (PC returnUrl · 모바일 P_NEXT_URL 공통). */

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

export function pickOid(m: Record<string, string>): string {
  return (m.oid ?? m.OID ?? m.MOID ?? m.P_OID ?? m.p_oid ?? "").trim();
}

export function pickTid(m: Record<string, string>): string {
  return (m.TID ?? m.tid ?? m.authToken ?? m.P_TID ?? m.P_REQ_TOKEN ?? `oid_${pickOid(m)}`).trim();
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
