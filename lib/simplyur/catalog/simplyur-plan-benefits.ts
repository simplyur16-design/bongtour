import { esimHasFreeData } from "@/lib/bongsim/constants";
import type { SimplyurLocale } from "@/lib/simplyur/constants";

/**
 * Simplyur-only plan benefit fields (additive, optional on the simplyur product API).
 * Sources are code constants — no DB column, no change to the shared bongsim product table/output.
 *
 * - free_apps_data: Google Maps · ChatGPT data not counted. Same rule bongsim already uses
 *   (`esimHasFreeData`: roaming network + plan_name whitelist in lib/bongsim/constants.ts), read-only.
 * - hotspot_note: owner wording (ko SSOT below), localized per simplyur locale. Applies to all Korea plans.
 * - unused_refund: existing Refund & Service Policy ("Unused QR (not activated): full refund available",
 *   lib/simplyur/legal-document-en.tsx). Copy must point to that policy; no new refund terms here.
 */

/** 사장님 원문 (2026-11-17) — 다른 언어는 같은 뜻으로만 옮긴다. */
export const SIMPLYUR_HOTSPOT_NOTE_KO = "핫스팟 사용 가능(통신사 정책에 따라 제한될 수 있음)";

export const SIMPLYUR_HOTSPOT_NOTE: Record<SimplyurLocale, string> = {
  en: "Hotspot available (may be limited by carrier policy)",
  ja: "テザリング可（通信会社の方針により制限される場合があります）",
  zh: "支持热点共享（可能因运营商政策受限）",
  "zh-TW": "可開熱點分享（可能依電信業者政策受限）",
  vi: "Phát được hotspot (có thể bị giới hạn theo chính sách nhà mạng)",
};

/** Refund & Service Policy: unused (not activated) QR → full refund. Flag only; wording lives in the policy. */
export const SIMPLYUR_UNUSED_REFUND_POLICY = true;

export type SimplyurPlanBenefits = {
  /** Google Maps & ChatGPT data free (not counted toward the plan). */
  free_apps_data: boolean;
  /** Localized hotspot line, same meaning as SIMPLYUR_HOTSPOT_NOTE_KO. */
  hotspot_note: string;
  /** Unused (not activated) eSIM is refundable per the existing refund policy. */
  unused_refund: boolean;
};

export function simplyurPlanBenefits(
  product: { network_family?: string | null; plan_name?: string | null },
  locale: SimplyurLocale,
): SimplyurPlanBenefits {
  return {
    free_apps_data: esimHasFreeData(product.network_family ?? undefined, product.plan_name ?? undefined),
    hotspot_note: SIMPLYUR_HOTSPOT_NOTE[locale] ?? SIMPLYUR_HOTSPOT_NOTE.en,
    unused_refund: SIMPLYUR_UNUSED_REFUND_POLICY,
  };
}
