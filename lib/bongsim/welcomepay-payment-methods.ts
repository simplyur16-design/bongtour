/**
 * 웰컴페이먼츠 Mobile Web §1.2 지불수단별 POST URL + P_INI_PAYMENT / PC gopaymethod SSOT.
 * 클라이언트·서버 공용 (server-only import 금지).
 */

export const WELCOMEPAY_METHOD_IDS = [
  "card",
  "vbank",
  "bank",
  "hpp",
  "culture",
  "overseas",
] as const;

export type WelcomepayMethodId = (typeof WELCOMEPAY_METHOD_IDS)[number];

export type WelcomepayMethodDefinition = {
  id: WelcomepayMethodId;
  label: string;
  /** Mobile Web §1.2 path segment (`/smart/{mobilePath}/`) */
  mobilePath: string;
  /** 모바일 `P_INI_PAYMENT` */
  pIniPayment: string;
  /** PC INIStdPay `gopaymethod` */
  pcGoPayMethod: string;
  /** PC `acceptmethod` (해외카드 등) */
  pcAcceptMethod?: string;
  /** `P_RESERVED`에 `centerCd=Y&amt_hash=Y` 뒤에 붙는 추가 옵션 */
  mobileReservedExtra?: string;
  /** 모바일 폼에 `P_NOTI_URL` 필수 */
  requiresNotiUrl: boolean;
  /** 모바일 폼에 `P_HPP_METHOD` 필수 (eSIM=디지털 1) */
  requiresHppMethod: boolean;
  /** 채번만 되고 입금 전에는 captured 처리하지 않음 */
  vbankPendingOnIssue: boolean;
};

export const WELCOMEPAY_MOBILE_P_RESERVED_BASE = "centerCd=Y&amt_hash=Y";

export const WELCOMEPAY_CHECKOUT_METHODS: readonly WelcomepayMethodDefinition[] = [
  {
    id: "card",
    label: "신용카드",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "Card",
    // 가이드 샘플 WelPayMoRequest — ISP 2trs·앱설치체크 (amt_hash와 병행)
    mobileReservedExtra: "twotrs_isp=Y&block_isp=Y&twotrs_isp_noti=N&apprun_check=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  {
    id: "vbank",
    label: "가상계좌",
    mobilePath: "vbank",
    pIniPayment: "VBANK",
    pcGoPayMethod: "VBank",
    requiresNotiUrl: true,
    requiresHppMethod: false,
    vbankPendingOnIssue: true,
  },
  {
    id: "bank",
    label: "계좌이체",
    mobilePath: "bank",
    pIniPayment: "BANK",
    pcGoPayMethod: "DirectBank",
    mobileReservedExtra: "twotrs_bank=Y&apprun_check=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  {
    id: "hpp",
    label: "휴대폰",
    mobilePath: "mobile",
    pIniPayment: "HPP",
    pcGoPayMethod: "HPP",
    requiresNotiUrl: false,
    requiresHppMethod: true,
    vbankPendingOnIssue: false,
  },
  {
    id: "culture",
    label: "문화상품권",
    mobilePath: "cgft",
    pIniPayment: "CULTURE",
    pcGoPayMethod: "Culture",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  {
    id: "overseas",
    label: "해외카드",
    mobilePath: "etc",
    pIniPayment: "CARD",
    pcGoPayMethod: "Card",
    pcAcceptMethod: "GLOBAL",
    mobileReservedExtra: "global_visa3d=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
] as const;

const METHOD_BY_ID = new Map(WELCOMEPAY_CHECKOUT_METHODS.map((m) => [m.id, m]));

export function resolveWelcomepayMethodId(raw: unknown): WelcomepayMethodId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s && METHOD_BY_ID.has(s as WelcomepayMethodId)) return s as WelcomepayMethodId;
  return "card";
}

export function getWelcomepayMethodDefinition(id: WelcomepayMethodId): WelcomepayMethodDefinition {
  return METHOD_BY_ID.get(id) ?? METHOD_BY_ID.get("card")!;
}

export function buildWelcomepayMobileReserved(def: WelcomepayMethodDefinition): string {
  const extra = def.mobileReservedExtra?.trim();
  return extra ? `${WELCOMEPAY_MOBILE_P_RESERVED_BASE}&${extra}` : WELCOMEPAY_MOBILE_P_RESERVED_BASE;
}
