import type { BongsimPriceBlockV1, BongsimProductFlagsV1 } from "@/lib/bongsim/contracts/product-master.v1";

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parsePriceBlockJson(value: unknown): BongsimPriceBlockV1 {
  if (!value || typeof value !== "object") {
    return {
      before: { consumer_krw: null, recommended_krw: null, supply_krw: null },
      after: { consumer_krw: null, recommended_krw: null, supply_krw: null },
    };
  }
  const o = value as Record<string, unknown>;
  const b = (o.before && typeof o.before === "object" ? o.before : {}) as Record<string, unknown>;
  const a = (o.after && typeof o.after === "object" ? o.after : {}) as Record<string, unknown>;
  return {
    before: {
      consumer_krw: numOrNull(b.consumer_krw),
      recommended_krw: numOrNull(b.recommended_krw),
      supply_krw: numOrNull(b.supply_krw),
    },
    after: {
      consumer_krw: numOrNull(a.consumer_krw),
      recommended_krw: numOrNull(a.recommended_krw),
      supply_krw: numOrNull(a.supply_krw),
    },
  };
}

function flagStr(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

export function parseFlagsJson(value: unknown): BongsimProductFlagsV1 {
  const o = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    kyc: flagStr(o.kyc),
    hotspot: flagStr(o.hotspot),
    esim: flagStr(o.esim),
    usim: flagStr(o.usim),
    request_shipment: flagStr(o.request_shipment),
    status_check: flagStr(o.status_check),
    extension_iccid_topup: flagStr(o.extension_iccid_topup),
  };
}

export function parseRawRowJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
