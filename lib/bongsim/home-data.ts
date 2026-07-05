/**
 * 2025년 한국인 해외여행 목적지 순위 (한국관광공사·출입국 통계 기준).
 * 일본 ~946만, 베트남 ~433만, 중국 ~316만, 미국 ~165만, 태국 ~156만 …
 * @see https://datalab.visitkorea.or.kr (국민 해외관광객 주요 목적지별 통계)
 */
export const KOREAN_OUTBOUND_TRAVEL_RANK_2025: readonly string[] = [
  "jp", // 1 일본
  "vn", // 2 베트남
  "cn", // 3 중국
  "us", // 4 미국
  "th", // 5 태국
  "ph", // 6 필리핀
  "tw", // 7 대만
  "my", // 8 말레이시아
  "id", // 9 인도네시아
  "hk", // 10 홍콩
  "sg", // 11 싱가포르
  "au", // 12 호주
  "gu", // 13 괌
  "mo", // 14 마카오
  "nz", // 15 뉴질랜드
  "fr", // 16 프랑스
  "it", // 17 이탈리아
  "es", // 18 스페인
  "gb", // 19 영국
  "de", // 20 독일
  "ca", // 21 캐나다
  "ch", // 22 스위스
  "ae", // 23 UAE
  "kr", // 외국인 선물용
] as const;

/** @deprecated `KOREAN_OUTBOUND_TRAVEL_RANK_2025` 사용 */
export const HOME_POPULAR_CODES: string[] = [...KOREAN_OUTBOUND_TRAVEL_RANK_2025];

/** 인기국가 탭 첫 화면 — 2025 순위 상위 11개 + 더보기 */
export const RECOMMEND_POPULAR_CODES: string[] = KOREAN_OUTBOUND_TRAVEL_RANK_2025.slice(0, 11);

const FIRST = new Set(RECOMMEND_POPULAR_CODES);

/** 인기국가 '더보기'로 펼칠 나머지 (2025 순위 12위~) */
export const RECOMMEND_POPULAR_MORE_CODES: string[] = KOREAN_OUTBOUND_TRAVEL_RANK_2025.filter(
  (c) => !FIRST.has(c),
);
