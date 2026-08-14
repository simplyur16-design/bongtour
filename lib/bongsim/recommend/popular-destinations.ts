import type { CountryOption } from "@/lib/bongsim/types";
import { bongsimFlagIsoForDestination } from "@/lib/bongsim/recommend/destination-flag-image";
import { regionPackCarouselFlags } from "@/lib/bongsim/recommend/region-pack-carousel-flags";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

/** @deprecated `home-data` RECOMMEND_POPULAR_CODES 사용 */
export { RECOMMEND_POPULAR_CODES as RECOMMEND_POPULAR_COUNTRY_CODES } from "@/lib/bongsim/home-data";

/** 인기국가 EU → 2단계 `유럽 33개국` 다국가 eSIM (`rg-eu-33`) */
export const RECOMMEND_POPULAR_EUROPE_REGION_CODE = "rg-eu-33";

/** EU 국기 — `flags/iso/eu.webp` (다른 ISO 국기와 동일 NCloud manifest) */
export const RECOMMEND_POPULAR_EUROPE_FLAG_ISO = "eu";

export const RECOMMEND_EUROPE_PLAN_NAME = "유럽 33개국";

export {
  bongsimFlagIsoForDestination,
  destinationUsesFlagImage,
  resolveDestinationFlagImageUrl,
} from "@/lib/bongsim/recommend/destination-flag-image";

export function buildRecommendPopularEuropeTile(): CountryOption {
  return {
    code: RECOMMEND_POPULAR_EUROPE_REGION_CODE,
    nameKr: "유럽",
    subtitleKr: "33개국",
    flag: "",
    isRegion: true,
    searchTerms: ["europe", "유럽", "eu"],
  };
}

export function isRecommendPopularEuropeRegion(code: string): boolean {
  return code === RECOMMEND_POPULAR_EUROPE_REGION_CODE;
}

/**
 * GET /api/bongsim/country-heroes 맵.
 * · 유럽 패키지 → `eu` / `rg-eu-33` 공통 폴백
 * · 기타 `rg-*` → 대표 ISO · 캐러셀 커버 국가 히어로 폴백
 */
export function resolveBongsimCountryHeroUrl(
  code: string,
  heroMap: Record<string, string>,
): string | undefined {
  const lower = code.trim().toLowerCase();
  const direct = heroMap[lower]?.trim();
  if (direct) return direct;

  if (lower.startsWith("rg-eu-")) {
    const shared =
      heroMap[RECOMMEND_POPULAR_EUROPE_FLAG_ISO]?.trim() ||
      heroMap[RECOMMEND_POPULAR_EUROPE_REGION_CODE]?.trim();
    if (shared) return shared;
  }

  if (isRegionPackCode(lower)) {
    const iso = bongsimFlagIsoForDestination(lower);
    if (iso !== lower) {
      const byIso = heroMap[iso]?.trim();
      if (byIso) return byIso;
    }
    for (const c of regionPackCarouselFlags(lower)) {
      const hit = heroMap[c]?.trim();
      if (hit) return hit;
    }
  }

  return undefined;
}
