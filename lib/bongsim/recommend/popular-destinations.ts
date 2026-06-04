import type { CountryOption } from "@/lib/bongsim/types";

/** eSIM 추천 Step1 — 인기 여행지 (단독 플랜 API에 있는 국가만 노출) */
export const RECOMMEND_POPULAR_COUNTRY_CODES = [
  "jp",
  "tw",
  "vn",
  "th",
  "hk",
  "sg",
  "us",
  "cn",
  "ph",
] as const;

/** 인기 여행지 EU → 2단계 `유럽 33개국` 다국가 eSIM (`rg-eu-33`) */
export const RECOMMEND_POPULAR_EUROPE_REGION_CODE = "rg-eu-33";

export const RECOMMEND_EUROPE_PLAN_NAME = "유럽 33개국";

export function buildRecommendPopularEuropeTile(): CountryOption {
  return {
    code: RECOMMEND_POPULAR_EUROPE_REGION_CODE,
    nameKr: "유럽",
    subtitleKr: "33개국",
    flag: "🇪🇺",
    isRegion: true,
    searchTerms: ["europe", "유럽", "eu"],
  };
}

export function isRecommendPopularEuropeRegion(code: string): boolean {
  return code === RECOMMEND_POPULAR_EUROPE_REGION_CODE;
}
