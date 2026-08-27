/**
 * eSIM 「찾기」 SSOT = 랜딩 `#esim-countries` (BongsimHomeMobile).
 * 예전 `/recommend` Step1 CountrySelectStep 으로 보내지 않는다.
 * REGRESSION-FREEZE[bongsim-esim-hero-country-picker-landing]: 히어로→랜딩 피커 — manifest
 */

import { bongsimCountryPickerHref, bongsimPath } from "@/lib/bongsim/constants";

export function shouldRedirectRecommendToLandingPicker(opts: {
  fromCheckout: boolean;
  countryCode: string | null;
}): boolean {
  if (opts.fromCheckout) return false;
  if (opts.countryCode) return false;
  return true;
}

export function esimCountryPickerBackAction(opts: {
  referrer: string;
  currentOrigin: string;
}): "history-back" | "assign-picker" {
  try {
    const refRaw = opts.referrer.trim();
    if (!refRaw) return "assign-picker";
    const ref = new URL(refRaw);
    if (ref.origin !== opts.currentOrigin) return "assign-picker";
    const refPath = ref.pathname.replace(/\/$/, "") || "/";
    const landPath = bongsimPath().replace(/\/$/, "") || "/";
    if (refPath === landPath) return "history-back";
  } catch {
    /* ignore */
  }
  return "assign-picker";
}

export function navigateToEsimCountryPicker(mode: "assign" | "replace"): void {
  const href = bongsimCountryPickerHref();
  if (mode === "replace") {
    window.location.replace(href);
    return;
  }
  window.location.assign(href);
}