/**
 * 카탈로그 목록·by-country·plans — 전체 price_block JSON 대신 after.consumer_krw 만 추출.
 * REGRESSION-FREEZE[bongsim-catalog-list-perf]: slim consumer extract — manifest
 */
export const BONGSIM_CATALOG_CONSUMER_KRW_SQL = `CASE
  WHEN jsonb_typeof(price_block->'after'->'consumer_krw') = 'number'
    THEN (price_block->'after'->>'consumer_krw')::float8
  WHEN jsonb_typeof(price_block->'after'->'consumer_krw') = 'string'
       AND (price_block->'after'->>'consumer_krw') ~ '^[0-9]+([.][0-9]+)?$'
    THEN (price_block->'after'->>'consumer_krw')::float8
  ELSE NULL
END`;

/** SELECT 절용 — slim price_block(after.consumer_krw만) */
export const BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL = `jsonb_build_object(
  'after', jsonb_build_object('consumer_krw', ${BONGSIM_CATALOG_CONSUMER_KRW_SQL})
)`;
