/** 가상계좌 입금통보(P_NOTI_URL) 파싱 — PC·모바일 공통 필드명 혼용 대응. */

export function pickVbankNotiOid(m: Record<string, string>): string {
  return (
    m.no_oid ??
    m.NO_OID ??
    m.P_OID ??
    m.p_oid ??
    m.oid ??
    m.OID ??
    m.P_NOTI ??
    m.p_noti ??
    ""
  ).trim();
}

export function pickVbankNotiTid(m: Record<string, string>): string {
  return (m.no_tid ?? m.NO_TID ?? m.P_TID ?? m.p_tid ?? m.tid ?? m.TID ?? "").trim();
}

export function pickVbankNotiAmountKrw(m: Record<string, string>): number | null {
  const raw = m.amt_input ?? m.AMT_INPUT ?? m.P_AMT ?? m.p_amt ?? m.TotPrice ?? m.totPrice ?? "";
  const n = Number.parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** type_msg=2 입금완료. 필드 없으면 amt_input+tid 조합으로 입금으로 간주. */
export function isVbankDepositNoti(m: Record<string, string>): boolean {
  const typeMsg = (m.type_msg ?? m.TYPE_MSG ?? "").trim();
  if (typeMsg === "2") return true;
  if (typeMsg === "1" || typeMsg === "3") return false;
  const amt = pickVbankNotiAmountKrw(m);
  const tid = pickVbankNotiTid(m);
  return amt != null && tid.length > 0;
}

export function vbankNotiProviderEventId(m: Record<string, string>): string {
  const tid = pickVbankNotiTid(m);
  const dt = (m.dt_input ?? m.DT_INPUT ?? m.P_AUTH_DT ?? "").trim();
  const tm = (m.tm_input ?? m.TM_INPUT ?? "").trim();
  const oid = pickVbankNotiOid(m);
  return `welcomepay_vbank_noti_${tid || oid}_${dt}${tm}`;
}
