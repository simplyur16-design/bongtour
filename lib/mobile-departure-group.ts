/**
 * 모바일 홈·검색 출발 선택.
 * 기본 선택 = 인천(ICN)·김포(GMP)만. 지방 = 청주·대구·부산(김해)·제주만.
 * 실제 출발공항 값만 사용한다. 제목 추론 금지.
 * 공항이 없거나 모르면 unknown — 인천으로 넣지 않고, 두 선택 어디에도 보여 주지 않는다.
 * REGRESSION-FREEZE[mobile-departure-group-actual-airport]: missing airport is unknown — manifest
 */

export type MobileDepartureGroup = 'capital' | 'regional' | 'unknown'

export const MOBILE_DEPARTURE_GROUP_ORDER: readonly MobileDepartureGroup[] = [
  'capital',
  'regional',
  'unknown',
]

/** 분류 이름. 화면 선택은 capital | regional 두 개뿐 */
export const MOBILE_DEPARTURE_GROUP_LABEL: Record<MobileDepartureGroup, string> = {
  capital: '인천·김포',
  regional: '청주·대구·부산·제주',
  unknown: '출발 공항 미확인',
}

/** 모바일 출발지 선택. 기본값은 인천·김포만 */
export type MobileDeparturePick = 'capital' | 'regional'

export const DEFAULT_MOBILE_DEPARTURE_PICK: MobileDeparturePick = 'capital'

export const MOBILE_DEPARTURE_PICK_OPTIONS: readonly {
  id: MobileDeparturePick
  label: string
}[] = [
  { id: 'capital', label: '인천·김포' },
  { id: 'regional', label: '지방' },
]

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

/** 선택한 그룹만. unknown은 인천·김포에도 지방에도 넣지 않는다 */
export function selectMobileDepartureItems<T extends { mobileDepartureGroup?: MobileDepartureGroup | null }>(
  items: readonly T[],
  pick: MobileDeparturePick = DEFAULT_MOBILE_DEPARTURE_PICK,
): T[] {
  const parts = partitionByMobileDepartureGroup(items)
  return pick === 'regional' ? parts.regional : parts.capital
}

export function mobileDeparturePickView<T extends { mobileDepartureGroup?: MobileDepartureGroup | null }>(
  items: readonly T[],
  pick: MobileDeparturePick = DEFAULT_MOBILE_DEPARTURE_PICK,
): {
  pick: MobileDeparturePick
  shown: T[]
  empty: boolean
  unknownCount: number
} {
  const parts = partitionByMobileDepartureGroup(items)
  const shown = pick === 'regional' ? parts.regional : parts.capital
  return {
    pick,
    shown,
    empty: shown.length === 0,
    unknownCount: parts.unknown.length,
  }
}
