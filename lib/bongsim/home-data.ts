/** Display order for 인기국가(비즈니스 노출, 가나다순 아님, kr 없음). */
export const HOME_POPULAR_CODES: string[] = [
  "jp",
  "cn",
  "vn",
  "tw",
  "th",
  "my",
  "us",
  "hk",
  "id",
  "au",
  "ph",
  "gu",
  "nz",
  "sg",
  "fr",
  "de",
  "it",
  "es",
  "gb",
  "ca",
  "ch",
  "mo",
  "ae",
];

/** 인기국가 탭 첫 화면에 고정 노출(필수 포함 국가). */
export const RECOMMEND_POPULAR_CODES: string[] = [
  "jp",
  "cn",
  "vn",
  "tw",
  "th",
  "my",
  "us",
  "hk",
  "id",
  "au",
];

const FIRST = new Set(RECOMMEND_POPULAR_CODES);

/** 인기국가 '더보기'로 펼칠 나머지. */
export const RECOMMEND_POPULAR_MORE_CODES: string[] = HOME_POPULAR_CODES.filter((c) => !FIRST.has(c));
