import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { parseAllowance, type ParsedAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { extractPlanFeatures, type PlanFeatures } from "@/lib/bongsim/recommend/score-plan";

function getPlanFeatures(option: BongsimProductOptionV1): PlanFeatures {
  return extractPlanFeatures(option);
}

/** mb → "2GB" / "1.5GB" / "500MB" 표기 */
export function formatGbOrMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "";
  if (mb >= 1024) {
    const gb = mb / 1024;
    const decimals = mb % 1024 === 0 ? 0 : 1;
    return `${gb.toFixed(decimals)}GB`;
  }
  return `${Math.round(mb)}MB`;
}

function effectiveMultiCountryCount(opts?: {
  coveredCountryCount?: number;
  isMultiCountry?: boolean;
}): number | null {
  if (!opts?.isMultiCountry) return null;
  const n = opts.coveredCountryCount;
  if (n == null || !Number.isFinite(n)) return null;
  const k = Math.floor(n);
  if (k <= 0) return null;
  return k;
}

export type RecommendationLabelKind =
  | "true_unlimited"
  | "unlimited"
  | "high_daily"
  | "none";

export type RecommendationDisplay = {
  kind: RecommendationLabelKind;
  label: string;
  subCopy: string;
};

export function getRecommendationDisplay(
  option: BongsimProductOptionV1 | null,
  opts?: {
    coveredCountryCount?: number;
    isMultiCountry?: boolean;
  },
): RecommendationDisplay {
  if (option == null) {
    return { kind: "none", label: "", subCopy: "" };
  }

  const features = getPlanFeatures(option);
  const mc = effectiveMultiCountryCount(opts);
  const useMulti = mc != null;

  if (features.isUnlimited) {
    if (features.generation === "g5" && features.isLocal) {
      return {
        kind: "true_unlimited",
        label: "진짜무제한",
        subCopy: useMulti ? `5G · 현지망 · ${mc}개국 한 장으로` : "5G · 현지직접망에서 끊김 없이",
      };
    }
    if (features.generation === "g5" && !features.isLocal && features.qosKbps != null && features.qosKbps >= 5000) {
      return {
        kind: "true_unlimited",
        label: "진짜무제한",
        subCopy: useMulti ? `5G · ${mc}개국 끊김 없이` : "5G로 빠르게, 사용량 걱정 없이",
      };
    }
    if ((features.generation === "g5" || features.generation === "g4_lte") && features.isLocal) {
      return {
        kind: "unlimited",
        label: "무제한",
        subCopy: useMulti ? `현지망 · ${mc}개국 안정적으로` : "현지망에서 안정적으로",
      };
    }
    return {
      kind: "unlimited",
      label: "무제한",
      subCopy: useMulti ? `${mc}개국 데이터 걱정 없이` : "데이터 걱정 없이",
    };
  }

  const allowance: ParsedAllowance = parseAllowance(option.allowance_label);
  if (allowance.kind === "mb" && allowance.mb > 0) {
    const cap = formatGbOrMb(allowance.mb);
    return {
      kind: "high_daily",
      label: "고용량 매일",
      subCopy: useMulti ? `매일 ${cap} · ${mc}개국 부족함 없이` : `매일 ${cap} · 부족함 없이`,
    };
  }

  return {
    kind: "none",
    label: option.plan_name,
    subCopy: option.allowance_label ?? "",
  };
}
