/** 메인 허브 카드 → URL fragment (앵커 스크롤용) */
export function hubSectionFragmentId(cardKey: string): string {
  if (cardKey === 'bus') return 'charter-bus'
  return cardKey
}
