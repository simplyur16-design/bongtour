/**
 * 하나투어 제목 정규화·표시용 헬퍼(저장·UI).
 * 출발일 모달 동일상품 판정 SSOT는 Python `hanatour_raw_title_exact_match_key`(raw 제목 전문 exact)이다.
 */

const BADGE_PREFIX = /^(?:\[[^\]]*]\s*)+/

/**
 * 앞쪽 [뱃지] 반복 제거 → 첫 `#` 이전만 → 공백 정규화.
 * "도시(/도시)* + 공백 + 숫자 + 일" 패턴이 있으면 그 구간을 우선 채택.
 */
export function normalizeHanatourBaseTitle(rawTitle: string | null | undefined): string {
  if (rawTitle == null) return ''
  let s = String(rawTitle).replace(/\u00a0/g, ' ').trim()
  if (!s) return ''
  s = s.replace(BADGE_PREFIX, '').trim()
  const hashIdx = s.indexOf('#')
  const beforeHash = hashIdx >= 0 ? s.slice(0, hashIdx) : s
  const collapsed = beforeHash.replace(/\s+/g, ' ').trim()

  const pattern = /([^#\[\]]+?\/)*[^#\[\]]+?\s+\d+\s*일/u
  const m = collapsed.match(pattern)
  if (m?.[0]) {
    return m[0].replace(/\s+/g, ' ').trim()
  }
  return collapsed
}

/** 상세/모달 등에서 추출한 항공사 표기 정리 (원문 보존 목적의 light trim). */
export function extractHanatourAirlineName(text: string | null | undefined): string | null {
  if (text == null) return null
  const t = String(text).replace(/\u00a0/g, ' ').trim()
  if (!t) return null
  const m = t.match(/([가-힣a-zA-Z0-9·&\s]+(?:항공|에어|에어웨이|AIR|Air|air)[^,\n]*)/)
  if (m?.[1]) return m[1].replace(/\s+/g, ' ').trim().slice(0, 120)
  if (/^[가-힣a-zA-Z0-9·\s]{2,40}$/.test(t)) return t.slice(0, 120)
  return t.slice(0, 120)
}

/** @deprecated 출발 모달·수집 동일상품은 anchor(항공+출발·도착 시각) SSOT. 표시/감사용 보조만. */
export function buildHanatourMatchKey(baseTitle: string, airlineName: string | null | undefined): string | null {
  const b = normalizeHanatourBaseTitle(baseTitle)
  const a = (airlineName ?? '').trim()
  if (!b || !a) return null
  return `${b}||${a}`
}

/**
 * statusLabelsRaw(JSON 배열 문자열) + 원문 status → 파생 boolean.
 * 원문은 대체하지 않으며, 휴리스틱 매칭만 수행한다.
 */
export function parseStatusLabelsJson(statusLabelsRaw: string | null | undefined): string[] {
  if (statusLabelsRaw == null || !String(statusLabelsRaw).trim()) return []
  try {
    const v = JSON.parse(String(statusLabelsRaw)) as unknown
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  } catch {
    /* ignore */
  }
  return []
}

export function deriveHanatourConfirmationFlags(
  labels: string[],
  statusRaw?: string | null
): {
  isDepartureConfirmed: boolean | null
  isAirConfirmed: boolean | null
  isScheduleConfirmed: boolean | null
  isHotelConfirmed: boolean | null
  isPriceConfirmed: boolean | null
} {
  const blob = [...labels, statusRaw ?? ''].join(' ')
  const test = (re: RegExp) => (re.test(blob) ? true : null)

  return {
    isDepartureConfirmed: test(/출발\s*확정|확정\s*출발/),
    isAirConfirmed: test(/항공\s*확정/),
    isScheduleConfirmed: test(/일정\s*확정|스케줄\s*확정/),
    isHotelConfirmed: test(/호텔\s*확정/),
    isPriceConfirmed: test(/가격\s*확정/),
  }
}
