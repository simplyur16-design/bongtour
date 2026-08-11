/**
 * 지리 매칭용 haystack — 목적지 필드 우선, 한 글자 국명(괌 등) 경계 매칭.
 */

/** 트리·마스터에 정의된 1글자 국가·지역 표기 (leaf 매칭 min length 예외) */
export const SINGLE_CHAR_GEO_TERMS = new Set(['괌', '몰', '몽'])

/** 일정 본문에서 도시명 뒤에 붙는 조사·어미 — `샌프란시스코의` 등이 매칭되도록 */
/** `관광` 제외 — 「아일랜드관광」(섬 관광)이 EU 아일랜드로 잡히지 않게. REGRESSION-FREEZE[saipan-island-tour-geo-priority] */
const KOREAN_GEO_TERM_PARTICLE_SUFFIX =
  '(?:의|에|에서|으로|로|와|과|이|가|을|를|도|만|부터|까지|입성|출발|도착|경유)?'

export function buildMultiCountryDetectionHaystack(opts: {
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
  scheduleHaystack?: string | null
}): string {
  const title = opts.title.trim()
  const pd = (opts.primaryDestination ?? '').trim()
  const dr = (opts.destinationRaw ?? '').trim()
  const sched = (opts.scheduleHaystack ?? '').trim()
  return [pd, dr, sched, title].filter(Boolean).join('\n')
}

/** 한글·라틴 토큰이 haystack에 독립적으로 등장하는지 (부분 문자열 오매칭 완화) */
export function termAppearsInHaystack(term: string, haystack: string): boolean {
  const t = term.trim()
  const h = haystack.trim()
  if (!t || !h) return false
  const low = h.toLowerCase()
  const tl = t.toLowerCase()
  if (/[\uac00-\ud7a3]/.test(tl)) {
    if (SINGLE_CHAR_GEO_TERMS.has(t)) {
      const re = new RegExp(`(^|[^\\uac00-\\ud7a3])${escapeRegExp(tl)}([^\\uac00-\\ud7a3]|$)`)
      return re.test(low)
    }
    const re = new RegExp(
      `(^|[^\\uac00-\\ud7a3])${escapeRegExp(tl)}${KOREAN_GEO_TERM_PARTICLE_SUFFIX}([^\\uac00-\\ud7a3]|$)`,
    )
    if (!re.test(low)) return false
    // REGRESSION-FREEZE[saipan-island-tour-geo-priority]: 「지명+아일랜드」(섬) ≠ EU 아일랜드 — manifest
    // 그랜빌 아일랜드·야스 아일랜드·보홀 아일랜드 파티 등. 더블린/Ireland/공화국·국가목록 문맥만 허용.
    if (tl === '아일랜드') {
      if (/ireland|dublin|더블린|아일랜드\s*공화국/i.test(h)) return true
      // 앞에 한글 지명이 붙은 「○○ 아일랜드」는 섬 표기
      if (/[\uac00-\ud7a3]{2,}\s*아일랜드/.test(h)) return false
    }
    return true
  }
  if (/^[a-z0-9]+$/i.test(tl) && tl.length <= 4) {
    const re = new RegExp(`\\b${escapeRegExp(tl)}\\b`, 'i')
    return re.test(h)
  }
  return low.includes(tl)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
