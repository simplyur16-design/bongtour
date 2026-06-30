import { isEsimCapableSimKind } from "@/lib/bongsim/catalog/active-product-sql";

/** REGRESSION-FREEZE[bongsim-usim-fulfillment]: eSIM vs 물리 USIM 이행 모드 SSOT — manifest */
export type BongsimFulfillmentMode = "esim" | "usim";

export function parseFulfillmentMode(raw: unknown): BongsimFulfillmentMode {
  return raw === "usim" ? "usim" : "esim";
}

/** DB `sim_kind` — 물리 USIM(플랜 미설정 카드) 활성화 가능 여부 */
export function isUsimCapableSimKind(simKind: string | null | undefined): boolean {
  const s = (simKind ?? "").trim().toLowerCase();
  if (!s) return false;
  return s.includes("usim");
}

export function supportsEsimFulfillment(simKind: string | null | undefined): boolean {
  return isEsimCapableSimKind(simKind);
}

export function supportsUsimFulfillment(simKind: string | null | undefined): boolean {
  return isUsimCapableSimKind(simKind);
}

/** ICCID — 숫자만 19~20자리(일반적인 물리·eSIM ICCID 길이). */
export function normalizeIccid(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 19 || digits.length > 20) return null;
  return digits;
}

export function validateCustomerIccidsForQuantity(
  quantity: number,
  rawIccids: string[] | undefined,
): { ok: true; iccids: string[] } | { ok: false; code: string } {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, code: "invalid_quantity" };
  }
  if (!Array.isArray(rawIccids) || rawIccids.length !== quantity) {
    return { ok: false, code: "iccids_count_mismatch" };
  }
  const iccids: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawIccids) {
    if (typeof raw !== "string") return { ok: false, code: "invalid_iccid" };
    const norm = normalizeIccid(raw);
    if (!norm) return { ok: false, code: "invalid_iccid" };
    if (seen.has(norm)) return { ok: false, code: "duplicate_iccid" };
    seen.add(norm);
    iccids.push(norm);
  }
  return { ok: true, iccids };
}
