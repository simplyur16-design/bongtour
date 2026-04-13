/**
 * 등록대기 패널 전용: 2차 분류(대표 지역·테마·타깃) 초안 제안.
 * DB 저장·공개 파이프라인과 분리 — UI에서만 호출.
 */

import { matchProductToOverseasNode, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import { parseTravelScope } from '@/lib/product-listing-kind'

export type AdminPendingSecondarySuggestInput = {
  title: string
  originSource: string
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
  productType: string | null
  travelScope: string | null
  listingKind: string | null
  schedule: string | null
  hotelSummaryRaw: string | null
  includedText: string | null
  excludedText: string | null
  optionalToursStructured: string | null
  benefitSummary: string | null
  itineraryDays: ReadonlyArray<{
    summaryTextRaw: string | null
    poiNamesRaw: string | null
    transport: string | null
    rawBlock: string | null
  }>
}

export type AdminPendingSecondarySuggestResult = {
  primaryRegion: string | null
  themeTags: string | null
  targetAudience: string | null
}

const DOMESTIC_HINT =
  /국내|제주(?!오후)|부산|경주|강릉|속초|서울|인천|대구|광주|전주|여수|남해|통영|거제|설악|지리산|한라|당일치기|1박2일|2박3일\s*국내/i

/** 해외 권역 오탐 완화: 제목·목적지에 흔한 해외 토큰이 있으면 국내 단정 안 함 */
const OVERSEAS_BLOCK = /유럽|동남아|미주|일본|중국|대만|태국|베트남|발리|몰디브|하와이|괌|사이판|싱가포르|프랑스|이탈리아|스페인|스위스|터키|두바이|호주|뉴질랜드/i

const RE_FREE_SCHEDULE = /자유\s*일정|자유일정|자유\s*관광|자유\s*time|free\s*time/i

const RE_FAMILY_ATTRACTION =
  /아동|동물원|테마공원|테마파크|아쿠아리움|수족관|디즈니|디즈니랜드|디즈니씨|USJ|유니버설|시월드|씨월드|지브리|지브리미술관|해리포터|해리\s*포터|레고랜드|롯데월드|에버랜드|키자니아/i

const RE_HONEYMOON_COUPLE = /허니문|신혼|웨딩|커플\s*여행|커플패키지/i

const RE_RELAX = /온천|온천여행|휴양|리조트|스파|노천탕|온천호텔/i

const RE_HEAVY_ACTIVE =
  /번지|래프팅|패러글라이딩|익스트림|트래킹\s*(\d|\d{2})|장거리\s*이동|야간\s*이동|레드\s*아이|연속\s*이동|도보\s*(\d|\d{2})\s*km|등산\s*정복/i

const RE_MOVE_DAY =
  /(공항|출국|입국|항공|이동|버스|셔틀|KTX|기차|열차|페리|크루즈(?!세일)|트레인)/i

function buildHaystack(input: AdminPendingSecondarySuggestInput): string {
  const parts: string[] = [
    input.title,
    input.primaryDestination ?? '',
    input.destinationRaw ?? '',
    input.destination ?? '',
    input.productType ?? '',
    input.schedule ?? '',
    input.hotelSummaryRaw ?? '',
    input.includedText ?? '',
    input.excludedText ?? '',
    input.optionalToursStructured ?? '',
    input.benefitSummary ?? '',
  ]
  for (const d of input.itineraryDays) {
    parts.push(d.summaryTextRaw ?? '', d.poiNamesRaw ?? '', d.transport ?? '', d.rawBlock ?? '')
  }
  return parts.join('\n')
}

function uniqueCommaTags(raw: string[]): string | null {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of raw) {
    const t = x.replace(/\s+/g, ' ').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.length ? out.join(',') : null
}

function suggestPrimaryRegion(input: AdminPendingSecondarySuggestInput, haystack: string): string | null {
  const scope = parseTravelScope(input.travelScope ?? null)
  if (scope === 'domestic') return '국내'

  const matchInput: OverseasProductMatchInput = {
    title: input.title,
    originSource: input.originSource,
    primaryDestination: input.primaryDestination,
    destinationRaw: input.destinationRaw,
    destination: input.destination,
    primaryRegion: null,
  }
  const node = matchProductToOverseasNode(matchInput)
  if (node?.groupLabel?.trim()) return node.groupLabel.trim()

  if (scope === 'overseas') return null

  const head = `${input.title}\n${input.primaryDestination ?? ''}\n${input.destination ?? ''}`
  if (DOMESTIC_HINT.test(head) || DOMESTIC_HINT.test(haystack)) {
    if (OVERSEAS_BLOCK.test(head)) return null
    return '국내'
  }
  return null
}

function countItineraryDays(input: AdminPendingSecondarySuggestInput): number {
  if (input.itineraryDays.length > 0) return input.itineraryDays.length
  const m = (input.schedule ?? '').match(/\d+\s*일차/g)
  if (m) return m.length
  return 0
}

function heavyMovementRatio(input: AdminPendingSecondarySuggestInput): number {
  const rows = input.itineraryDays
  if (rows.length === 0) return 0
  let move = 0
  for (const d of rows) {
    const blob = `${d.summaryTextRaw ?? ''}\n${d.transport ?? ''}\n${d.rawBlock ?? ''}`
    if (RE_MOVE_DAY.test(blob)) move += 1
  }
  return move / rows.length
}

function suggestThemeTags(input: AdminPendingSecondarySuggestInput, haystack: string): string | null {
  const tags: string[] = []
  const hasFree = RE_FREE_SCHEDULE.test(haystack)
  const hasFamilyAttr = RE_FAMILY_ATTRACTION.test(haystack)

  if (hasFamilyAttr) {
    tags.push('가족여행', '아이와함께')
  } else if (hasFree) {
    tags.push('가족여행')
  }

  const days = countItineraryDays(input)
  const moveRatio = heavyMovementRatio(input)
  const relax = RE_RELAX.test(haystack)
  const heavy = RE_HEAVY_ACTIVE.test(haystack)
  const parentCandidate =
    !hasFamilyAttr &&
    !heavy &&
    relax &&
    moveRatio < 0.48 &&
    days >= 1 &&
    days <= 8

  if (parentCandidate) {
    tags.push('부모님여행')
  }

  return uniqueCommaTags(tags)
}

function suggestTargetAudience(input: AdminPendingSecondarySuggestInput, haystack: string): string | null {
  const aud: string[] = []
  const hasFamilyAttr = RE_FAMILY_ATTRACTION.test(haystack)

  if (hasFamilyAttr) {
    aud.push('성인가족')
  }

  const days = countItineraryDays(input)
  const moveRatio = heavyMovementRatio(input)
  const relax = RE_RELAX.test(haystack)
  const heavy = RE_HEAVY_ACTIVE.test(haystack)
  const honeymoon = RE_HONEYMOON_COUPLE.test(input.title) || RE_HONEYMOON_COUPLE.test(haystack.slice(0, 800))

  if (
    !honeymoon &&
    !hasFamilyAttr &&
    !heavy &&
    relax &&
    moveRatio < 0.45 &&
    days >= 1 &&
    days <= 7
  ) {
    aud.push('부모님동반')
  }

  if (honeymoon) {
    aud.push('신혼부부')
  }

  return uniqueCommaTags(aud)
}

export function suggestAdminPendingSecondaryClassification(
  input: AdminPendingSecondarySuggestInput
): AdminPendingSecondarySuggestResult {
  const haystack = buildHaystack(input)
  return {
    primaryRegion: suggestPrimaryRegion(input, haystack),
    themeTags: suggestThemeTags(input, haystack),
    targetAudience: suggestTargetAudience(input, haystack),
  }
}
