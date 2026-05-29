import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

function parseMbpsFromQos(qos_raw: string | null | undefined): number | null {
  const low = (qos_raw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]!);
    return Number.isFinite(n) ? n / 1000 : null;
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) {
    const n = parseFloat(mb[1]!);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatMbpsLabel(qos_raw: string | null | undefined): string {
  const m = parseMbpsFromQos(qos_raw);
  if (m == null) return "—";
  const rounded = m >= 1 ? String(Math.round(m)) : m.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}Mbps`;
}

/** 플랜 카드 옵션 라벨 SSOT — 속도(qos_raw) 포함 */
export function formatPlanOptionLabel(
  product: Pick<ProductOption, "plan_type" | "allowance_label" | "qos_raw">,
): string {
  const pt = (product.plan_type || "").trim().toLowerCase();
  const allowance = (product.allowance_label || "").trim() || "—";
  const qos = (product.qos_raw || "").trim() || "—";

  switch (pt) {
    case "unlimited":
      return `무제한·최대 ${formatMbpsLabel(product.qos_raw)}`;
    case "daily":
      return `매일 ${allowance}·소진 후 ${qos}`;
    case "fixed":
      return `총 ${allowance}·${qos}`;
    default:
      return allowance;
  }
}
