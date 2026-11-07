/**
 * 모바일 홈·검색 출발 그룹.
 * 기본 그룹 = 인천(ICN)·김포(GMP). 지방 = 청주·대구·부산(김해)·제주.
 * 실제 출발공항 값만 사용한다. 제목 추론 금지.
 * 공항이 없거나 모르면 unknown — 인천으로 넣지 않는다.
 * REGRESSION-FREEZE[mobile-departure-group-actual-airport]: missing airport is unknown — manifest
 */

export type MobileDepartureGroup = 'capital' | 'regional' | 'unknown'

export const MOBILE_DEPARTURE_GROUP_ORDER: readonly MobileDepartureGroup[] = [
  'capital',
  'regional',
  'unknown',
]

/** 390px 한 줄에 들어가는 그룹 제목 */
export const MOBILE_DEPARTURE_GROUP_LABEL: Record<MobileDepartureGroup, string> = {
  capital: '인천·김포',
  regional: '청주·대구·부산·제주',
  unknown: '출발 공항 미확인',
}

function classifyAirportToken(raw: string | null | undefined): 'capital' | 'regional' | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  const u = t.toUpperCase()
  if (u === 'ICN' || u === 'GMP' || u === 'JCN' || t === 'gimpo') return 'capital'
  if (/^(?:인천|김포)(?:국제)?(?:공항)?$/u.test(t)) return 'capital'
  if (u === 'PUS' || u === 'TAE' || u === 'CJJ' || u === 'CJU') return 'regional'
  if (t === 'busan' || t === 'daegu' || t === 'cheongju' || t === 'jeju') return 'regional'
  if (/^(?:청주|대구|제주|부산|김해)(?:국제)?(?:공항)?$/u.test(t)) return 'regional'
  return null
}

/**
 * 출발 회차 `outboundDepartureAirport`가 있으면 그 값만 따른다.
 * 비어 있을 때만 저장된 `departureAirportLabel`·`localDepartureTag`를 본다.
 * 둘 다 없으면 unknown. 빈 값을 인천으로 올리지 않는다.
 */
export function classifyMobileDepartureGroup(input: {
  departureAirportLabel?: string | null
  localDepartureTags?: readonly string[] | null
  outboundDepartureAirport?: string | null
}): MobileDepartureGroup {
  const outbound = String(input.outboundDepartureAirport ?? '').trim()
  if (outbound) return classifyAirportToken(outbound) ?? 'unknown'

  const fromLabel = classifyAirportToken(input.departureAirportLabel)
  if (fromLabel) return fromLabel
  for (const tag of input.localDepartureTags ?? []) {
    const fromTag = classifyAirportToken(tag)
    if (fromTag) return fromTag
  }
  return 'unknown'
}

export function partitionByMobileDepartureGroup<T extends { mobileDepartureGroup?: MobileDepartureGroup | null }>(
  items: readonly T[],
): Record<MobileDepartureGroup, T[]> {
  const out: Record<MobileDepartureGroup, T[]> = { capital: [], regional: [], unknown: [] }
  for (const item of items) {
    const group = item.mobileDepartureGroup
    if (group === 'capital' || group === 'regional') out[group].push(item)
    else out.unknown.push(item)
  }
  return out
}
