/**
 * 관리자 상품 `?registerTrace=1` 등에서 공개 상세와 비교할 때 고정 안내 문구 SSOT.
 * Node `crypto` 미사용 — 클라이언트 번들에서 `crypto-browserify`로 누출되지 않음.
 * 공급사별 `admin-register-verification-meta-*`는 이 상수를 re-export 한다.
 */
export const REGISTER_PUBLIC_PAGE_TRACE_BULLETS: readonly string[] = [
  '항공: 사용자 상세는 rawMeta.structuredSignals(항공 세그먼트·편명 등)와 출발일별 ProductDeparture 항공 필드를 합성하며, 브랜드별 FlightStructured 노출 정책이 추가로 적용됩니다.',
  '가격: ProductPrice 행(성인·아동침대·아동노침대·유아)과 히어로/프로모 표시. 본문 productPriceTable은 structuredSignals에 보존됩니다.',
  '호텔: hotelSummaryRaw·dayHotelPlans·ItineraryDay 숙박 텍스트와 structured hotel 행을 함께 봅니다.',
  '옵션: Product.optionalToursStructured JSON이 1차이며 structuredSignals 보조가 있을 수 있습니다.',
  '쇼핑: shoppingShopOptions JSON·shoppingCount·structured 쇼핑 행을 함께 봅니다.',
] as const
