/**
 * 참좋은여행 출발옵션 — 제목 레이어·matchingTraceRaw (전용).
 * 이전 공용 출발옵션 모듈에서 분리.
 *
 * `matchingTraceRaw`의 `notes[]` 접두사(`VG_LIST_*`)는 DB에 남는 **진단용 문자열**뿐이며,
 * 참좋은은 달력·**일정행(JSON)** 만 보고, 같은 행은 **N박M일 + 상품명 전체 일치**로 통과시킨다.
 */

type DepartureTitleLayers = {
  rawTitle: string
  preHashTitle: string
  comparisonTitle: string
  comparisonTitleNoSpace: string
}

const LEADING_BADGE = /^(?:\[[^\]]*]\s*)+/

function decodeBasicHtmlEntities(s: string): string {
  if (!s.includes('&')) return s
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(?:x([0-9a-f]{1,6})|(\d{1,7}));/gi, (_, hex: string | undefined, dec: string | undefined) => {
      const code = hex != null ? parseInt(hex, 16) : parseInt(dec ?? '', 10)
      if (!Number.isFinite(code) || code < 0) return ''
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    })
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

export function buildDepartureTitleLayers(rawTitle: string | null | undefined): DepartureTitleLayers {
  const raw = decodeBasicHtmlEntities(String(rawTitle ?? ''))
    .replace(/\u00a0/g, ' ')
    .trim()
  const afterBadges = raw.replace(LEADING_BADGE, '').trim()
  const comparisonTitle = afterBadges.replace(/\s+/g, ' ').trim()
  const comparisonTitleNoSpace = comparisonTitle.replace(/\s+/g, '')
  return {
    rawTitle: raw,
    preHashTitle: comparisonTitle,
    comparisonTitle,
    comparisonTitleNoSpace,
  }
}

const VERYGOODTOUR_DEPARTURE_COLLECTION_FLOW = [
  'detail_opened',
  'baseline_extracted',
  'departure_ui_opened',
  'date_clicked',
  'list_refreshed',
  'list_scanned',
  'same_product_selected',
  'appended',
  'month_moved',
  'deduped',
] as const

type VerygoodtourTracePayload = {
  source: string
  supplier?: string
  baseline?: Partial<DepartureTitleLayers>
  candidate?: Partial<DepartureTitleLayers>
  notes?: string[]
  [k: string]: unknown
}

export function buildCommonMatchingTrace(payload: VerygoodtourTracePayload): string {
  return JSON.stringify(
    {
      flow: VERYGOODTOUR_DEPARTURE_COLLECTION_FLOW,
      ...payload,
    },
    null,
    0
  )
}
