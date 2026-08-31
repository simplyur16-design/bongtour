/**
 * 카탈로그 목록·by-country·plans — 전체 price_block JSON 대신 유효 판매가만 추출.
 * 봉투어 정가 = 공급가×5/3 (10원 올림). 없으면 권장판매가·소비자가.
 * slim 필드명은 호환용 consumer_krw.
 * REGRESSION-FREEZE[bongsim-catalog-list-perf]: slim consumer extract — manifest
 * REGRESSION-FREEZE[bongsim-price-effective-from]: before/after 컷오버 — manifest
 */
import { resolveBongsimPriceEffectiveFrom } from "@/lib/bongsim/data/pricing-effective-from";

/** after/before 쪽 숫자 추출 */
const SIDE_NUM = (side: "'after'" | "'before'", field: "consumer_krw" | "recommended_krw" | "supply_krw") => `CASE
  WHEN jsonb_typeof(price_block->${side}->'${field}') = 'number'
    THEN (price_block->${side}->>'${field}')::float8
  WHEN jsonb_typeof(price_block->${side}->'${field}') = 'string'
       AND (price_block->${side}->>'${field}') ~ '^[0-9]+([.][0-9]+)?$'
    THEN (price_block->${side}->>'${field}')::float8
  ELSE NULL
END`;

const SIDE_CONSUMER = (side: "'after'" | "'before'") => SIDE_NUM(side, "consumer_krw");
const SIDE_RECOMMENDED = (side: "'after'" | "'before'") => SIDE_NUM(side, "recommended_krw");
const SIDE_SUPPLY = (side: "'after'" | "'before'") => SIDE_NUM(side, "supply_krw");
const SIDE_LIST_FROM_SUPPLY = (side: "'after'" | "'before'") =>
  `CEIL((${SIDE_SUPPLY(side)} * 5.0 / 3.0) / 10.0) * 10`;
const SIDE_SELL = (side: "'after'" | "'before'") =>
  `COALESCE(${SIDE_LIST_FROM_SUPPLY(side)}, ${SIDE_RECOMMENDED(side)}, ${SIDE_CONSUMER(side)})`;

/** 심플리유어 — USIMSA 소비자가만 (봉투어 5/3 정가 미적용) */
export const BONGSIM_CATALOG_USIMSA_CONSUMER_KRW_SQL = `CASE
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
       AND now() < (price_block->>'effective_from')::timestamptz
    THEN ${SIDE_CONSUMER("'before'")}
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
    THEN ${SIDE_CONSUMER("'after'")}
  ELSE COALESCE(${SIDE_CONSUMER("'after'")}, ${SIDE_CONSUMER("'before'")})
END`;

/**
 * `effective_from` 이 있고 now < 그 시각이면 **before만** (after 폴백 금지 — 신규국 조기 노출 방지).
 * 컷오버 후면 **after만** (20260316 before 폴백 금지).
 * 스탬프 없으면 after, 없으면 before.
 */
export const BONGSIM_CATALOG_CONSUMER_KRW_SQL = `CASE
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
       AND now() < (price_block->>'effective_from')::timestamptz
    THEN ${SIDE_SELL("'before'")}
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
    THEN ${SIDE_SELL("'after'")}
  ELSE COALESCE(${SIDE_SELL("'after'")}, ${SIDE_SELL("'before'")})
END`;

/** 공급 원가 — 어드민 피커·할인 리포트용 (공개 plans는 consumer만) */
export const BONGSIM_CATALOG_SUPPLY_KRW_SQL = `CASE
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
       AND now() < (price_block->>'effective_from')::timestamptz
    THEN ${SIDE_SUPPLY("'before'")}
  WHEN nullif(btrim(price_block->>'effective_from'), '') IS NOT NULL
    THEN ${SIDE_SUPPLY("'after'")}
  ELSE COALESCE(${SIDE_SUPPLY("'after'")}, ${SIDE_SUPPLY("'before'")})
END`;

/**
 * 지금 판매 가능한 정가(공급가×5/3 또는 권장·소비자가)가 있는 옵션만 (9/1 컷오버 전 after-only 스케줄 SKU 제외).
 * REGRESSION-FREEZE[bongsim-price-effective-from]: catalog sellable gate — manifest
 */
export const BONGSIM_CATALOG_SELLABLE_NOW_WHERE = `(${BONGSIM_CATALOG_CONSUMER_KRW_SQL}) IS NOT NULL`;

/**
 * 9/1 오픈 예정 「신규 상품」은 before가 새어도 컷오버 전까지 국가카드·카탈로그에서 제외.
 * REGRESSION-FREEZE[bongsim-price-effective-from]: hide scheduled new-country SKUs — manifest
 */
export const BONGSIM_CATALOG_NOT_SCHEDULED_NEW_SKU_WHERE = `NOT (
  COALESCE(excel_update_type, '') = '신규 상품'
  AND now() < '${resolveBongsimPriceEffectiveFrom()}'::timestamptz
)`;

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
