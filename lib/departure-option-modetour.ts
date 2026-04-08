/**
 * 모두투어 출발옵션 — 제목 레이어·HTML 엔티티·matchingTraceRaw (전용).
 * 이전 공용 출발옵션 모듈에서 분리.
 */

export type DepartureTitleLayers = {
  rawTitle: string
  preHashTitle: string
  comparisonTitle: string
  comparisonTitleNoSpace: string
}

const LEADING_BADGE = /^(?:\[[^\]]*]\s*)+/

export function decodeBasicHtmlEntities(s: string): string {
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
  const pre = raw.replace(LEADING_BADGE, '').split('#')[0]?.trim() ?? ''
  const comparisonTitle = pre.replace(/\s+/g, ' ').trim()
  const comparisonTitleNoSpace = comparisonTitle.replace(/\s+/g, '')
  return {
    rawTitle: raw,
    preHashTitle: comparisonTitle,
    comparisonTitle,
    comparisonTitleNoSpace,
  }
}

const MODETOUR_DEPARTURE_COLLECTION_FLOW = [
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

type ModetourTracePayload = {
  source: string
  supplier?: string
  baseline?: Partial<DepartureTitleLayers>
  candidate?: Partial<DepartureTitleLayers>
  notes?: string[]
  [k: string]: unknown
}

export function buildCommonMatchingTrace(payload: ModetourTracePayload): string {
  return JSON.stringify(
    {
      flow: MODETOUR_DEPARTURE_COLLECTION_FLOW,
      ...payload,
    },
    null,
    0
  )
}
