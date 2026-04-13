/**
 * 우리여행(`/travel/overseas/private-trip`) 히어로 전용 운영 멘트 — Gemini 미사용.
 */

export const PRIVATE_TRIP_OPS_HEADLINES = [
  '총무님, 준비는 저희가 도와드릴게요.',
  '우리여행으로 편하게 준비하세요.',
  '국내도 해외도 모임 여행은 더 쉽게 준비하세요.',
  '여러 명이 함께 가는 여행, 이제 편하게 맞춰보세요.',
  '원우회 여행도 일정부터 숙소까지 함께 준비해드립니다.',
  '부부동반 여행, 함께 준비하면 훨씬 편합니다.',
  '동문회 여행도 부담 없이 준비해보세요.',
  '상인회 여행, 모임 성격에 맞게 도와드릴게요.',
  '산악회 여행도 일정에 맞춰 편하게 준비하세요.',
  '담당자 한 분만 고생하지 않게 도와드릴게요.',
] as const

function heroHaystack(row: { title: string; headline: string; primaryDestination: string | null }): string {
  return `${row.title}\n${row.headline}\n${row.primaryDestination ?? ''}`.toLowerCase()
}

/** 스토리지 키·해시·확장자 위주 파일명으로 보이면 공개용 제목에서 제외 */
export function looksLikeInternalAssetLabel(s: string): boolean {
  const t = s.trim()
  if (!t) return true
  if (/\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(t)) return true
  if (/^[a-z0-9_-]{20,}$/i.test(t.replace(/\s+/g, ''))) return true
  if (/[a-f0-9]{12,}/i.test(t) && /[-_]/.test(t)) return true
  return false
}

/**
 * 슬라이드 인덱스와(선택) 제목·관리자 headline에서 단서를 읽어 멘트 선택.
 * 우선순위: 원우회 → 동문회 → 상인회 → 산악회 → 부부동반 → 단체/총무/담당/모임 → 없으면 인덱스 순환.
 */
export function pickPrivateTripOpsHeadline(
  row: { title: string; headline: string; primaryDestination: string | null },
  slideIndex: number
): string {
  const h = heroHaystack(row)
  if (h.includes('원우회')) return PRIVATE_TRIP_OPS_HEADLINES[4]
  if (h.includes('동문회')) return PRIVATE_TRIP_OPS_HEADLINES[6]
  if (h.includes('상인회')) return PRIVATE_TRIP_OPS_HEADLINES[7]
  if (h.includes('산악회')) return PRIVATE_TRIP_OPS_HEADLINES[8]
  if (h.includes('부부동반')) return PRIVATE_TRIP_OPS_HEADLINES[5]
  if (/(총무|담당|단체|모임|동호회|인원|워크숍|연수)/.test(h)) {
    return slideIndex % 2 === 0 ? PRIVATE_TRIP_OPS_HEADLINES[0] : PRIVATE_TRIP_OPS_HEADLINES[9]
  }
  return PRIVATE_TRIP_OPS_HEADLINES[slideIndex % PRIVATE_TRIP_OPS_HEADLINES.length]!
}

/** 관리 슬라이드 하단: 파일명·내부 라벨 노출 금지. JSON 캡션 등 사람이 쓴 짧은 문구는 유지. */
export function privateTripHeroCardTitle(row: { id: string; title: string }): string {
  const t = row.title.trim()
  if (!t || looksLikeInternalAssetLabel(t)) return '우리여행'
  return t
}
