/**
 * 웰컴페이먼츠 Mobile Web §1.2 지불수단별 POST URL + P_INI_PAYMENT / PC gopaymethod SSOT.
 * REGRESSION-FREEZE[welcomepay-esim-payment]: wcard·checkout 수단·centerCd=Y 기본 — manifest
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

/** PC INIStdPay `acceptmethod` — IDC센터코드 수신(필수) + 수단별 옵션(`:` 구분) */
export const WELCOMEPAY_PC_ACCEPTMETHOD_CENTER = "centerCd(Y)";

/** 가상계좌 입금기한(일) — PC `vbank(YYYYMMDD)`·모바일 채번 기본 */
export const WELCOMEPAY_VBANK_DEPOSIT_DAYS = 7;

export type WelcomepayMethodDefinition = {
  id: WelcomepayMethodId;
  label: string;
  /** Mobile Web §1.2 path segment (`/smart/{mobilePath}/`) */
  mobilePath: string;
  /** 모바일 `P_INI_PAYMENT` */
  pIniPayment: string;
  /** PC INIStdPay `gopaymethod` */
  pcGoPayMethod: string;
  /** `P_RESERVED` base(`centerCd=Y`…) 뒤에 붙는 추가 옵션 */
  mobileReservedExtra?: string;
  /** 모바일 폼에 `P_NOTI_URL` 필수 */
  requiresNotiUrl: boolean;
  /** 모바일 폼에 `P_HPP_METHOD` 필수 (eSIM=디지털 1) */
  requiresHppMethod: boolean;
  /** 채번만 되고 입금 전에는 captured 처리하지 않음 */
  vbankPendingOnIssue: boolean;
};

/** `amt_hash=Y` 포함 base — `WELCOMEPAY_MOBILE_AMT_HASH=1` 일 때만 사용 */
export const WELCOMEPAY_MOBILE_P_RESERVED_AMT_HASH = "centerCd=Y&amt_hash=Y";

/** 가이드 샘플 기본 — `P_SIGNATURE` + `centerCd=Y` */
export const WELCOMEPAY_MOBILE_P_RESERVED_BASE = "centerCd=Y";

const ALL_WELCOMEPAY_METHOD_DEFINITIONS: readonly WelcomepayMethodDefinition[] = [
  {
    id: "card",
    label: "신용카드",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "Card",
    // 가이드 샘플 WelPayMoRequest — ISP 2trs·앱설치체크. 간편결제는 PG 카드창 내 노출(가맹 계약).
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
    // 입금기한·현금영수증은 buildWelcomepayMobileReserved에서 수단별 주입
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
    mobileReservedExtra: "global_visa3d=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
] as const;

const METHOD_BY_ID = new Map(ALL_WELCOMEPAY_METHOD_DEFINITIONS.map((m) => [m.id, m]));

/**
 * 결제 UI·prepare 기본 — 신용카드만 (운영 MID 개시 수단).
 * 추가 노출 시 env `WELCOMEPAY_CHECKOUT_METHODS=card,vbank,bank` (쉼표 allowlist).
 */
const WELCOMEPAY_CHECKOUT_METHOD_DEFAULT: WelcomepayMethodId = "card";

function parseWelcomepayCheckoutMethodAllowlist(): Set<WelcomepayMethodId> | null {
  const raw = (process.env.WELCOMEPAY_CHECKOUT_METHODS ?? "").trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allowed = new Set<WelcomepayMethodId>();
  for (const id of ids) {
    if (METHOD_BY_ID.has(id as WelcomepayMethodId) && id !== "culture") {
      allowed.add(id as WelcomepayMethodId);
    }
  }
  return allowed.size > 0 ? allowed : null;
}

/** 결제 UI·prepare에 노출하는 수단 */
export function listWelcomepayCheckoutMethods(): readonly WelcomepayMethodDefinition[] {
  const allowlist = parseWelcomepayCheckoutMethodAllowlist();
  if (allowlist) {
    return ALL_WELCOMEPAY_METHOD_DEFINITIONS.filter((m) => allowlist.has(m.id));
  }
  return ALL_WELCOMEPAY_METHOD_DEFINITIONS.filter((m) => m.id === WELCOMEPAY_CHECKOUT_METHOD_DEFAULT);
}

/** @deprecated `listWelcomepayCheckoutMethods()` — env·제외 정책 반영 */
export const WELCOMEPAY_CHECKOUT_METHODS: readonly WelcomepayMethodDefinition[] = listWelcomepayCheckoutMethods();

export function formatWelcomepayVbankDeadlineYmd(now = new Date(), depositDays = WELCOMEPAY_VBANK_DEPOSIT_DAYS): string {
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + depositDays);
  const y = deadline.getFullYear();
  const m = String(deadline.getMonth() + 1).padStart(2, "0");
  const d = String(deadline.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** PC 표준결제 `acceptmethod` — `centerCd(Y)` 필수 + 수단별 옵션(간편결제는 카드창 기본 노출) */
export function buildWelcomepayPcAcceptMethod(id: WelcomepayMethodId, now = new Date()): string {
  const parts = [WELCOMEPAY_PC_ACCEPTMETHOD_CENTER];
  switch (id) {
    case "overseas":
      parts.push("GLOBAL");
      break;
    case "vbank":
      // 현금영수증 미계약 상점 — no_receipt (va_receipt는 별도 계약 필요)
      parts.push("no_receipt", `vbank(${formatWelcomepayVbankDeadlineYmd(now)})`);
      break;
    case "bank":
      parts.push("no_receipt");
      break;
    default:
      break;
  }
  return parts.join(":");
}

export function resolveWelcomepayMethodId(raw: unknown): WelcomepayMethodId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s && listWelcomepayCheckoutMethods().some((m) => m.id === s)) return s as WelcomepayMethodId;
  return WELCOMEPAY_CHECKOUT_METHOD_DEFAULT;
}

export function getWelcomepayMethodDefinition(id: WelcomepayMethodId): WelcomepayMethodDefinition {
  return METHOD_BY_ID.get(id) ?? METHOD_BY_ID.get("card")!;
}

export function buildWelcomepayMobileReservedBase(useAmtHash: boolean): string {
  return useAmtHash ? WELCOMEPAY_MOBILE_P_RESERVED_AMT_HASH : WELCOMEPAY_MOBILE_P_RESERVED_BASE;
}

/** 모바일 가상계좌 `P_RESERVED` — 입금기한·현금영수증 UI (웰컴 Mobile Web 가이드) */
export function buildWelcomepayVbankMobileReservedExtra(now = new Date()): string {
  const dt = formatWelcomepayVbankDeadlineYmd(now);
  // 당일 채번이면 TM=2359 필수(가이드). 기본 7일 후면 2359 안전.
  return `P_VBANK_DT=${dt}&P_VBANK_TM=2359&bank_receipt=N`;
}

export function buildWelcomepayMobileReserved(
  def: WelcomepayMethodDefinition,
  useAmtHash = false,
  now = new Date(),
): string {
  const base = buildWelcomepayMobileReservedBase(useAmtHash);
  const chunks: string[] = [];
  const extra = def.mobileReservedExtra?.trim();
  if (extra) chunks.push(extra);
  if (def.id === "vbank") chunks.push(buildWelcomepayVbankMobileReservedExtra(now));
  return chunks.length ? `${base}&${chunks.join("&")}` : base;
}
