import { resolveMultiCoverage } from "@/lib/bongsim/plan-coverage-map";
import { planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

/** coverage SSOT에 없는 rg-* 폴백 */
const CAROUSEL_OVERRIDES: Record<string, string[]> = {
  "rg-nafr-4": ["eg", "ma", "tn", "dz"],
};

/** 유럽·글로벌 단일 국기 제외 — 캐러셀용 ISO 목록 */
export function regionPackCarouselFlags(code: string): string[] {
  const lc = code.trim().toLowerCase();
  if (lc.startsWith("rg-eu-") || lc === "rg-global-151") return [];

  const override = CAROUSEL_OVERRIDES[lc];
  if (override?.length) return override;

  const planName = planNameForRegionPackCode(lc);
  if (!planName) return [];

  const coverage = resolveMultiCoverage(planName);
  return coverage?.length ? coverage : [];
}
