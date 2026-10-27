/**
 * 같은 상품 묶음 + 항공사별 가격 (설계 C + 항공사별 가격줄).
 * - 묶음 키: 같은 공급사 + 마스터코드 + 전체 제목(# 태그 포함, 항공사·편명·[..출발]·앞머리 판매표식만 제거)
 *   + 박/일 + 지방출발 태그. 호텔·일정 문구가 다르면 제목이 달라 절대 묶이지 않는다.
 *   출발일 겹침은 요구하지 않음 — 실데이터에서 KEY/KEZ(같은 상품, 출발일 분할) 겹침 0.25.
 * - 항공사 = 실제 향후 공개예약가능(마감 제외) 출발 회차의 carrierName(없으면 편명) → 공개 항공사 SSOT.
 *   코드 접미·Product.airline·제목 사용 금지. 모르는 항공사는 생략(추측 금지).
 * - 가격 = 같은 회차들의 실계산 최저가 (저장값 minBookableAdultPrice 미사용).
 *
 * REGRESSION-FREEZE[airline-variant-group]: 완전 같은 상품만 묶음 · 항공사별 가격은 출발 회차 항공사만 — manifest
 */
import {
  AIRLINE_IATA_KO_PUBLIC,
  AIRLINE_LEGACY_KO_TO_PUBLIC,
  formatPublicAirlineDisplay,
} from '@/lib/airline-iata-public-display-ssot'
import { deriveTripNightsDays } from '@/lib/derive-trip-nights-days'

/** 하나투어: EEP133 261108 OZ N */
const HANATOUR_CODE_RE = /^([A-Z]{3}\d{3})(\d{6})([A-Z0-9]{2})([A-Z0-9])$/
/** 노랑풍선: CHP1128-260722 7C 01 */
const YBTOUR_CODE_RE = /^([A-Z]{3}\d+)-(\d{6})([A-Z0-9]{2})(\d{2})$/

export type SupplierProductCodeParts = {
  supplier: 'hanatour' | 'ybtour'
  masterCode: string
}

/** 마스터코드만 — 코드 접미(항공사처럼 보이는 2자리)는 그룹·표시에 쓰지 않음 */
export function parseSupplierMasterCode(
  originSource: string | null | undefined,
  originCode: string | null | undefined,
): SupplierProductCodeParts | null {
  const src = String(originSource ?? '').trim().toLowerCase()
  const code = String(originCode ?? '').trim().toUpperCase()
  if (!code) return null
  if (src === 'hanatour') {
    const m = HANATOUR_CODE_RE.exec(code)
    return m ? { supplier: 'hanatour', masterCode: m[1]!.slice(0, 6) } : null
  }
  if (src === 'ybtour') {
    const m = YBTOUR_CODE_RE.exec(code)
    return m ? { supplier: 'ybtour', masterCode: m[1]! } : null
  }
  return null
}

const AIRLINE_NAME_STRIP: string[] = Array.from(
  new Set([
    ...Object.values(AIRLINE_IATA_KO_PUBLIC),
    ...Object.keys(AIRLINE_LEGACY_KO_TO_PUBLIC),
    '아시아나',
  ]),
).sort((a, b) => b.length - a.length)
const BARE_IATA_ALT = Object.keys(AIRLINE_IATA_KO_PUBLIC)
  .sort((a, b) => b.length - a.length)
  .join('|')
const FLIGHT_IN_TITLE_RE = /(?<![A-Za-z0-9])(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{3,4}(?![A-Za-z0-9])/g
const BARE_IATA_IN_TITLE_RE = new RegExp(`(?<![A-Za-z0-9])(?:${BARE_IATA_ALT})(?![A-Za-z0-9])`, 'g')
/** 앞머리 판매상태 표식: `*`, `*[출발임박]`, `[출발확정]` 등 — 상품 내용이 아님 */
const LEADING_STATUS_MARK_RE =
  /^(?:\s*\*+\s*|\s*\[\s*(?:출발\s*임박|출발\s*확정|마감\s*임박|매진\s*임박|예약\s*마감|판매\s*마감|긴급\s*모객|집중\s*모객|무조건\s*출발)\s*\]\s*)+/

/**
 * 그룹 키용 전체 제목 — # 태그 포함 유지.
 * 제거: 앞머리 `*`·판매상태 [..], [..출발..], 항공사명·편명·단독 IATA, 공백·문장부호.
 */
export function normalizeTitleForDuplicateGroup(title: string | null | undefined): string {
  let t = String(title ?? '').replace(LEADING_STATUS_MARK_RE, ' ')
  t = t.replace(/\[[^\]]*출발[^\]]*\]/g, ' ')
  for (const name of AIRLINE_NAME_STRIP) t = t.split(name).join(' ')
  t = t.replace(FLIGHT_IN_TITLE_RE, ' ').replace(BARE_IATA_IN_TITLE_RE, ' ')
  return t.replace(/[\s#\[\](){}<>/·,+\-_.!~|:;'"*＊]+/g, '').toLowerCase()
}

export type DuplicateGroupInput = {
  id: string
  originSource: string | null | undefined
  originCode: string | null | undefined
  title: string | null | undefined
  duration?: string | null
  tripNights?: number | null
  tripDays?: number | null
  localDepartureTag?: string[] | null
}

/** 공급사|마스터코드|박일|지방출발|전체제목 — 하나투어·노랑풍선 코드 형식이 아니면 null(묶지 않음) */
export function duplicateGroupKey(input: DuplicateGroupInput): string | null {
  const parts = parseSupplierMasterCode(input.originSource, input.originCode)
  if (!parts) return null
  const titleKey = normalizeTitleForDuplicateGroup(input.title)
  if (!titleKey) return null
  const trip = deriveTripNightsDays({
    duration: input.duration ?? null,
    title: input.title ?? null,
    tripNights: input.tripNights ?? null,
    tripDays: input.tripDays ?? null,
  })
  if (trip.tripNights == null || trip.tripDays == null) return null
  const dep = (input.localDepartureTag ?? [])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .sort()
    .join('+')
  return [parts.supplier, parts.masterCode, `${trip.tripNights}N${trip.tripDays}D`, dep || 'main', titleKey].join('|')
}

/** 공급사 표기 흔들림 → 하나의 공개명 (SSOT 표기 우선). 공백 제거 후 비교 */
const CARRIER_LABEL_ALIAS: Record<string, string> = {
  제주에어: '제주항공',
  에어로케이항공: '에어로케이',
  에미레이트: '에미레이트항공',
  로트폴란드항공: 'LOT폴란드항공',
  캐세이퍼시픽항공: '캐세이퍼시픽',
  타이비엣젯: '타이비엣젯항공',
  젯스타: '젯스타항공',
}
/** 항공사가 아닌 운송수단 */
const NON_AIRLINE_LABELS = new Set(['선박', '버스', '기차', '열차', '크루즈', '페리'])

function cleanCarrierLabel(v: string | null | undefined): string | null {
  let s = String(v ?? '').trim()
  if (!s) return null
  s = s.replace(/\(\s*구\s*\).*$/, '').replace(/\s+/g, '')
  s = CARRIER_LABEL_ALIAS[s] ?? s
  if (!/[가-힣]{2,}/.test(s) || NON_AIRLINE_LABELS.has(s)) return null
  return s
}

export type BookableDepartureLike = {
  departureYmd: string
  adultPrice: number | null
  carrierName?: string | null
  outboundFlightNo?: string | null
}

/** 출발 회차 항공사 → 공개 표시명. 한글 항공사명으로 확정되지 않으면 null(추측 금지) */
export function departureCarrierPublicLabel(
  d: Pick<BookableDepartureLike, 'carrierName' | 'outboundFlightNo'>,
): string | null {
  const name = String(d.carrierName ?? '').trim()
  if (name) return cleanCarrierLabel(formatPublicAirlineDisplay(name))
  const fl = String(d.outboundFlightNo ?? '').trim().replace(/\s|-/g, '')
  if (fl && /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{2,4}$/i.test(fl)) {
    return cleanCarrierLabel(formatPublicAirlineDisplay(fl.toUpperCase()))
  }
  return null
}

const IATA_BY_PUBLIC_LABEL: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const [code, ko] of Object.entries(AIRLINE_IATA_KO_PUBLIC)) {
    const k = String(ko).replace(/\s+/g, '')
    if (!m.has(k)) m.set(k, code)
  }
  return m
})()

/** `?airline=` 값 — SSOT에 IATA가 있으면 코드(KE), 없으면 공개명 그대로 */
export function airlineParamForLabel(label: string): string {
  return IATA_BY_PUBLIC_LABEL.get(label) ?? label
}

/** `?airline=` 값 → 공개명 (IATA 코드 또는 이름 모두 허용). 판정 불가면 null */
export function airlineLabelFromParam(param: string | null | undefined): string | null {
  const raw = String(param ?? '').trim()
  if (!raw) return null
  const up = raw.toUpperCase()
  if (/^[A-Z0-9]{2}$/.test(up)) {
    const ko = (AIRLINE_IATA_KO_PUBLIC as Record<string, string>)[up]
    return ko ? cleanCarrierLabel(ko) : null
  }
  return cleanCarrierLabel(formatPublicAirlineDisplay(raw))
}

export type CarrierPriceLine = {
  /** 공개 항공사명 */
  label: string
  /** `?airline=` 값 */
  param: string
  /** 그 항공사 공개예약가능 회차 최저 성인가 */
  priceKrw: number
  /** 그 최저가를 가진 상품 slug(묶음이면 멤버 중) — 링크 대상 */
  slug: string | null
  productId: string
}

/** 상품 1개의 향후 공개예약가능 회차 요약 (서버에서 계산) */
export type ProductBookableSummary = {
  productId: string
  slug: string | null
  minPriceKrw: number | null
  /** 항공사 공개명 → 최저가 (가격 있는 회차만) */
  carrierMinPrice: Record<string, number>
}

/** 이미 공개예약가능으로 거른 회차 → 요약 */
export function summarizeBookableDepartures(
  productId: string,
  slug: string | null,
  bookable: BookableDepartureLike[],
): ProductBookableSummary {
  let min: number | null = null
  const carrierMinPrice: Record<string, number> = {}
  for (const d of bookable) {
    const p = d.adultPrice != null && d.adultPrice > 0 ? d.adultPrice : null
    if (p == null) continue
    if (min == null || p < min) min = p
    const label = departureCarrierPublicLabel(d)
    if (label && (carrierMinPrice[label] === undefined || p < carrierMinPrice[label]!)) carrierMinPrice[label] = p
  }
  return { productId, slug, minPriceKrw: min, carrierMinPrice }
}

/** 여러 멤버 요약 → 항공사별 최저가 줄 (싼 순, 동가는 이름순). 멤버 순서가 동가 tie-break */
export function carrierPriceLinesFromSummaries(summaries: ProductBookableSummary[]): CarrierPriceLine[] {
  const best = new Map<string, CarrierPriceLine>()
  for (const s of summaries) {
    for (const [label, price] of Object.entries(s.carrierMinPrice)) {
      const cur = best.get(label)
      if (!cur || price < cur.priceKrw) {
        best.set(label, { label, param: airlineParamForLabel(label), priceKrw: price, slug: s.slug, productId: s.productId })
      }
    }
  }
  return [...best.values()].sort((a, b) => a.priceKrw - b.priceKrw || a.label.localeCompare(b.label, 'ko'))
}

/** 카드 표시 상한 — 상위 3개 + `외 N` */
export const CARRIER_PRICE_LINES_MAX = 3

export function capCarrierPriceLines(lines: CarrierPriceLine[], max = CARRIER_PRICE_LINES_MAX) {
  return { shown: lines.slice(0, max), moreCount: Math.max(0, lines.length - max) }
}

export type DuplicateGroupResult<T> = {
  /** 입력 순서 유지 · 묶인 그룹은 대표만 (첫 멤버 위치) */
  kept: T[]
  /** 대표 id → 멤버 id (2개 이상만) */
  membersByKeptId: Map<string, string[]>
}

function priceSortValue(p: number | null | undefined): number {
  return p != null && p > 0 ? p : Number.POSITIVE_INFINITY
}

/**
 * 같은 키 상품 id 목록 (2개 이상) — 서버가 이 상품들만 요약을 미리 조회.
 */
export function duplicateCandidateIds<T>(entries: T[], getInput: (e: T) => DuplicateGroupInput): string[] {
  const byKey = new Map<string, string[]>()
  for (const e of entries) {
    const input = getInput(e)
    const k = duplicateGroupKey(input)
    if (!k) continue
    const list = byKey.get(k) ?? []
    list.push(input.id)
    byKey.set(k, list)
  }
  return [...byKey.values()].filter((l) => l.length >= 2).flat()
}

/**
 * 완전 같은 상품 묶기. 예약가능 가격이 있는 요약이 없는 상품은 묶지 않는다(단독 카드 유지).
 * 대표 = 멤버 중 실계산 최저가(동가면 앞선 항목), 첫 멤버 위치에 둔다.
 */
export function groupDuplicateProducts<T>(
  entries: T[],
  getInput: (e: T) => DuplicateGroupInput,
  summaryById: Map<string, ProductBookableSummary>,
): DuplicateGroupResult<T> {
  const idxsByKey = new Map<string, number[]>()
  const keyOf = new Map<number, string>()
  entries.forEach((e, i) => {
    const input = getInput(e)
    const k = duplicateGroupKey(input)
    const s = summaryById.get(input.id)
    if (!k || !s || s.minPriceKrw == null) return
    const list = idxsByKey.get(k) ?? []
    list.push(i)
    idxsByKey.set(k, list)
    keyOf.set(i, k)
  })
  const membersByKeptId: Map<string, string[]> = new Map()
  const repIdxByKey = new Map<string, number>()
  for (const [k, idxs] of idxsByKey) {
    if (idxs.length < 2) continue
    let rep = idxs[0]!
    for (const i of idxs) {
      const pi = summaryById.get(getInput(entries[i]!).id)!.minPriceKrw
      const pr = summaryById.get(getInput(entries[rep]!).id)!.minPriceKrw
      if (priceSortValue(pi) < priceSortValue(pr)) rep = i
    }
    repIdxByKey.set(k, rep)
    const repId = getInput(entries[rep]!).id
    membersByKeptId.set(repId, [repId, ...idxs.filter((i) => i !== rep).map((i) => getInput(entries[i]!).id)])
  }
  const kept: T[] = []
  entries.forEach((e, i) => {
    const k = keyOf.get(i)
    const idxs = k ? idxsByKey.get(k) : undefined
    if (!k || !idxs || idxs.length < 2) {
      kept.push(e)
      return
    }
    if (idxs[0] === i) kept.push(entries[repIdxByKey.get(k)!]!)
  })
  return { kept, membersByKeptId }
}
