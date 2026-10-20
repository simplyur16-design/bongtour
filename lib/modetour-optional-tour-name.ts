/**
 * 선택관광 표시명 — 복붙 잡음만 제거. 나라명·고유 관광명은 원문 유지.
 */
// REGRESSION-FREEZE[optional-tour-name-display-normalize]: #[선택]·담당자추천·가격꼬리만 제거(나라명 유지) — manifest

const MODETOUR_OPTIONAL_TOUR_HASH_PREFIX =
  /^#\s*(?:\(\s*선택\s*관광\s*\)|\[\s*선택\s*관광\s*\]|\[\s*선택\s*\]|\(선택관광\)|선택관광|선택옵션|현지\s*옵션|옵션관광|옵션투어)\s*(?:[-–—]\s*)?/i

const MODETOUR_OPTIONAL_TOUR_BRACKET_PREFIX = /^\[\s*선택(?:\s*관광)?\s*\]\s*[-–—]?\s*/i

const MODETOUR_OPTIONAL_TOUR_PROMO_PREFIX =
  /^(?:\[\s*[★☆*]?\s*담당자\s*추천\s*선택\s*관광\s*\]|\[\s*[★☆*]?\s*담당자추천\s*선택\s*관광\s*\]|MD\s*추천\s*선택\s*관광\s*[IVXⅠ-Ⅴ]*\s*)\s*/i

const MODETOUR_OPTIONAL_TOUR_PRICE_SUFFIX =
  /\s*[\(（]\s*\$?\s*[\d,.]+(?:\s*\/\s*인)?(?:\s*[,，]\s*[^)）]+)?\s*[\)）]\s*$/i

/** `(선택관광/$100)` · `(선택관광) $60` */
const MODETOUR_OPTIONAL_TOUR_SELECT_PAREN_TAIL =
  /\s*\(\s*선택\s*관광\s*(?:[/$]\s*\$?\s*[\d,.]+(?:\s*\/\s*인)?)?\s*\)\s*(?:\$\s*[\d,.]+)?\s*$/i

const MODETOUR_OPTIONAL_TOUR_BARE_PRICE_TAIL = /\s+\$\s*[\d,.]+\s*$/i

const MODETOUR_OPTIONAL_TOUR_CURRENCY_CODE_TAIL = /\s+(?:USD|EUR|JPY|KRW|HKD|CNY|THB|VND)\s*$/i

export function stripModetourOptionalTourNamePrefix(name: string): string {
  let t = (name ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(MODETOUR_OPTIONAL_TOUR_HASH_PREFIX, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_PROMO_PREFIX, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_BRACKET_PREFIX, '')
  t = t.replace(/\s*\[\s*선택(?:\s*관광)?\s*\]\s*/gi, ' ')
  t = t.replace(/^#\s*(.+?)\s*\(\s*선택\s*관광\s*\)\s*$/i, '$1')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_SELECT_PAREN_TAIL, '')
  t = t.replace(/\s*\(\s*선택\s*관광\s*\)\s*$/i, '')
  t = t.replace(/^#\s*/, '')
  t = t.replace(/#/g, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_BRACKET_PREFIX, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_PROMO_PREFIX, '')
  t = t.replace(/^[▶►・·]\s*/, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_PRICE_SUFFIX, '')
  t = t.replace(/\s*[\(（]\s*\$\s*[\d,.]+\s*[\)）]\s*$/i, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_BARE_PRICE_TAIL, '')
  t = t.replace(MODETOUR_OPTIONAL_TOUR_CURRENCY_CODE_TAIL, '')
  return t.replace(/\s+/g, ' ').trim()
}

export function normalizeModetourOptionalTourDisplayName(name: string, fallback = '옵션'): string {
  const stripped = stripModetourOptionalTourNamePrefix(name)
  return stripped || fallback
}
