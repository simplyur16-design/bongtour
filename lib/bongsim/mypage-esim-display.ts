import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";

/** `plan_name`(한글)과 일치하는 국가 옵션 → 국기·표시명 */
export function countryDisplayFromPlanNameKr(planName: string): { flag: string; countryLabel: string } {
  const name = planName.trim();
  if (!name) return { flag: "📱", countryLabel: "eSIM" };
  const hit = COUNTRY_OPTIONS.find((c) => c.nameKr === name);
  if (hit) return { flag: hit.flag, countryLabel: hit.nameKr };
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
