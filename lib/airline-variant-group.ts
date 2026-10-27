/**
 * 같은 공급사 상품(마스터코드)의 항공사·출발일 변형 묶음.
 * - 공개 browse: 그룹당 카드 1장(최저가 대표) + 항공사 칩
 * - 상품 상세: 항공사 선택(형제 상품 링크)
 *
 * 그룹 키 = 공급사 + 마스터코드(하나투어 code[:6], 노랑풍선 `-` 앞) + 박/일 + 지방출발 태그 + 제목(항공사·해시태그·편명 제거)
 * 항공사는 상품코드 접미(하나투어·노랑풍선) 또는 출발 회차 편명에서만 — Product.airline 원문·제목 추측 금지.
 *
 * REGRESSION-FREEZE[airline-variant-group]: 코드 접미/편명 항공사만, 최저가 대표 카드 1장 — manifest
 */
import {
  AIRLINE_IATA_KO_PUBLIC,
  AIRLINE_LEGACY_KO_TO_PUBLIC,
  airlineIataToKoPublic,
} from '@/lib/airline-iata-public-display-ssot'
import { deriveTripNightsDays } from '@/lib/derive-trip-nights-days'

/** IATA 2자리(영문2 / 영문+숫자) — 숫자만(`00`)은 항공사 아님 */
const IATA_CODE_RE = /^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])$/
/** 하나투어: EEP133 261108 OZ N */
const HANATOUR_CODE_RE = /^([A-Z]{3}\d{3})(\d{6})([A-Z0-9]{2})([A-Z0-9])$/
/** 노랑풍선: CHP1128-260722 7C 01 */
const YBTOUR_CODE_RE = /^([A-Z]{3}\d+)-(\d{6})([A-Z0-9]{2})(\d{2})$/
const FLIGHT_NO_RE = /^((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))\s*-?\s*\d{2,4}[A-Z]?$/

/** 공개 IATA→한글 표에 없는 코드(실데이터 확인분)만 — 없으면 코드 그대로 표시 */
const AIRLINE_VARIANT_EXTRA_KO: Readonly<Record<string, string>> = {
  AK: '에어아시아',
  FD: '타이에어아시아',
  WE: '파라타항공',
  GJ: '룽에어',
  SC: '산동항공',
  JD: '수도항공',
  QW: '청도항공',
  KN: '중국연합항공',
  LO: 'LOT폴란드항공',
  '9G': '썬푸꾸옥항공',
  MH: '말레이시아항공',
  JQ: '젯스타',
  LA: '라탐항공',
  HY: '우즈베키스탄항공',
  QV: '라오항공',
  AY: '핀에어',
  SK: '스칸디나비아항공',
  TR: '스쿠트항공',
}

function isIataAirlineCode(raw: string | null | undefined): raw is string {
  const c = String(raw ?? '').trim().toUpperCase()
  return IATA_CODE_RE.test(c)
}

/** 표시용 항공사명 — 모르는 코드는 코드 그대로(추측 금지) */
export function airlineVariantLabel(code: string): string {
  const c = code.trim().toUpperCase()
  return airlineIataToKoPublic(c) ?? AIRLINE_VARIANT_EXTRA_KO[c] ?? c
}

export type SupplierProductCodeParts = {
  supplier: 'hanatour' | 'ybtour'
  masterCode: string
  /** 코드 접미 항공사 — 형식이 아니면 null */
  airlineCode: string | null
}

export function parseSupplierProductCodeForAirlineVariant(
  originSource: string | null | undefined,
  originCode: string | null | undefined,
): SupplierProductCodeParts | null {
  const src = String(originSource ?? '').trim().toLowerCase()
  const code = String(originCode ?? '').trim().toUpperCase()
  if (!code) return null
  if (src === 'hanatour') {
    const m = HANATOUR_CODE_RE.exec(code)
    if (!m) return null
    return {
      supplier: 'hanatour',
      masterCode: m[1]!.slice(0, 6),
      airlineCode: isIataAirlineCode(m[3]) ? m[3]! : null,
    }
  }
  if (src === 'ybtour') {
    const m = YBTOUR_CODE_RE.exec(code)
    if (!m) return null
    return {
      supplier: 'ybtour',
      masterCode: m[1]!,
      airlineCode: isIataAirlineCode(m[3]) ? m[3]! : null,
    }
  }
  return null
}

/** 편명(OZ541, 7C 1101) → 항공사 코드 */
export function airlineCodeFromFlightNo(flightNo: string | null | undefined): string | null {
  const s = String(flightNo ?? '').trim().toUpperCase()
  if (!s) return null
  const m = FLIGHT_NO_RE.exec(s)
  return m ? m[1]! : null
}

const AIRLINE_NAME_STRIP: string[] = Array.from(
  new Set([
    ...Object.values(AIRLINE_IATA_KO_PUBLIC),
    ...Object.values(AIRLINE_VARIANT_EXTRA_KO),
    ...Object.keys(AIRLINE_LEGACY_KO_TO_PUBLIC),
    '아시아나',
    '파라타 항공',
  ]),
).sort((a, b) => b.length - a.length)

const BARE_IATA_ALT = Array.from(
  new Set([...Object.keys(AIRLINE_IATA_KO_PUBLIC), ...Object.keys(AIRLINE_VARIANT_EXTRA_KO)]),
)
  .sort((a, b) => b.length - a.length)
  .join('|')
const FLIGHT_IN_TITLE_RE = /(?<![A-Za-z0-9])(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\d{3,4}(?![A-Za-z0-9])/g
const BARE_IATA_IN_TITLE_RE = new RegExp(`(?<![A-Za-z0-9])(?:${BARE_IATA_ALT})(?![A-Za-z0-9])`, 'g')

/** 그룹 키용 제목 — 해시태그(첫 # 이후)·[X출발]·항공사명·편명·단독 IATA 제거 */
export function normalizeTitleForAirlineVariant(title: string | null | undefined): string {
  let t = String(title ?? '')
  const hash = t.indexOf('#')
  if (hash >= 0) t = t.slice(0, hash)
  t = t.replace(/\[[^\]]*출발[^\]]*\]/g, ' ')
  for (const name of AIRLINE_NAME_STRIP) t = t.split(name).join(' ')
  t = t.replace(FLIGHT_IN_TITLE_RE, ' ').replace(BARE_IATA_IN_TITLE_RE, ' ')
  return t.replace(/[\s\[\](){}<>/·,+\-_.!~|:;'"]+/g, '').toLowerCase()
}

export type AirlineVariantInput = {
  id: string
  originSource: string | null | undefined
  originCode: string | null | undefined
  title: string | null | undefined
  duration?: string | null
  tripNights?: number | null
  tripDays?: number | null
  localDepartureTag?: string[] | null
  /** 출발 회차 편명 — 코드 접미가 없을 때만 */
  outboundFlightNo?: string | null
}

/** 코드 접미 우선, 없으면 편명 — 둘 다 없으면 null(묶지 않음) */
export function resolveAirlineVariantAirlineCode(input: AirlineVariantInput): string | null {
  const parts = parseSupplierProductCodeForAirlineVariant(input.originSource, input.originCode)
  if (parts?.airlineCode) return parts.airlineCode
  return airlineCodeFromFlightNo(input.outboundFlightNo)
}

export function airlineVariantGroupKey(input: AirlineVariantInput): string | null {
  const parts = parseSupplierProductCodeForAirlineVariant(input.originSource, input.originCode)
  if (!parts) return null
  if (!resolveAirlineVariantAirlineCode(input)) return null
  const trip = deriveTripNightsDays({
    duration: input.duration ?? null,
    title: input.title ?? null,
    tripNights: input.tripNights ?? null,
    tripDays: input.tripDays ?? null,
  })
  const dep = (input.localDepartureTag ?? [])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .sort()
    .join('+')
  const titleKey = normalizeTitleForAirlineVariant(input.title)
  return [
    parts.supplier,
    parts.masterCode,
    `${trip.tripNights ?? '?'}N${trip.tripDays ?? '?'}D`,
    dep || 'main',
    titleKey,
  ].join('|')
}

export type AirlineVariantOption = {
  productId: string
  slug: string | null
  airlineCode: string
  airlineLabel: string
  priceKrw: number | null
  /** 서울 기준 YYYY-MM-DD */
  earliestDeparture: string | null
}

export type AirlineVariantEntryMeta = {
  input: AirlineVariantInput
  slug: string | null
  priceKrw: number | null
  earliestDeparture: string | null
}

function priceSortValue(p: number | null): number {
  return p != null && Number.isFinite(p) && p > 0 ? p : Number.POSITIVE_INFINITY
}

export function sortAirlineVariantOptions(options: AirlineVariantOption[]): AirlineVariantOption[] {
  return [...options].sort((a, b) => {
    const d = priceSortValue(a.priceKrw) - priceSortValue(b.priceKrw)
    if (d !== 0) return d
    const ea = a.earliestDeparture ?? '9999'
    const eb = b.earliestDeparture ?? '9999'
    if (ea !== eb) return ea < eb ? -1 : 1
    return a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0
  })
}

/**
 * 목록 순서를 유지하며 그룹당 1개만 남김 — 대표 = 최저가(동가면 먼저 나온 것).
 * 대표는 그룹 첫 멤버가 있던 자리에 놓는다. 항공사 미확인 상품은 묶지 않음.
 */
export function groupAirlineVariants<T>(
  entries: T[],
  meta: (entry: T) => AirlineVariantEntryMeta,
): { kept: T[]; variantsByKeptId: Map<string, AirlineVariantOption[]> } {
  const metas = entries.map(meta)
  const keyOf = metas.map((m) => airlineVariantGroupKey(m.input))
  const groups = new Map<string, number[]>()
  keyOf.forEach((k, i) => {
    if (!k) return
    const arr = groups.get(k)
    if (arr) arr.push(i)
    else groups.set(k, [i])
  })
  const repIndexByKey = new Map<string, number>()
  const variantsByKeptId = new Map<string, AirlineVariantOption[]>()
  for (const [k, idxs] of groups) {
    if (idxs.length < 2) continue
    let rep = idxs[0]!
    for (const i of idxs) {
      if (priceSortValue(metas[i]!.priceKrw) < priceSortValue(metas[rep]!.priceKrw)) rep = i
    }
    repIndexByKey.set(k, rep)
    const options: AirlineVariantOption[] = idxs.map((i) => {
      const m = metas[i]!
      const code = resolveAirlineVariantAirlineCode(m.input)!
      return {
        productId: m.input.id,
        slug: m.slug,
        airlineCode: code,
        airlineLabel: airlineVariantLabel(code),
        priceKrw: m.priceKrw != null && m.priceKrw > 0 ? m.priceKrw : null,
        earliestDeparture: m.earliestDeparture,
      }
    })
    variantsByKeptId.set(metas[rep]!.input.id, sortAirlineVariantOptions(options))
  }
  const kept: T[] = []
  const emitted = new Set<string>()
  entries.forEach((entry, i) => {
    const k = keyOf[i]
    const rep = k ? repIndexByKey.get(k) : undefined
    if (k == null || rep === undefined) {
      kept.push(entry)
      return
    }
    if (emitted.has(k)) return
    emitted.add(k)
    kept.push(entries[rep]!)
  })
  return { kept, variantsByKeptId }
}

/** 카드 칩 — 항공사 2곳 이상: `트리니티항공 · 파라타항공 (외 N)`, 1곳: `진에어 · 일정 2개` */
export function airlineVariantChipLabel(options: AirlineVariantOption[]): string | null {
  if (options.length < 2) return null
  const labels: string[] = []
  for (const o of sortAirlineVariantOptions(options)) {
    if (!labels.includes(o.airlineLabel)) labels.push(o.airlineLabel)
  }
  if (labels.length === 1) return `${labels[0]} · 일정 ${options.length}개`
  if (labels.length === 2) return `${labels[0]} · ${labels[1]}`
  return `${labels[0]} · ${labels[1]} 외 ${labels.length - 2}`
}

/** 상세 선택지 한 줄 — `트리니티항공 · 10/02~ · 699,000원~` */
export function airlineVariantOptionText(o: AirlineVariantOption): string {
  const parts = [o.airlineLabel]
  if (o.earliestDeparture) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(o.earliestDeparture)
    if (m) parts.push(`${Number(m[2])}/${Number(m[3])}~`)
  }
  if (o.priceKrw != null) parts.push(`${o.priceKrw.toLocaleString('ko-KR')}원~`)
  return parts.join(' · ')
}
