import { KOREAN_OUTBOUND_TRAVEL_RANK_2025 } from "@/lib/bongsim/home-data";

const RANK_INDEX = new Map(
  KOREAN_OUTBOUND_TRAVEL_RANK_2025.map((code, index) => [code.trim().toLowerCase(), index]),
);

/** 2025 한국인 해외여행 목적지 순위 — 없으면 맨 뒤 */
export function koreanTravelRankIndex(code: string): number {
  return RANK_INDEX.get(code.trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
}

/** 한국관광공사·출입국 통계 기반 2025 인기순 (동순위는 가나다) */
export function sortByKoreanTravelRank2025<T extends { code: string; nameKr?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const diff = koreanTravelRankIndex(a.code) - koreanTravelRankIndex(b.code);
    if (diff !== 0) return diff;
    return (a.nameKr ?? a.code).localeCompare(b.nameKr ?? b.code, "ko");
  });
}
