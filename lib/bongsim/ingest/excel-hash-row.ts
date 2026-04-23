import { createHash } from "node:crypto";

/**
 * Stable hash for dedupe + `bongsim_product_option_price_event.row_hash`.
 * Server-only (Node crypto).
 */
export function hashExcelRowStable(input: Record<string, unknown>): string {
  const normalized = stableStringify(input);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
