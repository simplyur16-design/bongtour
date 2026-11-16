// REGRESSION-FREEZE[public-card-from-price-shared]: 동일 카드 최저가 표기 — manifest
/**
 * 목록 카드 최저가 — null이면 문의, 있으면 천 단위와 '원~'.
 * 유한수 검사·0 이하를 문의로 보는 화면은 이 함수와 다르므로 합치지 않는다.
 */
export function formatPublicCardFromPrice(n: number | null): string {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}
