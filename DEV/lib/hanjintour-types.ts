/**
 * 한진투어(hanjintour) 전용 타입 — 공용 등록 파이프라인과 분리.
 * @packageDocumentation
 */

import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'

export const HANJINTOUR_SUPPLIER_KEY = 'hanjintour' as const
export const HANJINTOUR_ORIGIN_SOURCE = 'HANJINTOUR' as const

/** 운영자 표 SSOT — 선택관광 구조화 1행 */
export type HanjintourOptionalTourStructuredRow = {
  city: string
  option_name: string
  price_text: string
  price_value: number | null
  currency: string | null
  duration_text: string | null
  replacement_schedule: string | null
}

/** 본문 HTML에서 추출한 공통 상품 1건 (base group용) */
export type HanjintourBaseParsedProduct = {
  supplier: typeof HANJINTOUR_SUPPLIER_KEY
  originSource: typeof HANJINTOUR_ORIGIN_SOURCE
  product_code: string | null
  product_title: string | null
  product_title_normalized: string | null
  trip_nights: number | null
  trip_days: number | null
  base_price_adult: number | null
  base_price_child: number | null
  base_price_infant: number | null
  local_join_price: number | null
  airline_holder_price: number | null
  guide_driver_tip: string | null
  shopping_count: number | null
  optional_tour_summary: string | null
  /** 표 SSOT가 있으면 채운다 */
  optional_tours_structured: HanjintourOptionalTourStructuredRow[]
  included_items: string[]
  excluded_items: string[]
  extra_charge_items: string[]
  hotel_summary: string | null
  flight_summary: string | null
  main_points: string | null
  /** 본문 가격표·안내 원문 보존 (모달 가격과 대조용) */
  price_table_raw_text: string | null
  schedule: RegisterScheduleDay[]
  /** 본문 파싱 시 누락·모호 로그 */
  parse_notes: string[]
}

/** 출발일 변경 모달에서 수집한 카드 1개 (파생 상품 1개의 출발 옵션) */
export type HanjintourDepartureCardSnapshot = {
  selected_calendar_year_month: string | null
  selected_departure_date: string | null
  calendar_cell_price: number | null
  card_index: number
  raw_card_text: string
  raw_card_title: string | null
  departure_datetime: string | null
  return_datetime: string | null
  trip_nights: number | null
  trip_days: number | null
  airline_name: string | null
  airline_code: string | null
  listed_price: number | null
  reservation_count: number | null
  remaining_seats: number | null
  minimum_departure_count: number | null
  status_badges: string[]
  option_badges: string[]
  source_url: string
  /** 달력 셀 텍스트에 일 없이 가격만 있을 때 파생 키 보조(전역 클릭 순) */
  scrape_click_index?: number
}

/** e2e 수집 전체 스냅샷 (감사·재현용) */
export type HanjintourScrapeSnapshot = {
  detail_url: string
  scraped_at_iso: string
  /** 모달 오픈 직전 상세 페이지 본문 일부 */
  page_text_before_modal: string | null
  /** 출발일 변경 클릭 직후 달력 모달 본문 일부 */
  modal_text_after_open: string | null
  /** 모달 오픈 직후 모달 영역 텍스트 일부(달력 포함) */
  calendar_dom_text_before_modal: string | null
  modal_open_log: string[]
  per_date_snapshots: HanjintourPerDateScrapeSnapshot[]
  failures: string[]
}

export type HanjintourPerDateScrapeSnapshot = {
  clicked_date_label: string
  calendar_text_snapshot: string | null
  list_before_click_text: string | null
  list_after_click_text: string | null
  cards: HanjintourDepartureCardSnapshot[]
}

/** 파생 상품 등록용 페이로드 (카드 1 = 1건) */
export type HanjintourDerivedRegisterPayload = {
  supplier: typeof HANJINTOUR_SUPPLIER_KEY
  originSource: typeof HANJINTOUR_ORIGIN_SOURCE
  derived_product_key: string
  display_title: string
  base_group_key: string
  /** 모달 카드 기준 우선 가격 */
  sale_price_ssot: number | null
  /** 본문 가격표 보조 */
  body_price_reference: {
    adult: number | null
    child: number | null
    infant: number | null
    local_join: number | null
    airline_holder: number | null
  }
  departure_card: HanjintourDepartureCardSnapshot
  /** 공통 본문에서 복사된 필드 */
  base_common: Pick<
    HanjintourBaseParsedProduct,
    | 'included_items'
    | 'excluded_items'
    | 'extra_charge_items'
    | 'hotel_summary'
    | 'flight_summary'
    | 'main_points'
    | 'optional_tour_summary'
    | 'optional_tours_structured'
    | 'shopping_count'
    | 'guide_driver_tip'
    | 'schedule'
    | 'product_title'
    | 'product_code'
  >
  scrape_snapshot_ref: HanjintourScrapeSnapshot | null
}
