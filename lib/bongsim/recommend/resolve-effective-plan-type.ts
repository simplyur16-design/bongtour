import { isTrueUnlimited } from "@/lib/bongsim/recommend/product-option";

export type EffectivePlanType = "unlimited" | "daily" | "fixed";

export type PlanTypeSource = {
  plan_type?: string | null;
  network_family?: string | null;
  allowance_label?: string | null;
  option_label?: string | null;
};

/**
 * DB `plan_type` — 로컬 시트(엑셀 `plan_line_excel=로컬`)는 ingest 시 null.
 * 추천·plans API에서는 용량·옵션 라벨로 daily/unlimited 로 해석한다.
 */
export function resolveEffectivePlanType(row: PlanTypeSource): EffectivePlanType | null {
  const pt = (row.plan_type ?? "").trim().toLowerCase();
  if (pt === "unlimited" || pt === "daily" || pt === "fixed") return pt;

  const nf = (row.network_family ?? "").trim().toLowerCase();
  if (nf !== "local") return null;

  if (isTrueUnlimited(row)) return "unlimited";

  const optionLabel = (row.option_label ?? "").trim();
  if (optionLabel.includes("매일")) return "daily";

  const allowance = (row.allowance_label ?? "").trim().toLowerCase().replace(/\s/g, "");
  if (/(\d+)(mb|gb)/i.test(allowance)) return "daily";

  return "daily";
}
