/**
 * 웰컴페이먼츠 간편결제 다이렉트 호출 — PC gopaymethod + 모바일 P_RESERVED d_*.
 * REGRESSION-FREEZE[welcomepay-esim-payment]: easy pay direct call after merchant approval — manifest
 * 클라이언트·서버 공용 (server-only import 금지).
 */

import {
  buildWelcomepayMobileReservedBase,
  WELCOMEPAY_PC_ACCEPTMETHOD_CENTER,
  type WelcomepayMethodId,
} from "@/lib/bongsim/welcomepay-payment-methods";

export const WELCOMEPAY_EASY_PAY_KINDS = [
  "kakaopay",
  "naverpay",
  "tosspay",
  "payco",
  "samsungpay",
] as const;

export type WelcomepayEasyPayKind = (typeof WELCOMEPAY_EASY_PAY_KINDS)[number];

export type WelcomepayEasyPayCheckoutId = `easy_${WelcomepayEasyPayKind}`;

export type WelcomepayEasyPayCheckoutDefinition = {
  id: WelcomepayEasyPayCheckoutId;
  kind: WelcomepayEasyPayKind;
  label: string;
  mobilePath: "wcard";
  pIniPayment: "CARD";
  pcGoPayMethod: string;
  mobileDirectReserved: string;
  requiresNotiUrl: false;
  requiresHppMethod: false;
  vbankPendingOnIssue: false;
};

const EASY_PAY_BY_KIND: Record<WelcomepayEasyPayKind, Omit<WelcomepayEasyPayCheckoutDefinition, "id">> = {
  kakaopay: {
    kind: "kakaopay",
    label: "카카오페이",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "onlykakaopay",
    mobileDirectReserved: "d_kakaopay=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  naverpay: {
    kind: "naverpay",
    label: "네이버페이",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "onlynaverpay",
    mobileDirectReserved: "d_npay=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  tosspay: {
    kind: "tosspay",
    label: "토스페이",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "onlytosspay",
    mobileDirectReserved: "d_tosspay=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  payco: {
    kind: "payco",
    label: "PAYCO",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "onlypayco",
    mobileDirectReserved: "d_payco=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
  samsungpay: {
    kind: "samsungpay",
    label: "삼성페이",
    mobilePath: "wcard",
    pIniPayment: "CARD",
    pcGoPayMethod: "onlyssp",
    mobileDirectReserved: "d_samsungpay=Y",
    requiresNotiUrl: false,
    requiresHppMethod: false,
    vbankPendingOnIssue: false,
  },
};

const DEFAULT_EASY_PAY_KINDS: readonly WelcomepayEasyPayKind[] = WELCOMEPAY_EASY_PAY_KINDS;

/** 가맹점 간편결제 승인 후 — 운영 기본 on, `WELCOMEPAY_EASY_PAY=0` 으로만 끔 */
export function resolveWelcomepayEasyPayEnabled(): boolean {
  const raw = (process.env.WELCOMEPAY_EASY_PAY ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  return process.env.NODE_ENV === "production";
}

function parseWelcomepayEasyPayAllowlist(): WelcomepayEasyPayKind[] {
  const raw = (process.env.WELCOMEPAY_EASY_PAY_METHODS ?? "").trim();
  const source = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [...DEFAULT_EASY_PAY_KINDS];
  const allowed: WelcomepayEasyPayKind[] = [];
  for (const kind of source) {
    if ((WELCOMEPAY_EASY_PAY_KINDS as readonly string[]).includes(kind)) {
      allowed.push(kind as WelcomepayEasyPayKind);
    }
  }
  return allowed;
}

export function listWelcomepayEasyPayCheckoutDefinitions(): readonly WelcomepayEasyPayCheckoutDefinition[] {
  if (!resolveWelcomepayEasyPayEnabled()) return [];
  return parseWelcomepayEasyPayAllowlist().map((kind) => ({
    id: `easy_${kind}`,
    ...EASY_PAY_BY_KIND[kind],
  }));
}

export function isWelcomepayEasyPayCheckoutId(id: string): id is WelcomepayEasyPayCheckoutId {
  return id.startsWith("easy_") && (WELCOMEPAY_EASY_PAY_KINDS as readonly string[]).includes(id.slice(5));
}

export function getWelcomepayEasyPayCheckoutDefinition(
  id: WelcomepayEasyPayCheckoutId,
): WelcomepayEasyPayCheckoutDefinition {
  const kind = id.slice(5) as WelcomepayEasyPayKind;
  return { id, ...EASY_PAY_BY_KIND[kind] };
}

/** PC 간편결제 다이렉트 — centerCd + cardonly */
export function buildWelcomepayEasyPayPcAcceptMethod(): string {
  return `${WELCOMEPAY_PC_ACCEPTMETHOD_CENTER}:cardonly`;
}

/** 모바일 간편결제 다이렉트 — centerCd + d_* (ISP 옵션 없이 PG 전용화면 호출) */
export function buildWelcomepayEasyPayMobileReserved(
  def: WelcomepayEasyPayCheckoutDefinition,
  useAmtHash = false,
): string {
  const base = buildWelcomepayMobileReservedBase(useAmtHash);
  return `${base}&${def.mobileDirectReserved}`;
}

/** 클라이언트 URL 쿼리용 — prepare 응답 methods와 동일 id 집합 */
export function resolveWelcomepayCheckoutMethodIdForClient(raw: unknown): WelcomepayCheckoutMethodId | "card" {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "card") return "card";
  if (isWelcomepayEasyPayCheckoutId(s) && resolveWelcomepayEasyPayEnabled()) return s;
  return "card";
}

export type WelcomepayCheckoutMethodId = WelcomepayMethodId | WelcomepayEasyPayCheckoutId;
