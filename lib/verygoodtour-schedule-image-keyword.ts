/**
 * 참좋은여행(verygoodtour): 일차 imageKeyword(1순위)·imageKeyword2(2순위) — Pexels용 영문.
 * LLM 영문 우선; touring 일차 2순위는 본문 한글 명소 매핑 폴백.
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: 관광 일차 2순위 — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI regex — schedule-poi-regex-ssot SSOT — manifest
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { findAllMappedKoreanPoisInText, mapDestination, normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { firstMatchingScheduleSpotEn, firstMatchingSchedulePoiEn } from '@/lib/schedule-poi-regex-ssot'
import {
  pickDistinctSecondScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  englishFromScheduleKoreanSegment,
  scheduleImageKeywordsSemanticallyOverlap,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import { finalizeScheduleImageKeyword, normalizeToPlaceName, isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

export type VerygoodScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type VerygoodDayKind = 'flight' | 'touring' | 'free'

export type VerygoodScheduleImageKeywordOpts = {
  productDestination?: string | null
  detRows?: RegisterScheduleDay[]
  totalDays?: number
}

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const VERYGOOD_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const VERYGOOD_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

function firstVerygoodSpotMatch(h: string): string | null {
  return firstMatchingScheduleSpotEn(h)
}

function firstVerygoodSpotFromRoute(routeText: string | null | undefined): string | null {
  const raw = String(routeText ?? '').trim()
  if (!raw) return null
  for (const seg of raw.split(/\s+-\s+/).map((s) => s.trim()).filter((s) => s.length >= 2)) {
    if (isVerygoodDomesticHubToken(seg)) continue
    const spot = firstVerygoodSpotMatch(seg)
    if (spot) return spot
  }
  return null
}

function lastVerygoodSpotFromRoute(routeText: string | null | undefined): string | null {
  const raw = String(routeText ?? '').trim()
  if (!raw) return null
  const segs = raw.split(/\s+-\s+/).map((s) => s.trim()).filter((s) => s.length >= 2)
  let last: string | null = null
  for (const seg of segs) {
    if (isVerygoodDomesticHubToken(seg)) continue
    const spot = firstVerygoodSpotMatch(seg)
    if (spot) last = spot
  }
  return last
}

function verygoodHaystackFromRow(row: VerygoodScheduleImageKeywordRow, description: string, title: string): string {
  return [description, title, row.routeText].filter(Boolean).join('\n')
}

/** detRows 추출 입력에서 제외할 항공·좌석·수하물 노이즈 줄 */
const VERYGOOD_AVIATION_LINE_RE =
  /(?:seat\s*pitch|수하물|기내수화물|위탁\s*수|마일리지|boarding\s*pass|탑승권|항공권|기내식|미팅장소|미팅시간|액체류|VOD\s*엔터|entertainment\s*service|baggage|carry-on|check-in|e-ticket|board(?:ing)?\s*pass|LO\s*\d{2,4}\b|편\s*출발|편\s*도착|국제공항\s*출발|국제공항\s*도착)/i

/** Pexels 관광지가 아닌 항공·좌석 용어 */
const VERYGOOD_NON_LANDMARK_EN_RE = /\bseat\s*pitch\b/i

const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  /\bLouvre\b/i,
  /Notre\s*Dame/i,
  /\bColosseum\b/i,
  /\bRome\b/i,
  /Forbidden(\s*City)?/i,
  /Big\s*Ben/i,
  /London\s*Eye/i,
  /Tower\s*of\s*London/i,
  /\bBarcelona\b/i,
  /Sagrada\s*Familia/i,
  /\bAmsterdam\b/i,
  /\bVenice\b/i,
  /Brandenburg/i,
  /\bMunich\b/i,
  /Arc\s*de\s*Triomphe/i,
  /Versailles/i,
]

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function keysEqual(a: string, b: string): boolean {
  // REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: kw2 must not semantic-overlap primary — manifest
  return scheduleImageKeywordsSemanticallyOverlap(a, b)
}

function dayHaystack(description: string, title: string): string {
  return [description, title].filter(Boolean).join('\n')
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isVerygoodDomesticHubToken(token: string): boolean {
  const t = String(token ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (DOMESTIC_HUB_KO_RE.test(t)) return true
  if (DOMESTIC_HUB_EN_RE.test(t)) return true
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return false
}

/** 아시아·태평양 목적지 상품에서 LLM이 헛생성한 타대륙 유명 랜드마크 */
export function isVerygoodCrossContinentHallucinationKeyword(
  keyword: string,
  productDestination: string | null | undefined,
): boolean {
  const dest = String(productDestination ?? '').trim()
  if (!dest || !ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  const fin = normalizeToPlaceName(raw)
  const haystacks = fin && fin !== raw ? [raw, fin] : [raw]
  return CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))
}

function isVerygoodLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 2 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (VERYGOOD_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (VERYGOOD_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

function tryAcceptVerygoodLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  const llmRaw = String(raw ?? '').trim()
  if (!llmRaw) return ''
  const candidate = normalizeToPlaceName(llmRaw) || llmRaw
  if (!isVerygoodLlmImageKeywordFormatOk(candidate)) return ''
  if (VERYGOOD_NON_LANDMARK_EN_RE.test(candidate)) return ''
  if (isVerygoodDomesticHubToken(candidate)) return ''
  if (isBareCityOrCountryKeyword(candidate)) return ''
  if (isBlockedScheduleImageKeyword(candidate)) return ''
  if (isVerygoodCrossContinentHallucinationKeyword(candidate, productDestination)) return ''
  try {
    return finalizeScheduleImageKeyword(candidate)
  } catch {
    return ''
  }
}

/** 한글 productDestination·routeText → 영문 랜드마크/도시 힌트 (mapDestination·POI regex SSOT). */
function inferVerygoodEnglishDestinationHint(
  productDestination: string | null | undefined,
  extraHay?: string | null,
): string {
  const hay = [productDestination, extraHay].filter(Boolean).join('\n').trim()
  if (!hay) return ''

  const mapped = mapDestination(String(productDestination ?? '').trim())
  if (mapped && mapped !== String(productDestination ?? '').trim()) {
    const accepted = tryAcceptVerygoodLlmImageKeyword(mapped, productDestination)
    if (accepted) return accepted
  }

  const poi = firstMatchingSchedulePoiEn(hay)
  if (poi) {
    const accepted = tryAcceptVerygoodLlmImageKeyword(poi, productDestination)
    if (accepted) return accepted
  }

  for (const seg of hay.split(/[·/／,，\n\s-]+/).map((s) => s.trim()).filter(Boolean)) {
    const en = englishFromScheduleKoreanSegment(seg)
    if (!en) continue
    const accepted = tryAcceptVerygoodLlmImageKeyword(en, productDestination)
    if (accepted) return accepted
  }
  return ''
}

function firstVerygoodEnglishFromRouteSegments(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of splitRouteTextPlaceSegments(routeText)) {
    const en = englishFromScheduleKoreanSegment(seg)
    if (!en) continue
    const accepted = tryAcceptVerygoodLlmImageKeyword(en, productDestination)
    if (accepted) return accepted
  }
  return ''
}

function isVerygoodAviationSectionHeader(header: string): boolean {
  const h = String(header ?? '').replace(/\s+/g, ' ').trim()
  if (!h) return false
  if (isVerygoodDomesticHubToken(h)) return true
  if (/공항|airport|항공|flight|터미널|T\d\b/i.test(h)) return true
  return false
}

function stripVerygoodAviationNoiseLines(block: string): string {
  return block
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      if (VERYGOOD_AVIATION_LINE_RE.test(t)) return false
      if (/^\[?(?:통제대상|항공\s*위탁|폴란드\s*항공\s*마일리지)/u.test(t)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * detRows description/rawDayBody에서 항공·국내 허브 #### 블록을 제거해 일정 본문만 남긴다.
 */
export function stripVerygoodAviationBlocksForImageKeywordExtract(raw: string): string {
  const text = String(raw ?? '').replace(/\r/g, '').trim()
  if (!text) return ''

  const parts = text.split(/\n(?=####\s+)/)
  const kept: string[] = []
  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch) {
      const header = headerMatch[1]!.trim()
      if (isVerygoodAviationSectionHeader(header)) continue
      kept.push(stripVerygoodAviationNoiseLines(t))
      continue
    }
    kept.push(stripVerygoodAviationNoiseLines(t))
  }
  return kept.join('\n').trim()
}

/** description에 국내 허브·항공 #### 블록 또는 항공 본문 시그널 존재 */
function hasVerygoodDomesticHubOrAviationBlock(description: string, title: string): boolean {
  const text = dayHaystack(description, title)
  if (!text.trim()) return false

  const parts = text.split(/\n(?=####\s+)/)
  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch && isVerygoodAviationSectionHeader(headerMatch[1]!.trim())) return true
  }

  if (/(?:인천|김포|부산|대구|청주|ICN|GMP|PUS|TAE|CJJ)(?:국제)?\s*공항/u.test(text) && /(?:출발|도착|탑승|귀국|입국)/u.test(text)) {
    return true
  }
  if (/국제\s*선|기내식|수하물|탑승권|항공권|LO\s*\d{2,4}\b/i.test(text)) return true
  return false
}

/**
 * description의 #### {지역} 블록에서 따옴표 '…' 명소를 이동 순서대로(한글 그대로, 번역 X).
 * 게이트·보고용.
 */
export function extractVerygoodOrderedDayPoi(description: string, title: string): string[] {
  const text = stripVerygoodAviationBlocksForImageKeywordExtract(String(description ?? ''))
  if (!text.trim()) return []

  const out: string[] = []
  const seen = new Set<string>()
  const parts = text.split(/\n(?=####\s+)/)

  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    let body = t
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch) {
      if (isVerygoodAviationSectionHeader(headerMatch[1]!.trim())) continue
      body = t.replace(/^####\s*[^\n]+\n?/, '')
    }
    const cleaned = stripVerygoodAviationNoiseLines(body)
    for (const m of cleaned.matchAll(/'([^']{2,80})'/gu)) {
      const poi = m[1]!.replace(/\s+/g, ' ').trim()
      if (!poi || seen.has(poi)) continue
      seen.add(poi)
      out.push(poi)
    }
  }

  if (out.length === 0) {
    for (const m of text.matchAll(/'([^']{2,80})'/gu)) {
      const poi = m[1]!.replace(/\s+/g, ' ').trim()
      if (!poi || seen.has(poi)) continue
      seen.add(poi)
      out.push(poi)
    }
  }

  void title
  return out
}

/** routeText 게이트 전용 — ' - ' 세그먼트 중 국내 허브 제외 개수(KO→EN·키워드 생성 없음). */
function countVerygoodNonHubRouteTextSegments(routeText: string | null | undefined): number {
  const raw = String(routeText ?? '').trim()
  if (!raw) return 0
  const parts = raw
    .split(/\s+-\s+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2)
  let count = 0
  for (const p of parts) {
    if (isVerygoodDomesticHubToken(p)) continue
    count++
  }
  return count
}

/** routeText 세그먼트가 도시 연결(튀니스-아부다비)인지, 관광지명(왕궁·동굴 등)인지 구분 */
function routeTextLooksLikeTouringPlaces(routeText: string | null | undefined): boolean {
  const raw = String(routeText ?? '').trim()
  if (!raw) return false
  const segments = raw
    .split(/\s+-\s+/)
    .map((p) => p.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2 && !isVerygoodDomesticHubToken(p))
  if (segments.length >= 3) return true
  if (segments.length < 2) return false
  return segments.some(
    (seg) =>
      Boolean(firstVerygoodSpotMatch(seg)) ||
      /(?:왕궁|사원|교회|광장|동굴|박물관|유적|타워|랜드|월드|리조트|theme|park|투어|촌|거리|시장|성|폭포|해변|섬|하이랜드|night|square|temple|palace|cave|museum)/iu.test(
        seg,
      ),
  )
}

export function classifyVerygoodDayKind(
  description: string,
  title: string,
  dayIndex: number,
  totalDays: number,
  routeText?: string | null,
): VerygoodDayKind {
  if (dayIndex === 1 || (totalDays >= 2 && dayIndex === totalDays)) return 'flight'

  if (hasVerygoodDomesticHubOrAviationBlock(description, title)) return 'flight'

  const pois = extractVerygoodOrderedDayPoi(description, title)
  if (pois.length >= 1) return 'touring'

  if (countVerygoodNonHubRouteTextSegments(routeText) >= 3) return 'touring'

  if (routeTextLooksLikeTouringPlaces(routeText)) return 'touring'

  return 'free'
}

/** LLM 우선 — routeText·본문 infer 폴백(hanatour/ybtour와 동일 계약). */
export function resolveVerygoodPrimaryKeyword(
  row: VerygoodScheduleImageKeywordRow,
  dayKind: VerygoodDayKind,
  productDestination: string | null | undefined,
  priorRows?: ReadonlyArray<VerygoodScheduleImageKeywordRow>,
  totalDays?: number,
): string {
  const description = String(row.description ?? '')
  const title = String(row.title ?? '')
  const bodyHay = dayHaystack(description, title)
  const fullHay = verygoodHaystackFromRow(row, description, title)

  const fromLlm = tryAcceptVerygoodLlmImageKeyword(row.imageKeyword, productDestination)
  if (fromLlm) return fromLlm

  if (dayKind !== 'flight') {
    const fromRoutePrimary =
      lastVerygoodSpotFromRoute(row.routeText) ?? firstVerygoodSpotFromRoute(row.routeText)
    if (fromRoutePrimary) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(fromRoutePrimary, productDestination)
      if (accepted) return accepted
    }
    const fromSpot = firstVerygoodSpotMatch(fullHay)
    if (fromSpot) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(fromSpot, productDestination)
      if (accepted) return accepted
    }
    const fromRouteSeg = firstVerygoodEnglishFromRouteSegments(row.routeText, productDestination)
    if (fromRouteSeg) return fromRouteSeg
    const inferred = inferEnglishPlaceKeywordFromDayContent(row, productDestination)
    if (inferred && !isBlockedScheduleImageKeyword(inferred)) {
      return tryAcceptVerygoodLlmImageKeyword(inferred, productDestination) || ''
    }
    const destHint = inferVerygoodEnglishDestinationHint(productDestination, row.routeText)
    if (destHint) return destHint
    return ''
  }

  const flightBodyHay = bodyHay.replace(/^#{2,6}\s*.+$/gm, '').trim()
  const fromBodySpot = firstVerygoodSpotMatch(flightBodyHay)
  if (fromBodySpot) {
    const accepted = tryAcceptVerygoodLlmImageKeyword(fromBodySpot, productDestination)
    if (accepted) return accepted
  }

  if (dayKind === 'flight') {
    const fromPriorRoute = lastVerygoodSpotFromRoute(
      priorRows?.length ? priorRows[priorRows.length - 1]?.routeText : null,
    )
    if (fromPriorRoute) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(fromPriorRoute, productDestination)
      if (accepted) return accepted
    }
    const fromPrior = lastForeignVerygoodLandmarkFromPriorRows(priorRows ?? [], row, totalDays ?? 0)
    if (fromPrior) return fromPrior
    return ''
  }

  return ''
}

function lastForeignVerygoodUnusedLandmarkFromPriorRows(
  priorRows: ReadonlyArray<VerygoodScheduleImageKeywordRow>,
  used: ReadonlySet<string>,
  productDestination: string | null | undefined,
  totalDays: number,
): string {
  const sorted = [...priorRows].sort((a, b) => Number(b.day) - Number(a.day))
  for (const row of sorted) {
    const day = Number(row.day) || 0
    if (day <= 0) continue
    const kind = classifyVerygoodDayKind(
      String(row.description ?? ''),
      String(row.title ?? ''),
      day,
      totalDays,
      row.routeText,
    )
    if (kind === 'flight') continue
    const hay = verygoodHaystackFromRow(row, String(row.description ?? ''), String(row.title ?? ''))
    for (const raw of [
      ...findAllMappedKoreanPoisInText(hay),
      firstVerygoodSpotFromRoute(row.routeText) ?? '',
      String(row.imageKeyword ?? ''),
    ]) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(raw, productDestination)
      if (accepted && !used.has(normKey(accepted))) return accepted
    }
  }
  return ''
}

function firstForeignVerygoodUnusedLandmarkFromFollowingRows(
  followingRows: ReadonlyArray<VerygoodScheduleImageKeywordRow>,
  used: ReadonlySet<string>,
  productDestination: string | null | undefined,
  totalDays: number,
): string {
  const sorted = [...followingRows].sort((a, b) => Number(a.day) - Number(b.day))
  for (const row of sorted) {
    const day = Number(row.day) || 0
    if (day <= 0) continue
    const kind = classifyVerygoodDayKind(
      String(row.description ?? ''),
      String(row.title ?? ''),
      day,
      totalDays,
      row.routeText,
    )
    if (kind === 'flight') continue
    const hay = verygoodHaystackFromRow(row, String(row.description ?? ''), String(row.title ?? ''))
    for (const raw of [
      ...findAllMappedKoreanPoisInText(hay),
      firstVerygoodSpotFromRoute(row.routeText) ?? '',
      String(row.imageKeyword ?? ''),
    ]) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(raw, productDestination)
      if (accepted && !used.has(normKey(accepted))) return accepted
    }
  }
  return ''
}

function lastForeignVerygoodLandmarkFromPriorRows(
  priorRows: ReadonlyArray<VerygoodScheduleImageKeywordRow>,
  current: VerygoodScheduleImageKeywordRow,
  totalDays: number,
): string {
  const currentDay = Number(current.day) || 0
  const sorted = [...priorRows].sort((a, b) => Number(b.day) - Number(a.day))
  for (const row of sorted) {
    const day = Number(row.day) || 0
    if (day <= 0 || day >= currentDay) continue
    const kind = classifyVerygoodDayKind(
      String(row.description ?? ''),
      String(row.title ?? ''),
      day,
      totalDays,
      row.routeText,
    )
    if (kind === 'flight') continue
    const hay = verygoodHaystackFromRow(row, String(row.description ?? ''), String(row.title ?? ''))
    const spot = firstVerygoodSpotMatch(hay)
    if (spot) {
      const accepted = tryAcceptVerygoodLlmImageKeyword(spot, null)
      if (accepted) return accepted
    }
    const pk = tryAcceptVerygoodLlmImageKeyword(row.imageKeyword, null)
    if (pk) return pk
  }
  return ''
}

/** LLM imageKeyword2 only — dayKind 분기. det 생짜 추출 없음. */
export function resolveVerygoodSecondaryKeyword(
  row: VerygoodScheduleImageKeywordRow,
  primary: string,
  dayKind: VerygoodDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (dayKind !== 'touring') return null

  const fromLlm = tryAcceptVerygoodLlmImageKeyword(row.imageKeyword2, productDestination)
  if (fromLlm && primary && !keysEqual(fromLlm, primary)) return fromLlm

  const bodyHaystack = [row.title, row.description, row.routeText].filter(Boolean).join('\n')
  const pois = findAllMappedKoreanPoisInText(bodyHaystack)
    .map((en) => tryAcceptVerygoodLlmImageKeyword(en, productDestination))
    .filter(Boolean) as string[]
  const fromRoute = pickDistinctSecondScheduleImageKeyword(primary, pois)
  if (fromRoute && !isBlockedScheduleImageKeyword(fromRoute)) return fromRoute
  return null
}

export function polishVerygoodRegisterScheduleImageKeywords(
  schedule: RegisterScheduleDay[],
  detRows: RegisterScheduleDay[],
  productDestination?: string | null,
): RegisterScheduleDay[] {
  return applyVerygoodScheduleImageKeywordsToRows(schedule, {
    detRows,
    productDestination: productDestination ?? null,
    totalDays: schedule.length,
  })
}

export function applyVerygoodScheduleImageKeywordsToRows<
  T extends VerygoodScheduleImageKeywordRow,
>(rows: T[], opts?: VerygoodScheduleImageKeywordOpts): T[] {
  if (!rows?.length) return rows
  const detByDay = new Map<number, RegisterScheduleDay>()
  for (const r of opts?.detRows ?? []) {
    const d = Number(r.day) || 0
    if (d > 0) detByDay.set(d, r)
  }
  const productDestination = opts?.productDestination ?? null
  const totalDays =
    opts?.totalDays && opts.totalDays > 0
      ? opts.totalDays
      : Math.max(...rows.map((r) => Number(r.day) || 0), rows.length)

  const usedPrimaryKeys = new Set<string>()
  const firstPass = rows.map((row, idx) => {
    const day = Number(row.day) || 0
    const det = detByDay.get(day)
    const description = String(det?.description ?? row.description ?? '')
    const title = String(det?.title ?? row.title ?? '').trim()
    const routeText = row.routeText ?? det?.routeText ?? null
    const dayKind = classifyVerygoodDayKind(description, title, day, totalDays, routeText)
    const prior = rows.slice(0, idx).map((r) => {
      const d = Number(r.day) || 0
      const detR = detByDay.get(d)
      return {
        ...r,
        description: String(detR?.description ?? r.description ?? ''),
        title: String(detR?.title ?? r.title ?? ''),
        routeText: r.routeText ?? detR?.routeText ?? null,
      }
    })
    let primary = resolveVerygoodPrimaryKeyword(
      { ...row, description, title, routeText },
      dayKind,
      productDestination,
      prior,
      totalDays,
    )
    if (dayKind === 'flight' && !primary && day === 1) {
      const following = rows.slice(idx + 1).map((r) => {
        const d = Number(r.day) || 0
        const detR = detByDay.get(d)
        return {
          ...r,
          description: String(detR?.description ?? r.description ?? ''),
          title: String(detR?.title ?? r.title ?? ''),
          routeText: r.routeText ?? detR?.routeText ?? null,
        }
      })
      primary =
        firstForeignVerygoodUnusedLandmarkFromFollowingRows(
          following,
          usedPrimaryKeys,
          productDestination,
          totalDays,
        ) || ''
    }
    if (primary && usedPrimaryKeys.has(normKey(primary))) {
      const hay = verygoodHaystackFromRow({ ...row, routeText }, description, title)
      const pois = findAllMappedKoreanPoisInText(hay)
        .map((en) => tryAcceptVerygoodLlmImageKeyword(en, productDestination))
        .filter(Boolean) as string[]
      const spotEn = firstMatchingScheduleSpotEn(hay)
      let alt = pickDistinctSecondScheduleImageKeyword(
        primary,
        spotEn ? [...pois, spotEn] : pois,
      )
      // REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: kw2 must not semantic-overlap primary — manifest
      // 동일 POI 장·단문만 다른 후보는 trip-dup 대체가 아님 — 선행일 미사용 명소로 채움
      if (!alt || usedPrimaryKeys.has(normKey(alt))) {
        alt =
          lastForeignVerygoodUnusedLandmarkFromPriorRows(
            prior,
            usedPrimaryKeys,
            productDestination,
            totalDays,
          ) || ''
      }
      if (alt && !usedPrimaryKeys.has(normKey(alt))) {
        primary = alt
      } else if (!(day === totalDays || dayKind === 'flight')) {
        primary = ''
      }
      // 귀국·flight — 미사용 대체 없으면 출발 현지 허브 soft-reuse 유지
    }
    if (primary) usedPrimaryKeys.add(normKey(primary))
    const secondary = resolveVerygoodSecondaryKeyword(
      { ...row, description, title, routeText },
      primary,
      dayKind,
      productDestination,
    )
    return {
      ...row,
      description,
      title,
      routeText,
      imageKeyword: primary,
      imageKeyword2: secondary,
    } as T
  })

  const tripUsed = new Set<string>()
  return firstPass.map((row) => {
    const day = Number(row.day) || 0
    const description = String(row.description ?? '')
    const title = String(row.title ?? '').trim()
    const routeText = row.routeText ?? null
    const dayKind = classifyVerygoodDayKind(description, title, day, totalDays, routeText)
    let primary = String(row.imageKeyword ?? '').trim()
    if (
      dayKind === 'flight' &&
      !primary &&
      day === totalDays
    ) {
      // 귀국·flight — 공항 only뿐 아니라「하이라얼 - 인천」처럼 현지허브+귀국도 선행일 명소로 채움
      const priorProcessed = firstPass.filter((r) => Number(r.day) > 0 && Number(r.day) < day)
      primary =
        lastForeignVerygoodUnusedLandmarkFromPriorRows(
          priorProcessed,
          tripUsed,
          productDestination,
          totalDays,
        ) || ''
    }
    if (primary) tripUsed.add(normKey(primary))
    const sk = String(row.imageKeyword2 ?? '').trim()
    if (sk) tripUsed.add(normKey(sk))

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: dayKind === 'touring' ? row.imageKeyword2 : null,
    }
  })
}
