import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { extractSingleCountryCode, resolveMultiCoverage } from "@/lib/bongsim/plan-coverage-map";
import {
  planNameForRegionPackCode,
  REGION_PACK_PLAN_NAME_BY_CODE,
} from "@/lib/bongsim/recommend/region-pack-plan";
import { REGION_PACK_OPTIONS } from "@/lib/bongsim/region-packs";

function compact(s: string): string {
  return s.replace(/\s+/g, "");
}

/** `plan_name`(한글)과 일치하는 국가·권역 → 국기·표시명 */
export function countryDisplayFromPlanNameKr(planName: string): { flag: string; countryLabel: string } {
  const name = planName.trim();
  if (!name) return { flag: "📱", countryLabel: "eSIM" };

  const hit = COUNTRY_OPTIONS.find((c) => c.nameKr === name || compact(c.nameKr) === compact(name));
  if (hit) return { flag: hit.flag, countryLabel: hit.nameKr };

  const single = extractSingleCountryCode(name);
  if (single) {
    const byCode = COUNTRY_OPTIONS.find((c) => c.code === single);
    if (byCode) return { flag: byCode.flag, countryLabel: byCode.nameKr };
  }

  const multi = resolveMultiCoverage(name);
  if (multi?.length) {
    for (const [code, plan] of Object.entries(REGION_PACK_PLAN_NAME_BY_CODE)) {
      if (compact(plan) === compact(name)) {
        const pack = REGION_PACK_OPTIONS.find((r) => r.code === code);
        if (pack?.flag) {
          return { flag: pack.flag, countryLabel: planNameForRegionPackCode(code) ?? name };
        }
      }
    }
    const byCode = COUNTRY_OPTIONS.find((c) => c.code === multi[0]);
    if (byCode) return { flag: byCode.flag, countryLabel: name };
  }

  return { flag: "🌐", countryLabel: name };
}

export type AllowanceParse = { unlimited: boolean; capMb: number | null };

/** 용량 표시·진행률용 (대략적). */
export function parseAllowanceLabel(allowanceLabel: string): AllowanceParse {
  const s = allowanceLabel.trim().toLowerCase();
  if (!s) return { unlimited: false, capMb: null };
  if (s.includes("무제한") || s.includes("unlimited")) {
    return { unlimited: true, capMb: null };
  }
  const gb = allowanceLabel.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gb) {
    return { unlimited: false, capMb: Math.round(Number.parseFloat(gb[1]) * 1024) };
  }
  const mb = allowanceLabel.match(/(\d+(?:\.\d+)?)\s*mb/i);
  if (mb) {
    return { unlimited: false, capMb: Math.round(Number.parseFloat(mb[1])) };
  }
  return { unlimited: false, capMb: null };
}
