/**
 * 호텔/식사 — 운영 투입 전 E2E 스모크 체크리스트 (mock 금지, pasted raw 기준).
 * 검증 구간: paste → preview → confirm → DB → 상세 렌더.
 *
 * 수동 검증 시 아래를 순서대로 확인한다.
 */
export const HOTEL_MEAL_E2E_CHECKS = [
  '호텔명 2개 이상 → 상세/미리보기에서 「대표호텔명 외 n」형태 (n=나머지 개수)',
  '호텔명 1개 → 단일명만, 「외 0」문구 없음',
  '아침·점심·저녁 값이 모두 있으면 상세 식사 행이 가로 한 줄(좁으면 wrap)',
  '일부 식사만 있으면 채워진 끼만 표시',
  '조·중·석 분리 실패 + mealSummaryText만 있음 → fallback 한 덩어리만, 조·중·석과 중복 없음',
  'day.hotelText 없음 + product.hotelSummaryText(또는 hotelNames)만 → day 카드에 상품 요약이 표시되나, 상품 상단 호텔 블록과 역할 분리 유지',
  '구데이터(null 다수) → 상세 일정 영역 미크래시, 빈 카드/라벨만 덜렁 노출 없음',
] as const
