/**
 * base + 출발 카드 → 파생 상품 페이로드. 카드 1개 = 파생 1개 (바우처는 option_badges만).
 */
import { createHash } from 'crypto'
import {
  HANJINTOUR_ORIGIN_SOURCE,
  HANJINTOUR_SUPPLIER_KEY,
  type HanjintourBaseParsedProduct,
  type HanjintourDepartureCardSnapshot,
  type HanjintourDerivedRegisterPayload,
  type HanjintourScrapeSnapshot,
} from '@/DEV/lib/hanjintour-types'

function fingerprintCardText(card: HanjintourDepartureCardSnapshot): string {
  return createHash('sha256').update(card.raw_card_text, 'utf8').digest('hex').slice(0, 24)
}

/** base group: 정규화 상품명 + 가능 시 상품코드 */
export function buildHanjintourBaseGroupKey(base: HanjintourBaseParsedProduct): string {
  const code = (base.product_code ?? 'nocode').trim()
  const title = (base.product_title_normalized ?? base.product_title ?? 'notitle')
    .trim()
    .slice(0, 200)
  return `${HANJINTOUR_SUPPLIER_KEY}:${code}:${title}`
}

/**
 * 파생 상품 고유키 — 바우처 문자열은 키에 넣지 않는다(카드 텍스트/인덱스·항공·일정으로 구분).
 */
export function buildHanjintourDerivedProductKey(
  base: HanjintourBaseParsedProduct,
  card: HanjintourDepartureCardSnapshot
): string {
  const parts = [
    HANJINTOUR_SUPPLIER_KEY,
    base.product_code ?? '',
    base.product_title_normalized ?? base.product_title ?? '',
    card.selected_departure_date ?? '',
    card.departure_datetime ?? '',
    card.return_datetime ?? '',
    String(card.trip_nights ?? ''),
    String(card.trip_days ?? ''),
    card.airline_name ?? '',
    card.airline_code ?? '',
    fingerprintCardText(card),
    `clk:${card.scrape_click_index ?? ''}`,
    `aux_idx:${card.card_index}`,
  ]
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}

function displayTitleSuffix(card: HanjintourDepartureCardSnapshot): string {
  const air = (card.airline_name ?? '').trim()
  if (air) return air
  const dep = (card.departure_datetime ?? '').trim()
  const ret = (card.return_datetime ?? '').trim()
  if (dep && ret) return `${dep} ~ ${ret}`
  const nd = [card.trip_nights, card.trip_days]
    .map((n) => (n != null ? String(n) : ''))
    .filter(Boolean)
    .join('/')
  if (nd) return `${nd}박일`
  return `옵션 ${card.card_index + 1}`
}

/**
 * 최종 전시 제목: 기본 상품명 + (항공사 또는 시간/박수 등 카드 구분). 바우처명은 제목에 넣지 않는다.
 */
export function buildHanjintourDisplayTitle(
  base: HanjintourBaseParsedProduct,
  card: HanjintourDepartureCardSnapshot
): string {
  const baseTitle = (base.product_title ?? '상품').trim()
  return `${baseTitle} (${displayTitleSuffix(card)})`
}

export function createDerivedHanjintourProduct(
  baseParsed: HanjintourBaseParsedProduct,
  card: HanjintourDepartureCardSnapshot,
  scrapeSnapshot: HanjintourScrapeSnapshot | null
): HanjintourDerivedRegisterPayload {
  const listed = card.listed_price
  const sale_price_ssot =
    listed != null && listed > 0
      ? listed
      : baseParsed.base_price_adult != null && baseParsed.base_price_adult > 0
        ? baseParsed.base_price_adult
        : null

  return {
    supplier: HANJINTOUR_SUPPLIER_KEY,
    originSource: HANJINTOUR_ORIGIN_SOURCE,
    derived_product_key: buildHanjintourDerivedProductKey(baseParsed, card),
    base_group_key: buildHanjintourBaseGroupKey(baseParsed),
    display_title: buildHanjintourDisplayTitle(baseParsed, card),
    sale_price_ssot,
    body_price_reference: {
      adult: baseParsed.base_price_adult,
      child: baseParsed.base_price_child,
      infant: baseParsed.base_price_infant,
      local_join: baseParsed.local_join_price,
      airline_holder: baseParsed.airline_holder_price,
    },
    departure_card: card,
    base_common: {
      product_title: baseParsed.product_title,
      product_code: baseParsed.product_code,
      included_items: baseParsed.included_items,
      excluded_items: baseParsed.excluded_items,
      extra_charge_items: baseParsed.extra_charge_items,
      hotel_summary: baseParsed.hotel_summary,
      flight_summary: baseParsed.flight_summary,
      main_points: baseParsed.main_points,
      optional_tour_summary: baseParsed.optional_tour_summary,
      optional_tours_structured: baseParsed.optional_tours_structured,
      shopping_count: baseParsed.shopping_count,
      guide_driver_tip: baseParsed.guide_driver_tip,
      schedule: baseParsed.schedule,
    },
    scrape_snapshot_ref: scrapeSnapshot,
  }
}
