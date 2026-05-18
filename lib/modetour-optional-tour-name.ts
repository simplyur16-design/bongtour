/**
 * 모두투어 사이트 복붙 접두 — 선택관광 표 항목명에서 제거.
 * 예: #(선택관광) 달랏 와인농장, #선택관광-십리화랑, #선택옵션-백두산 발마사지
 */
const MODETOUR_OPTIONAL_TOUR_HASH_PREFIX =
  /^#\s*(?:\(\s*선택\s*관광\s*\)|\(선택관광\)|선택관광|선택옵션|현지\s*옵션|옵션관광|옵션투어)\s*(?:[-–—]\s*)?/i

export function stripModetourOptionalTourNamePrefix(name: string): string {
  let t = (name ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(MODETOUR_OPTIONAL_TOUR_HASH_PREFIX, '')
  // #항목명(선택관광) — 라벨이 끝에 붙는 복붙 변형
  t = t.replace(/^#\s*(.+?)\s*\(\s*선택\s*관광\s*\)\s*$/i, '$1')
  t = t.replace(/\s*\(\s*선택\s*관광\s*\)\s*$/i, '')
  t = t.replace(/^#\s*/, '')
  return t.replace(/\s+/g, ' ').trim()
}

export function normalizeModetourOptionalTourDisplayName(name: string, fallback = '옵션'): string {
  const stripped = stripModetourOptionalTourNamePrefix(name)
  return stripped || fallback
}
