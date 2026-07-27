/**
 * 웰컴페이먼츠 checkout prepare — 신용카드 + 간편결제 옵션 빌드 (server-only).
 * REGRESSION-FREEZE[welcomepay-esim-payment]: easy pay direct call after merchant approval — manifest
 */
import "server-only";

import {
  buildWelcomepayMobileReserved,
  buildWelcomepayPcAcceptMethod,
  getWelcomepayMethodDefinition,
  listWelcomepayCheckoutMethods,
  type WelcomepayMethodDefinition,
  type WelcomepayMethodId,
  WELCOMEPAY_CHECKOUT_METHOD_DEFAULT,
} from "@/lib/bongsim/welcomepay-payment-methods";
import {
  buildWelcomepayEasyPayMobileReserved,
  buildWelcomepayEasyPayPcAcceptMethod,
  getWelcomepayEasyPayCheckoutDefinition,
  isWelcomepayEasyPayCheckoutId,
  listWelcomepayEasyPayCheckoutDefinitions,
  type WelcomepayEasyPayCheckoutDefinition,
  type WelcomepayEasyPayCheckoutId,
} from "@/lib/bongsim/welcomepay-easy-pay";
import { welcomepayMobileSubmitUrlForPath } from "@/lib/bongsim/welcomepay";

export type WelcomepayCheckoutMethodId = WelcomepayMethodId | WelcomepayEasyPayCheckoutId;

export type WelcomepayCheckoutMethodOption = {
  id: WelcomepayCheckoutMethodId;
  label: string;
  mobile: {
    submitUrl: string;
    pIniPayment: string;
    pReserved: string;
    requiresNotiUrl: boolean;
    requiresHppMethod: boolean;
  };
  pc: {
    goPayMethod: string;
    acceptMethod: string;
  };
};

function baseMethodToCheckoutOption(
  def: WelcomepayMethodDefinition,
  useAmtHash: boolean,
  now: Date,
): WelcomepayCheckoutMethodOption {
  return {
    id: def.id,
    label: def.label,
    mobile: {
      submitUrl: welcomepayMobileSubmitUrlForPath(def.mobilePath),
      pIniPayment: def.pIniPayment,
      pReserved: buildWelcomepayMobileReserved(def, useAmtHash, now),
      requiresNotiUrl: def.requiresNotiUrl,
      requiresHppMethod: def.requiresHppMethod,
    },
    pc: {
      goPayMethod: def.pcGoPayMethod,
      acceptMethod: buildWelcomepayPcAcceptMethod(def.id, now),
    },
  };
}

function easyMethodToCheckoutOption(
  def: WelcomepayEasyPayCheckoutDefinition,
  useAmtHash: boolean,
): WelcomepayCheckoutMethodOption {
  return {
    id: def.id,
    label: def.label,
    mobile: {
      submitUrl: welcomepayMobileSubmitUrlForPath(def.mobilePath),
      pIniPayment: def.pIniPayment,
      pReserved: buildWelcomepayEasyPayMobileReserved(def, useAmtHash),
      requiresNotiUrl: def.requiresNotiUrl,
      requiresHppMethod: def.requiresHppMethod,
    },
    pc: {
      goPayMethod: def.pcGoPayMethod,
      acceptMethod: buildWelcomepayEasyPayPcAcceptMethod(),
    },
  };
}

/** 신용카드 + 승인된 간편결제(prepare·결제 UI SSOT) */
export function listWelcomepayAllCheckoutMethodOptions(
  useAmtHash = false,
  now = new Date(),
): readonly WelcomepayCheckoutMethodOption[] {
  const base = listWelcomepayCheckoutMethods().map((def) => baseMethodToCheckoutOption(def, useAmtHash, now));
  const easy = listWelcomepayEasyPayCheckoutDefinitions().map((def) => easyMethodToCheckoutOption(def, useAmtHash));
  return [...base, ...easy];
}

export function resolveWelcomepayCheckoutMethodId(raw: unknown): WelcomepayCheckoutMethodId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const options = listWelcomepayAllCheckoutMethodOptions();
  if (s && options.some((m) => m.id === s)) return s as WelcomepayCheckoutMethodId;
  return WELCOMEPAY_CHECKOUT_METHOD_DEFAULT;
}

export function getWelcomepayCheckoutMethodDefinition(
  id: WelcomepayCheckoutMethodId,
): WelcomepayMethodDefinition | WelcomepayEasyPayCheckoutDefinition {
  if (isWelcomepayEasyPayCheckoutId(id)) return getWelcomepayEasyPayCheckoutDefinition(id);
  return getWelcomepayMethodDefinition(id);
}
