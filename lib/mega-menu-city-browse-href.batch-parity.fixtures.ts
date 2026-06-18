/**
 * PR B6 parity fixtures — production snapshot 2026-06-18 (getCurrentCycle pool).
 */
export const PRODUCTION_SEASON_POOL_13_CITY_KEYS = [
  'danang',
  'tokyo',
  'sydney',
  'ch',
  'nhatrang',
  'singapore',
  'guam',
  'at',
  'cz',
  'it',
  'taipei',
  'bangkok',
  'shanghai',
] as const

/** UI leaf miss — MegaMenuGroupCardCity only (production DB sample) */
export const CARD_ONLY_CITY_KEY = 'jinan'

/** 일본 현·도 menuGroup leaf (href에 menuGroup 포함) */
export const JAPAN_MENU_GROUP_CITY_KEY = 'tokyo'

/** multi-card cityKey — sortOrder asc 첫 row (production DB: 2 cards) */
export const MULTI_CARD_CITY_KEY = 'wakayama'

/** country-only mega menu leaf → city 쿼리 없음 (LC 이탈리아) */
export const COUNTRY_ONLY_LEAF_CITY_KEY = 'it'

export const UNKNOWN_CITY_KEY = '__mega_menu_batch_unknown_city_key__'

export const BATCH_PARITY_FIXTURE_GROUPS = [
  { label: 'production season pool (13)', keys: [...PRODUCTION_SEASON_POOL_13_CITY_KEYS] },
  { label: 'card-only UI miss', keys: [CARD_ONLY_CITY_KEY] },
  { label: 'japan menuGroup leaf', keys: [JAPAN_MENU_GROUP_CITY_KEY] },
  { label: 'multi-card sortOrder tie-break', keys: [MULTI_CARD_CITY_KEY] },
  { label: 'country-only leaf', keys: [COUNTRY_ONLY_LEAF_CITY_KEY] },
  { label: 'unknown cityKey', keys: [UNKNOWN_CITY_KEY] },
] as const

export const ALL_BATCH_PARITY_FIXTURE_KEYS = [
  ...new Set(BATCH_PARITY_FIXTURE_GROUPS.flatMap((g) => g.keys)),
] as const
