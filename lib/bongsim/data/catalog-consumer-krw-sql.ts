/**
 * 카탈로그 목록·by-country·plans — 전체 price_block JSON 대신 유효 소비자가만 추출.
 * REGRESSION-FREEZE[bongsim-catalog-list-perf]: slim consumer extract — manifest
 * REGRESSION-FREEZE[bongsim-price-effective-from]: before/after 컷오버 — manifest
 */

/** after/before 쪽 consumer_krw 숫자 추출 */
const SIDE_CONSUMER = (side: "'after'" | "'before'") => `CASE
  WHEN jsonb_typeof(price_block->${side}->'consumer_krw') = 'number'
    THEN (price_block->${side}->>'consumer_krw')::float8
  WHEN jsonb_typeof(price_block->${side}->'consumer_krw') = 'string'
       AND (price_block->${side}->>'consumer_krw') ~ '^[0-9]+([.][0-9]+)?$'
    THEN (price_block->${side}->>'consumer_krw')::float8
  ELSE NULL
END`;

const SIDE_SUPPLY = (side: "'after'" | "'before'") => `CASE
  WHEN jsonb_typeof(price_block->${side}->'supply_krw') = 'number'
    THEN (price_block->${side}->>'supply_krw')::float8
  WHEN jsonb_typeof(price_block->${side}->'supply_krw') = 'string'
       AND (price_block->${side}->>'supply_krw') ~ '^[0-9]+([.][0-9]+)?$'
    THEN (price_block->${side}->>'supply_krw')::float8
  ELSE NULL
END`;

/**
 * `effective_from` 이 있고 now < 그 시각이면 before, 아니면 after.
 * after가 비면 before 폴백(반대도).
 */
export const BONGSIM_CATALOG_CONSUMER_KRW_SQL = `CASE
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
       AND now() < (price_block->>'effective_from')::timestamptz
    THEN COALESCE(${SIDE_CONSUMER("'before'")}, ${SIDE_CONSUMER("'after'")})
  ELSE COALESCE(${SIDE_CONSUMER("'after'")}, ${SIDE_CONSUMER("'before'")})
END`;

/** 공급 원가 — 어드민 피커·할인 리포트용 (공개 plans는 consumer만) */
export const BONGSIM_CATALOG_SUPPLY_KRW_SQL = `CASE
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
       AND now() < (price_block->>'effective_from')::timestamptz
    THEN COALESCE(${SIDE_SUPPLY("'before'")}, ${SIDE_SUPPLY("'after'")})
  ELSE COALESCE(${SIDE_SUPPLY("'after'")}, ${SIDE_SUPPLY("'before'")})
END`;

/** SELECT 절용 — slim price_block(after.consumer_krw만 = 이미 컷오버 반영된 값) */
export const BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL = `jsonb_build_object(
  'after', jsonb_build_object('consumer_krw', ${BONGSIM_CATALOG_CONSUMER_KRW_SQL})
)`;

/**
 * 어드민 무상 eSIM·오프라인 USIM 피커 — consumer + supply.
 * REGRESSION-FREEZE[bongsim-offline-usim-plan-picker]: admin slim price with supply — manifest
 */
export const BONGSIM_CATALOG_SLIM_PRICE_BLOCK_WITH_SUPPLY_SQL = `jsonb_build_object(
  'after', jsonb_build_object(
    'consumer_krw', ${BONGSIM_CATALOG_CONSUMER_KRW_SQL},
    'supply_krw', ${BONGSIM_CATALOG_SUPPLY_KRW_SQL}
  )
)`;
