/**
 * 노랑풍선(ybtour): 일차 imageKeyword / imageKeyword2 — Pexels 검색용 영문.
 * REGRESSION-FREEZE[ybtour-schedule-image-keyword-distinct]: routeText a–g 순서 + 일차 슬롯 — allocateYbtourImageKeywordsByScheduleRules — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: dedupe 후 imageKeyword2 reconcile — prebuild tests/ybtour-schedule-image-keyword.test.ts
 * REGRESSION-FREEZE[schedule-image-keyword-adjacent-poi]: D1·기내박·귀국 — 인접일 미사용 관광명소·공항 금지 — manifest
 */
import {
  acceptLlmScheduleImageKeyword,
  englishFromScheduleKoreanSegment,
  inferEnglishPlaceKeywordFromDayContent,
  isRegisterScheduleFreeLeisureDay,
  pickDistinctSecondScheduleImageKeyword,
  resolveTourismKeywordPreferDistinctPerDay,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  findAllMappedKoreanPoisInText,
  isDestinationHubEnglishKeyword,
  isKnownDestinationCityEnglishKeyword,
  mapDestination,
  mapKoreanPoiSegment,
} from '@/lib/pexels-keyword'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isNonLandmarkRouteTextSegment,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'
import { findAllScheduleSpotMatchesInText, firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import {
  fillScheduleMiddleImageKeyword2Gap,
  isScheduleAirportLikeImageKeyword,
  isScheduleAirportOnlyRouteText,
  isScheduleAirportRouteSegmentText,
  isScheduleInFlightOvernightRow,
  pickDistinctScheduleRouteSecondKeyword,
  pickUnusedScheduleImageKeywordFromAdjacentDays,
  resolveScheduleKeywordSlotKind,
  shouldFillScheduleMiddleKeyword2Gap,
  type ScheduleAdjacentDayAlloc,
} from '@/lib/schedule-image-keyword-adjacent-poi'

export type YbtourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

/** @deprecated 레거시 분류 — 신규 SSOT는 `YbtourScheduleCardDayKind` */
export type YbtourDayKind = 'flight' | 'touring' | 'free'

export type YbtourScheduleCardDayKind = 'tourism' | 'movement' | 'return_home'

export type YbtourScheduleImageKeywordOpts = {
  productDestination?: string | null
  totalDays?: number
}

export const YBTOUR_SCHEDULE_IMAGE_KEYWORD_PROMPT_ADDENDUM =
  '- **routeText(일정요약)**: 방문지를 a–g 순서로 ` - ` 연결(한국어·괄호 영문 병기 가능).\n' +
  '- **imageKeyword / imageKeyword2**: routeText a–g 순서만. 1일차=1순위 1개(kw2 null), 2~(N-1)일차=1·2순위, N일차=(N-1)일차 routeText에서 그날 미사용 1개(kw2 null). trip-wide 재사용·본문 POI·추측 금지.\n' +
  '- **description(일정설명)**: 1줄 routeText + 분위기·흐름 2~3문장(장소 디테일 금지).\n'

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE =
  /이집트|Egypt|두바이|Dubai|모로코|Morocco|튀니지|Tunisia|케냐|Kenya|남아프리카|South\s*Africa|에티오피아|Ethiopia|이스라엘|Israel|요르단|Jordan/i

const AMERICAS_PRODUCT_DEST_RE =
  /남미|South\s*America|브라질|Brazil|아르헨|Argentina|페루|Peru|볼리비아|Bolivia|칠레|Chile|콜롬비아|Colombia|에콰도르|Ecuador|우루과이|Uruguay|파라과이|Paraguay|베네수|Venezuela|이과수|Iguazu|마추|Machu|리우|Rio|부에노스|Buenos|리마|Lima|쿠스코|Cusco|우유니|Uyuni|라파즈|La\s*Paz|멕시코|Mexico|미국|USA|United\s*States|캐나다|Canada|미동부|미서부|북미|North\s*America/i

const JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE =
  /\b(Osaka(?:\s*Castle)?|Tokyo|Kyoto|Dotonbori|Shibuya|Harajuku|Fushimi|Kinkakuji|Ginkakuji|Mount\s*Fuji|Fuji)\b/i

const YBTOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const YBTOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

const GENERIC_YBTOUR_PRODUCT_DEST_RE = /^(?:미지정|미정|기타|해외|overseas|unknown)$/i

/** primaryDestination 미지정 — 일정·키워드 본문에서 남미·아시아 등 목적지 힌트 SSOT */
export function inferYbtourEffectiveProductDestination(
  productDestination: string | null | undefined,
  rows: readonly YbtourScheduleImageKeywordRow[],
): string {
  const dest = String(productDestination ?? '').trim()
  if (dest && !GENERIC_YBTOUR_PRODUCT_DEST_RE.test(dest)) return dest
  const hay = rows
    .flatMap((r) => [r.title, r.description, r.routeText, r.imageKeyword, r.imageKeyword2])
    .filter(Boolean)
    .join('\n')
  if (AMERICAS_PRODUCT_DEST_RE.test(hay)) return 'South America'
  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(hay)) return 'Middle East'
  if (ASIA_PACIFIC_PRODUCT_DEST_RE.test(hay)) return 'Asia Pacific'
  return dest
}

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

/** 공백-하이픈-공백 외 · → — 등 공급사 본문 구분자 (에어텔 routeText·레거시 헬퍼) */
const ROUTE_TEXT_SEGMENT_SPLIT_RE =
  /\s*(?:-(?!\d)|[\u2010\u2011\u2012\u2013\u2014\u2212–—]|\u2192|\u00b7|\u2022)\s*/

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function keysEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  return normKey(a) === normKey(b)
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function routeTextSegments(routeText: string | null | undefined): string[] {
  const rt = String(routeText ?? '').trim()
  if (!rt) return []
  return rt
    .split(ROUTE_TEXT_SEGMENT_SPLIT_RE)
    .map(stripRouteSegmentNoise)
    .filter((s) => s.length >= 2)
}

function latinRouteTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText).map(stripRouteSegmentNoise).filter((s) => s.length >= 2)
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isYbtourDomesticHubToken(token: string): boolean {
  const t = stripRouteSegmentNoise(token)
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

function isLatinRoutePlaceSegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t || t.length < 2) return false
  if (/[가-힣]/.test(t)) return false
  if (/[\u4e00-\u9fff]/.test(t)) return false
  return t.replace(/[^A-Za-z]/g, '').length >= 3
}

function pickEnglishRouteTextPlace(routeText: string | null | undefined, pickLast: boolean): string {
  const segs = latinRouteTextSegments(routeText).filter(
    (s) => isLatinRoutePlaceSegment(s) && !isYbtourDomesticHubToken(s),
  )
  if (!segs.length) return ''
  const raw = pickLast ? segs[segs.length - 1]! : segs[0]!
  try {
    return finalizeScheduleImageKeyword(raw)
  } catch {
    return ''
  }
}

function extractLatinEnglishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isYbtourDomesticHubToken(t)) return ''
  const paren = t.match(/\(\s*([A-Za-z][A-Za-z0-9\s,.'-]{2,62})\s*\)/)
  if (paren?.[1]) {
    try {
      return finalizeScheduleImageKeyword(paren[1])
    } catch {
      return ''
    }
  }
  if (isLatinRoutePlaceSegment(t)) {
    try {
      return finalizeScheduleImageKeyword(t)
    } catch {
      return ''
    }
  }
  return ''
}

function resolveRouteTextSecondLatinPlace(routeText: string | null | undefined): string {
  const segs = latinRouteTextSegments(routeText)
  if (segs.length < 2) return ''
  return extractLatinEnglishFromRouteSegment(segs[1]!)
}

function isYbtourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 3 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (YBTOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (YBTOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

export function isYbtourCrossContinentHallucinationKeyword(
  keyword: string,
  productDestination: string | null | undefined,
): boolean {
  const dest = String(productDestination ?? '').trim()
  const raw = String(keyword ?? '').trim()
  if (!raw || !dest) return false
  const fin = normalizeToPlaceName(raw)
  const haystacks = fin && fin !== raw ? [raw, fin] : [raw]

  if (MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE.test(dest)) {
    if (haystacks.some((h) => JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE.test(h))) return true
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
  }

  if (AMERICAS_PRODUCT_DEST_RE.test(dest)) {
    if (CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))) return true
  }

  if (!ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  return CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))
}

function tryAcceptYbtourLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  return acceptLlmScheduleImageKeyword(raw, {
    productDestination,
    isFormatOk: isYbtourLlmImageKeywordFormatOk,
    isDomesticHub: isYbtourDomesticHubToken,
    isCrossContinentHallucination: isYbtourCrossContinentHallucinationKeyword,
  })
}

function inferYbtourKeywordFromDayContent(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const inferred = inferEnglishPlaceKeywordFromDayContent(row, productDestination)
  if (!inferred) return ''
  return tryAcceptYbtourLlmImageKeyword(inferred, productDestination)
}

/** routeText 한글 세그먼트 KO→EN (노랑풍선 routeText SSOT 보완 — 라틴·본문 추론 사이) */
function pickFirstAcceptedFromRouteKoreanSegments(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(row.routeText)) {
    if (isYbtourDomesticHubToken(seg)) continue
    const en = englishFromRouteSegment(seg)
    if (!en) continue
    const accepted = tryAcceptYbtourLlmImageKeyword(en, productDestination)
    if (accepted) return accepted
  }
  return ''
}

function buildYbtourDayHaystack(row: YbtourScheduleImageKeywordRow): string {
  return [row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
}

export function classifyYbtourScheduleCardDayKind(
  day: number,
  maxDay: number,
  joined: string,
): YbtourScheduleCardDayKind {
  const j = joined.slice(0, 12_000)
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(홍콩|Hong\s*Kong|두바이|Dubai|카이로|Cairo|상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|호치민|방콕|Bangkok|Tokyo|Osaka|치토세|Chitose|삿포로|Sapporo|북해도|Hokkaido)/i.test(j)
  ) {
    return 'return_home'
  }
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(?:귀국|인천|ICN|김포|GMP)(?:\s*국제)?\s*공항?\s*도착/u.test(j)
  ) {
    return 'return_home'
  }
  if (day === maxDay && maxDay >= 2 && /(귀국|인천\s*도착|ICN\s*도착|서울\s*도착)/.test(j) && /출발/.test(j)) {
    return 'return_home'
  }
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천|부산|PUS|대구|TAE|청주|CJJ|치토세|Chitose|삿포로|Sapporo)/.test(j)) {
    return 'movement'
  }
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(홍콩|Hong\s*Kong|두바이|Dubai|카이로|Cairo|상해|PVG|김포|인천|부산|치토세|Chitose|삿포로|Sapporo|북해도|Hokkaido)/i.test(j) &&
    /(가이드|호텔|공항|출발|탑승)/.test(j)
  ) {
    return 'movement'
  }
  return 'tourism'
}

function isYbtourRouteResortOrHotelSegment(seg: string): boolean {
  return /(?:온천|호텔|Hotel|Resort|뷔페|석식|조식)/i.test(stripRouteSegmentNoise(seg))
}

/** movement 일차 — 본문 명소 우선, routeText는 온천·호텔 세그먼트 제외 */
function buildYbtourDayBodyHaystack(row: YbtourScheduleImageKeywordRow): string {
  return [row.title, row.description].filter(Boolean).join('\n').replace(/\r/g, '')
}

function pickFirstScheduleSpotFromDayBody(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const body = buildYbtourDayBodyHaystack(row)
  if (!body.trim()) return ''
  const matches = findAllScheduleSpotMatchesInText(body).sort((a, b) => a.index - b.index)
  for (const { en } of matches) {
    const accepted = tryAcceptYbtourLlmImageKeyword(en, productDestination)
    if (accepted && !isBareCityOrCountryKeyword(accepted)) return accepted
  }
  return ''
}

function pickYbtourMovementForeignPlaceKeyword(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const fromBody = pickFirstScheduleSpotFromDayBody(row, productDestination)
  if (fromBody) return fromBody
  const haystack = buildYbtourDayHaystack(row)
  const fromSpot = firstMatchingScheduleSpotEn(haystack)
  if (fromSpot) {
    const accepted = tryAcceptYbtourLlmImageKeyword(fromSpot, productDestination)
    if (accepted && !isBareCityOrCountryKeyword(accepted)) return accepted
  }
  for (const en of findAllMappedKoreanPoisInText(haystack)) {
    const accepted = tryAcceptYbtourLlmImageKeyword(en, productDestination)
    if (accepted && !isBareCityOrCountryKeyword(accepted)) return accepted
  }
  for (const seg of routeTextSegments(row.routeText)) {
    if (isYbtourDomesticHubToken(seg) || isYbtourRouteResortOrHotelSegment(seg)) continue
    const en = englishFromRouteSegment(seg)
    if (en && !isBareCityOrCountryKeyword(en)) return en
  }
  return inferYbtourKeywordFromDayContent(row, productDestination)
}

function resolveYbtourPrimaryKeywordCore(
  row: YbtourScheduleImageKeywordRow,
  dayKind: YbtourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: YbtourScheduleImageKeywordRow[],
): string {
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptYbtourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)

  if (dayKind === 'return_home') {
    return (
      pickFirstScheduleSpotFromDayBody(row, productDestination) ||
      inferYbtourKeywordFromDayContent(row, productDestination)
    )
  }

  if (isRegisterScheduleFreeLeisureDay(buildYbtourDayHaystack(row))) {
    return ''
  }

  if (dayKind === 'movement') {
    return pickYbtourMovementForeignPlaceKeyword(row, productDestination)
  }

  if (dayKind === 'tourism' && accepted) {
    const fromRouteLast = pickEnglishRouteTextPlace(row.routeText, true)
    const fromRouteFirst = pickEnglishRouteTextPlace(row.routeText, false)
    const fromRouteKo = pickFirstAcceptedFromRouteKoreanSegments(row, productDestination)
    const fromInfer = inferYbtourKeywordFromDayContent(row, productDestination)
    const resolved = resolveTourismKeywordPreferDistinctPerDay({
      row,
      acceptedLlm: accepted,
      allRows,
      acceptLlm,
      daySpecificCandidates: [fromRouteLast, fromRouteFirst, fromRouteKo, fromInfer].filter(
        (k): k is string => Boolean(k),
      ),
    })
    if (resolved) return resolved
  }

  if (accepted) return accepted

  const tourismCandidates = collectYbtourDayPrimaryCandidates(row, dayKind, productDestination)
  if (tourismCandidates[0]) return tourismCandidates[0]

  return inferYbtourKeywordFromDayContent(row, productDestination)
}

/** 관광 일차 1순위 후보 — route·본문 명소 우선, LLM은 마지막 */
function collectYbtourDayPrimaryCandidates(
  row: YbtourScheduleImageKeywordRow,
  dayKind: YbtourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const accepted = tryAcceptYbtourLlmImageKeyword(raw, productDestination)
    if (!accepted) return
    if (out.some((x) => keysEqual(x, accepted))) return
    out.push(accepted)
  }

  if (dayKind === 'movement' || dayKind === 'return_home') {
    push(pickEnglishRouteTextPlace(row.routeText, true))
    push(pickEnglishRouteTextPlace(row.routeText, false))
    push(pickFirstAcceptedFromRouteKoreanSegments(row, productDestination))
    push(inferYbtourKeywordFromDayContent(row, productDestination))
    push(row.imageKeyword)
    return out
  }

  const bodyHay = buildYbtourDayBodyHaystack(row)
  if (/▶/.test(bodyHay)) {
    for (const { en } of findAllScheduleSpotMatchesInText(bodyHay).sort((a, b) => a.index - b.index)) {
      push(en)
    }
  }
  for (const kw of collectRouteLandmarkKeywordsFromRouteText(row.routeText)) push(kw)
  for (const en of findAllMappedKoreanPoisInText(buildYbtourDayHaystack(row))) push(en)
  push(pickEnglishRouteTextPlace(row.routeText, true))
  push(pickEnglishRouteTextPlace(row.routeText, false))
  push(pickFirstAcceptedFromRouteKoreanSegments(row, productDestination))
  push(inferYbtourKeywordFromDayContent(row, productDestination))
  push(row.imageKeyword)
  return out
}

/** LLM이 동일 랜드마크를 여러 관광 일차에 반복할 때 route·본문 명소로 일차별 분산 */
function dedupeYbtourTourismPrimaryKeywordsAcrossDays<T extends YbtourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const used = new Set<string>()
  const tripLandmarks: string[] = []

  const sorted = rows
    .filter((r) => Number(r.day) > 0)
    .sort((a, b) => Number(a.day) - Number(b.day))

  for (const row of sorted) {
    const haystack = buildYbtourDayHaystack(row)
    const dayKind = classifyYbtourScheduleCardDayKind(Number(row.day), maxDay, haystack)
    if (dayKind !== 'tourism') continue
    for (const kw of collectYbtourDayPrimaryCandidates(row, dayKind, productDestination)) {
      if (!tripLandmarks.some((x) => keysEqual(x, kw))) tripLandmarks.push(kw)
    }
  }

  const pickUnused = (cands: string[]): string | null => {
    for (const kw of cands) {
      const nk = normKey(kw)
      if (!nk || used.has(nk)) continue
      used.add(nk)
      return kw
    }
    return null
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row

    const haystack = buildYbtourDayHaystack(row)
    const dayKind = classifyYbtourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'tourism') return row

    const primary = String(row.imageKeyword ?? '').trim()
    if (!primary) return row

    const nk = normKey(primary)
    if (!used.has(nk)) {
      used.add(nk)
      return row
    }

    const fromDay = pickUnused(collectYbtourDayPrimaryCandidates(row, dayKind, productDestination))
    if (fromDay) return { ...row, imageKeyword: fromDay }

    const fromTrip = pickUnused(tripLandmarks)
    if (fromTrip) return { ...row, imageKeyword: fromTrip }

    return row
  })
}

function resolveYbtourSecondaryKeywordCore(
  row: YbtourScheduleImageKeywordRow,
  primary: string,
  dayKind: YbtourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const fromLlm = tryAcceptYbtourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (fromLlm && normKey(fromLlm) !== normKey(primary)) return fromLlm

  const fromRouteRaw = resolveRouteTextSecondLatinPlace(row.routeText)
  const fromRoute = fromRouteRaw
    ? tryAcceptYbtourLlmImageKeyword(fromRouteRaw, productDestination)
    : ''
  if (fromRoute && normKey(fromRoute) !== normKey(primary)) return fromRoute

  const rawLandmarks = collectRouteLandmarkKeywordsFromRouteText(row.routeText)
  const fromRouteOrdered = pickDistinctSecondScheduleImageKeyword(primary, rawLandmarks)
  if (fromRouteOrdered) {
    const accepted = tryAcceptYbtourLlmImageKeyword(fromRouteOrdered, productDestination)
    if (accepted && normKey(accepted) !== normKey(primary)) return accepted
    if (normKey(fromRouteOrdered) !== normKey(primary)) return fromRouteOrdered
  }

  return null
}

export function applyYbtourScheduleImageKeywordsToRows<
  T extends YbtourScheduleImageKeywordRow,
>(rows: T[], opts?: YbtourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = inferYbtourEffectiveProductDestination(
    opts?.productDestination ?? null,
    rows,
  )
  let out = allocateYbtourImageKeywordsByScheduleRules(rows, maxDay, productDestination)

  const used = new Set<string>()
  for (const row of out) {
    const kw = String(row.imageKeyword ?? '').trim()
    if (kw) used.add(normKey(kw))
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (kw2) used.add(normKey(kw2))
  }

  return out.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row

    const haystack = buildYbtourDayHaystack(row)
    const dayKind = classifyYbtourScheduleCardDayKind(day, maxDay, haystack)
    const slotKind = resolveYbtourKeywordSlotKind(day, maxDay, sorted.length)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = row.imageKeyword2

    if (!primary) {
      const resolved = resolveYbtourPrimaryKeywordCore(
        row,
        dayKind,
        day,
        maxDay,
        productDestination,
        out,
      )
      if (resolved) {
        primary = resolved
        used.add(normKey(primary))
      }
    }

    if (!primary && slotKind === 'middle') {
      const byDay = new Map<number, ScheduleAdjacentDayAlloc>()
      for (const r of out) {
        const d = Number(r.day)
        if (d <= 0) continue
        byDay.set(d, {
          primary: String(r.imageKeyword ?? '').trim(),
          secondary: r.imageKeyword2 ?? null,
        })
      }
      primary =
        pickYbtourAdjacentUnusedKeyword(
          day,
          maxDay,
          out,
          used,
          byDay,
          productDestination,
          'both',
          undefined,
          true,
        ) ||
        pickYbtourAdjacentUnusedKeyword(
          day,
          maxDay,
          out,
          used,
          byDay,
          productDestination,
          'both',
        ) ||
        ''
      if (primary) used.add(normKey(primary))
    }

    if (
      slotKind === 'middle' &&
      primary &&
      !String(secondary ?? '').trim()
    ) {
      const routeOrdered = collectYbtourRouteOrderedSegmentKeywords(row.routeText)
      const ordered = collectYbtourDayOrderedKeywordCandidates(row, productDestination)
      const movementOnly =
        isScheduleInFlightOvernightRow(row) ||
        isScheduleAirportOnlyRouteText(row.routeText, isYbtourDomesticHubToken) ||
        isYbtourAirportTransferDayRow(row)

      secondary =
        resolveYbtourSecondaryKeywordCore(row, primary, dayKind, productDestination) ||
        pickDistinctScheduleRouteSecondKeyword(
          primary,
          routeOrdered,
          ordered,
          ybtourKeywordKeysOverlap,
          (kw) =>
            isYbtourBlockedRouteImageKeyword(kw, productDestination) ||
            isScheduleAirportLikeImageKeyword(kw),
        ) ||
        ''

      if (
        !secondary &&
        shouldFillScheduleMiddleKeyword2Gap(row, routeOrdered, primary, ybtourKeywordKeysOverlap, {
          movementOnly,
          airportTransfer: isYbtourAirportTransferDayRow(row),
        })
      ) {
        const byDay = new Map<number, ScheduleAdjacentDayAlloc>()
        for (const r of out) {
          const d = Number(r.day)
          if (d <= 0) continue
          byDay.set(d, {
            primary: String(r.imageKeyword ?? '').trim(),
            secondary: r.imageKeyword2 ?? null,
          })
        }
        secondary = fillScheduleMiddleImageKeyword2Gap({
          primary,
          routeOrdered,
          extraOrdered: ordered,
          overlaps: ybtourKeywordKeysOverlap,
          rejectKeyword: (kw) =>
            isYbtourBlockedRouteImageKeyword(kw, productDestination) ||
            isScheduleAirportLikeImageKeyword(kw),
          pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
            pickYbtourAdjacentUnusedKeyword(
              day,
              maxDay,
              out,
              used,
              byDay,
              productDestination,
              'both',
              primary,
              allowTripWideReuse,
              (kw) =>
                isYbtourBlockedRouteImageKeyword(kw, productDestination) ||
                isScheduleAirportLikeImageKeyword(kw),
              ignoreAdjacentDaySlots,
            ),
        })
        secondary = finalizeYbtourSecondaryKeyword(secondary, primary, productDestination)
        if (secondary) used.add(normKey(secondary))
      }
    }

    if (secondary && ybtourKeywordKeysOverlap(String(secondary), primary)) {
      secondary = null
    }

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: slotKind === 'middle' ? (String(secondary ?? '').trim() || null) : null,
    }
  })
}

type YbtourKeywordSlotKind = 'departure' | 'middle' | 'return'

function ybtourKeywordKeysOverlap(a: string, b: string): boolean {
  const ak = normKey(a)
  const bk = normKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  return ak.includes(bk) || bk.includes(ak)
}

function collectYbtourRouteOrderedSegmentKeywords(
  routeText: string | null | undefined,
): string[] {
  const out: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    if (isYbtourDomesticHubToken(seg)) continue
    if (isScheduleAirportRouteSegmentText(seg)) continue

    const en = englishFromRouteSegment(seg)
    if (!en || isYbtourDomesticHubToken(en)) continue
    if (out.some((x) => keysEqual(x, en))) continue
    out.push(en)
  }
  return out
}

/** routeText a→g 순서 우선, 부족 시 route·본문 명소·LLM — allocate 슬롯 채움 SSOT */
function collectYbtourDayOrderedKeywordCandidates(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const pushAccepted = (raw: string | null | undefined) => {
    const accepted = tryAcceptYbtourLlmImageKeyword(raw, productDestination)
    if (!accepted) return
    if (out.some((x) => keysEqual(x, accepted))) return
    out.push(accepted)
  }
  for (const kw of collectYbtourRouteOrderedSegmentKeywords(row.routeText)) {
    pushAccepted(kw)
  }
  for (const kw of collectRouteLandmarkKeywordsFromRouteText(row.routeText)) {
    pushAccepted(kw)
  }
  const bodyHay = buildYbtourDayBodyHaystack(row)
  for (const { en } of findAllScheduleSpotMatchesInText(bodyHay).sort((a, b) => a.index - b.index)) {
    pushAccepted(en)
  }
  for (const en of findAllMappedKoreanPoisInText(buildYbtourDayHaystack(row))) {
    pushAccepted(en)
  }
  pushAccepted(row.imageKeyword)
  pushAccepted(row.imageKeyword2)
  return out
}

function pickYbtourReturnKeywordFromPrevDay(
  prevAlloc: { primary: string; secondary: string | null } | undefined,
  prevRouteOrdered: readonly string[],
  prevFullCandidates: readonly string[],
): string {
  const pickFrom = (list: readonly string[]): string => {
    for (let i = list.length - 1; i >= 0; i--) {
      const kw = list[i]!
      if (prevAlloc && keysEqual(kw, prevAlloc.primary)) continue
      if (prevAlloc?.secondary && keysEqual(kw, prevAlloc.secondary)) continue
      if (kw) return kw
    }
    return ''
  }
  return pickFrom(prevRouteOrdered) || pickFrom(prevFullCandidates)
}

function isYbtourBlockedRouteImageKeyword(
  kw: string,
  productDestination: string | null | undefined,
): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isYbtourCrossContinentHallucinationKeyword(t, productDestination)) return true
  return /\bairport\b|international\s+airport|departure\s+terminal|arrival\s+hall/i.test(t)
}

function pickFirstUnusedYbtourRouteKeyword(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
  productDestination?: string | null,
): string {
  for (const kw of ordered) {
    if (!kw) continue
    if (isYbtourBlockedRouteImageKeyword(kw, productDestination ?? null)) continue
    if (excludePrimary && ybtourKeywordKeysOverlap(kw, excludePrimary)) continue
    const nk = normKey(kw)
    if (!nk || used.has(nk)) continue
    return kw
  }
  return ''
}

function isYbtourAirportTransferDayRow(row: YbtourScheduleImageKeywordRow): boolean {
  const hay = buildYbtourDayHaystack(row)
  return /(?:국제)?\s*공항|\bairport\b|하츠필드|Hartsfield|Jackson/i.test(hay)
}

function finalizeYbtourAllocatedPrimaryKeyword(
  raw: string,
  row: YbtourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  sorted: readonly YbtourScheduleImageKeywordRow[],
  used: ReadonlySet<string>,
  byDay: ReadonlyMap<number, ScheduleAdjacentDayAlloc>,
  productDestination: string | null | undefined,
): string {
  if (isYbtourAirportTransferDayRow(row)) {
    return (
      pickYbtourAdjacentUnusedKeyword(
        day,
        maxDay,
        sorted,
        used,
        byDay,
        productDestination,
        'both',
        undefined,
        true,
      ) ||
      pickYbtourAdjacentUnusedKeyword(
        day,
        maxDay,
        sorted,
        used,
        byDay,
        productDestination,
        'both',
      ) ||
      ''
    )
  }
  let primary = String(raw ?? '').trim()
  if (!primary) return ''
  if (isYbtourBlockedRouteImageKeyword(primary, productDestination ?? null)) {
    return (
      pickYbtourAdjacentUnusedKeyword(
        day,
        maxDay,
        sorted,
        used,
        byDay,
        productDestination,
        'both',
      ) || ''
    )
  }
  const accepted = tryAcceptYbtourLlmImageKeyword(primary, productDestination)
  return accepted || primary
}

function pickYbtourDepartureRepresentativeKeyword(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(routeText)) {
    if (isYbtourDomesticHubToken(seg)) continue
    const en = englishFromRouteSegment(seg)
    if (en && !isYbtourDomesticHubToken(en)) return en
    const t = stripRouteSegmentNoise(seg)
    const fromDest = mapDestination(t)
    if (fromDest && fromDest !== t && !/[\uAC00-\uD7AF]/.test(fromDest)) {
      try {
        return finalizeScheduleImageKeyword(fromDest)
      } catch {
        /* continue */
      }
    }
  }
  const dest = String(productDestination ?? '').trim()
  if (!dest) return ''
  const fromProduct = englishFromRouteSegment(dest) || mapDestination(dest)
  if (!fromProduct || isYbtourDomesticHubToken(fromProduct)) return ''
  try {
    return finalizeScheduleImageKeyword(fromProduct)
  } catch {
    return fromProduct
  }
}

/** 1일차=departure, 2~(N-1)=middle, N일차=return — 일차 번호 SSOT (dayKind·자유일 무관) */
function resolveYbtourKeywordSlotKind(
  day: number,
  maxDay: number,
  scheduleRowCount: number,
): YbtourKeywordSlotKind {
  return resolveScheduleKeywordSlotKind(day, maxDay, scheduleRowCount)
}

function findYbtourRowByDay<T extends YbtourScheduleImageKeywordRow>(
  sorted: readonly T[],
  targetDay: number,
): T | undefined {
  return sorted.find((r) => Number(r.day) === targetDay)
}

function findPrevYbtourScheduledRow<T extends YbtourScheduleImageKeywordRow>(
  sorted: readonly T[],
  day: number,
): T | undefined {
  let prev: T | undefined
  for (const row of sorted) {
    const d = Number(row.day)
    if (d >= day) break
    prev = row
  }
  return prev
}

function ybtourAdjacentLandmarkCandidates(
  row: YbtourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  return collectYbtourDayOrderedKeywordCandidates(row, productDestination)
}

function pickYbtourAdjacentUnusedKeyword(
  anchorDay: number,
  maxDay: number,
  sorted: readonly YbtourScheduleImageKeywordRow[],
  used: ReadonlySet<string>,
  byDay: ReadonlyMap<number, ScheduleAdjacentDayAlloc>,
  productDestination: string | null | undefined,
  scan: 'forward' | 'backward' | 'both',
  excludePrimary?: string,
  allowTripWideReuse = false,
  rejectKeyword?: (kw: string) => boolean,
  ignoreAdjacentDaySlots = false,
): string {
  return pickUnusedScheduleImageKeywordFromAdjacentDays({
    anchorDay,
    maxDay,
    sorted,
    getDay: (r) => Number(r.day),
    used,
    normKey,
    collectLandmarkCandidates: (r) => ybtourAdjacentLandmarkCandidates(r, productDestination),
    byDayAlloc: byDay,
    scan,
    excludePrimary,
    allowTripWideReuse,
    ignoreAdjacentDaySlots,
    rejectKeyword:
      rejectKeyword ??
      ((kw) =>
        isYbtourDomesticHubToken(kw) ||
        isScheduleAirportLikeImageKeyword(kw) ||
        isYbtourCrossContinentHallucinationKeyword(kw, productDestination)),
  })
}

function finalizeYbtourSecondaryKeyword(
  raw: string | null | undefined,
  primary: string,
  productDestination: string | null | undefined,
): string {
  const secondary = String(raw ?? '').trim()
  if (!secondary || keysEqual(secondary, primary)) return ''
  const accepted = tryAcceptYbtourLlmImageKeyword(secondary, productDestination)
  if (accepted && !keysEqual(accepted, primary)) return accepted
  if (isYbtourBlockedRouteImageKeyword(secondary, productDestination ?? null)) return ''
  return secondary
}

/** 일정요약 routeText 순서 + 일차 슬롯 규칙 SSOT (이 상품 1건만, trip-wide used) */
function allocateYbtourImageKeywordsByScheduleRules<T extends YbtourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const used = new Set<string>()
  const byDay = new Map<number, { primary: string; secondary: string | null }>()

  for (const row of sorted) {
    const day = Number(row.day)
    const slotKind = resolveYbtourKeywordSlotKind(day, maxDay, sorted.length)

    if (slotKind === 'departure') {
      const routeOrdered = collectYbtourRouteOrderedSegmentKeywords(row.routeText)
      let primary =
        pickYbtourDepartureRepresentativeKeyword(row.routeText, productDestination) || ''
      if (primary && (isYbtourDomesticHubToken(primary) || isScheduleAirportLikeImageKeyword(primary))) {
        primary = ''
      }
      if (!primary) {
        primary = pickFirstUnusedYbtourRouteKeyword(routeOrdered, used, undefined, productDestination)
      }
      if (!primary && !isScheduleInFlightOvernightRow(row)) {
        const hasRoutePlace = routeOrdered.some((kw) => String(kw ?? '').trim())
        if (isScheduleAirportOnlyRouteText(row.routeText, isYbtourDomesticHubToken) || !hasRoutePlace) {
          primary =
            pickYbtourAdjacentUnusedKeyword(
              day,
              maxDay,
              sorted,
              used,
              byDay,
              productDestination,
              'forward',
            ) || primary
        }
      }
      if (primary && isScheduleAirportLikeImageKeyword(primary)) primary = ''
      if (primary) used.add(normKey(primary))
      byDay.set(day, { primary, secondary: null })
      continue
    }

    if (slotKind === 'return') {
      let primary = ''
      let walkDay = maxDay - 1
      while (walkDay > 0 && !primary) {
        const prevRow =
          findYbtourRowByDay(sorted, walkDay) ?? findPrevYbtourScheduledRow(sorted, walkDay + 1)
        if (!prevRow) break
        const prevAlloc = byDay.get(Number(prevRow.day))
        const prevRouteOrdered = collectYbtourRouteOrderedSegmentKeywords(prevRow.routeText)
        const prevFull = collectYbtourDayOrderedKeywordCandidates(prevRow, productDestination)
        primary = pickYbtourReturnKeywordFromPrevDay(prevAlloc, prevRouteOrdered, prevFull)
        walkDay = Number(prevRow.day) - 1
      }
      if (!primary) {
        primary =
          pickYbtourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'backward',
          ) || ''
      }
      if (primary) used.add(normKey(primary))
      byDay.set(day, { primary, secondary: null })
      continue
    }

    const movementOnly =
      isScheduleInFlightOvernightRow(row) ||
      isScheduleAirportOnlyRouteText(row.routeText, isYbtourDomesticHubToken) ||
      isYbtourAirportTransferDayRow(row)

    const routeOrdered = collectYbtourRouteOrderedSegmentKeywords(row.routeText)
    const ordered = collectYbtourDayOrderedKeywordCandidates(row, productDestination)
    let primary = movementOnly
      ? ''
      : pickFirstUnusedYbtourRouteKeyword(routeOrdered, used, undefined, productDestination)
    if (!primary) {
      primary = pickFirstUnusedYbtourRouteKeyword(ordered, used, undefined, productDestination)
    }
    if (movementOnly) {
      if (!primary || isScheduleAirportLikeImageKeyword(primary)) {
        primary =
          pickYbtourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'both',
          ) || primary
      }
    } else if (!primary) {
      primary =
        pickYbtourAdjacentUnusedKeyword(
          day,
          maxDay,
          sorted,
          used,
          byDay,
          productDestination,
          'backward',
          undefined,
          true,
        ) ||
        pickYbtourAdjacentUnusedKeyword(
          day,
          maxDay,
          sorted,
          used,
          byDay,
          productDestination,
          'backward',
        ) ||
        ''
    }
    primary = finalizeYbtourAllocatedPrimaryKeyword(
      primary,
      row,
      day,
      maxDay,
      sorted,
      used,
      byDay,
      productDestination,
    )
    if (primary) used.add(normKey(primary))
    let secondary = primary
      ? pickFirstUnusedYbtourRouteKeyword(routeOrdered, used, primary, productDestination) || ''
      : ''
    if (!secondary && primary) {
      const fromLlm2 = tryAcceptYbtourLlmImageKeyword(row.imageKeyword2, productDestination)
      if (
        fromLlm2 &&
        !ybtourKeywordKeysOverlap(fromLlm2, primary) &&
        !used.has(normKey(fromLlm2))
      ) {
        secondary = fromLlm2
      }
    }
    if (!secondary && primary) {
      secondary =
        pickDistinctSecondScheduleImageKeyword(primary, ordered) ||
        resolveYbtourSecondaryKeywordCore(row, primary, 'tourism', productDestination) ||
        ''
      if (secondary && used.has(normKey(secondary))) secondary = ''
    }
    if (
      primary &&
      !secondary &&
      shouldFillScheduleMiddleKeyword2Gap(row, routeOrdered, primary, ybtourKeywordKeysOverlap, {
        movementOnly,
        airportTransfer: isYbtourAirportTransferDayRow(row),
      })
    ) {
      secondary = fillScheduleMiddleImageKeyword2Gap({
        primary,
        routeOrdered,
        extraOrdered: ordered,
        overlaps: ybtourKeywordKeysOverlap,
        rejectKeyword: (kw) =>
          isYbtourBlockedRouteImageKeyword(kw, productDestination) ||
          isScheduleAirportLikeImageKeyword(kw),
        pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
          pickYbtourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'both',
            primary,
            allowTripWideReuse,
            (kw) =>
              isYbtourBlockedRouteImageKeyword(kw, productDestination) ||
              isScheduleAirportLikeImageKeyword(kw),
            ignoreAdjacentDaySlots,
          ),
      })
    }
    secondary = finalizeYbtourSecondaryKeyword(secondary, primary, productDestination)
    if (secondary && keysEqual(secondary, primary)) {
      secondary = ''
    }
    if (secondary) used.add(normKey(secondary))
    byDay.set(day, { primary, secondary: secondary || null })
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }
    const alloc = byDay.get(day)
    if (!alloc) {
      return { ...row, imageKeyword: '', imageKeyword2: null }
    }
    return {
      ...row,
      imageKeyword: alloc.primary,
      imageKeyword2: alloc.secondary,
    }
  })
}

/* ——— 레거시·디버그·에어텔 routeText KO→EN (apply SSOT와 분리) ——— */

function englishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isYbtourDomesticHubToken(t)) return ''
  if (/^[A-Za-z][A-Za-z0-9\s,.'-]{2,}$/.test(t) && !/[\uAC00-\uD7AF]/.test(t)) {
    try {
      return finalizeScheduleImageKeyword(t)
    } catch {
      return t
    }
  }
  return englishFromScheduleKoreanSegment(t)
}

/** routeText A-B-C-D → 1·2순위 영문(한글 세그먼트 KO→EN). 에어텔·레거시 테스트용 — 등록 apply SSOT 아님 */
export function pickYbtourImageKeywordsFromRouteText(routeText: string | null | undefined): {
  imageKeyword: string
  imageKeyword2: string | null
} {
  const picked: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    const en = englishFromRouteSegment(seg)
    if (!en) continue
    if (picked.some((p) => keysEqual(p, en))) continue
    picked.push(en)
    if (picked.length >= 2) break
  }
  return {
    imageKeyword: picked[0] ?? '',
    imageKeyword2: picked[1] ?? null,
  }
}

function isWeakRouteCityKeyword(kw: string): boolean {
  const t = kw.trim()
  if (!t) return true
  if (/^nha$/i.test(t)) return true
  if (/^nha\s*trang$/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

function pushRouteLandmarkKeyword(landmarks: string[], en: string): void {
  if (!en || isWeakRouteCityKeyword(en)) return
  if (landmarks.some((p) => keysEqual(p, en))) return
  landmarks.push(en)
}

/** routeText에서 관광지 고유명만 순서대로(도시·공항 제외) — 에어텔 보완 */
export function collectRouteLandmarkKeywordsFromRouteText(
  routeText: string | null | undefined,
): string[] {
  const landmarks: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    if (isNonLandmarkRouteTextSegment(seg)) continue
    pushRouteLandmarkKeyword(landmarks, englishFromRouteSegment(seg))
  }
  if (!landmarks.length) {
    const rt = String(routeText ?? '').trim()
    for (const en of findAllMappedKoreanPoisInText(rt)) {
      try {
        pushRouteLandmarkKeyword(landmarks, finalizeScheduleImageKeyword(en))
      } catch {
        pushRouteLandmarkKeyword(landmarks, en)
      }
    }
  }
  return landmarks
}

/** 자유여행 routeText — 관광지 고유명 1·2순위 (에어텔) */
export function pickRouteLandmarkImageKeywordsFromRouteText(
  routeText: string | null | undefined,
): { imageKeyword: string; imageKeyword2: string | null } {
  const landmarks = collectRouteLandmarkKeywordsFromRouteText(routeText)
  return {
    imageKeyword: landmarks[0] ?? '',
    imageKeyword2: landmarks[1] ?? null,
  }
}

function countYbtourNonHubRouteTextSegments(routeText: string | null | undefined): number {
  let count = 0
  for (const p of routeTextSegments(routeText)) {
    if (isYbtourDomesticHubToken(p)) continue
    count++
  }
  return count
}

/** @deprecated 레거시 dayKind — `classifyYbtourScheduleCardDayKind` 사용 권장 */
export function classifyYbtourDayKind(
  description: string,
  title: string,
  routeText: string | null | undefined,
  _dayIndex: number,
  _totalDays: number,
): YbtourDayKind {
  const hay = [title, description, routeText].filter(Boolean).join('\n')
  if (routeTextSegments(routeText).some((s) => isYbtourDomesticHubToken(s))) {
    if (/(?:출발|도착|귀국|국제\s*선|비행|항공)/u.test(hay)) return 'flight'
  }
  if (
    /(?:인천|김포|부산|대구|청주|김해|서울|제주|ICN|GMP|PUS|TAE|CJJ)(?:국제)?\s*공항/u.test(hay) &&
    /(?:출발|도착|탑승|귀국|입국|경유)/u.test(hay)
  ) {
    return 'flight'
  }
  if (
    /(?:출발|도착|귀국|국제\s*선|비행|항공)/u.test(hay) &&
    /(?:인천|김포|부산|대구|청주|ICN|GMP|PUS|TAE|CJJ)/u.test(hay)
  ) {
    return 'flight'
  }
  if (countYbtourNonHubRouteTextSegments(routeText) >= 3) return 'touring'
  return 'free'
}

/** @deprecated */
export function isYbtourKeywordSupportedByDayContent(
  _keyword: string,
  _title: string,
  _description: string,
  _routeText: string | null | undefined,
): boolean {
  return false
}

/** 테스트·디버그 — 단일 row + dayKind */
export function resolveYbtourPrimaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  dayKind: YbtourScheduleCardDayKind | YbtourDayKind,
  productDestination: string | null | undefined,
  day = row.day,
  maxDay = row.day,
): string {
  const mapped: YbtourScheduleCardDayKind =
    dayKind === 'flight' ? 'movement' : dayKind === 'touring' || dayKind === 'free' ? 'tourism' : dayKind
  return resolveYbtourPrimaryKeywordCore(row, mapped, day, maxDay, productDestination, [row])
}

/** 테스트·디버그 */
export function resolveYbtourSecondaryKeyword(
  row: YbtourScheduleImageKeywordRow,
  primary: string,
  dayKind: YbtourScheduleCardDayKind | YbtourDayKind,
  productDestination: string | null | undefined,
): string | null {
  const mapped: YbtourScheduleCardDayKind =
    dayKind === 'flight' ? 'movement' : dayKind === 'touring' || dayKind === 'free' ? 'tourism' : dayKind
  return resolveYbtourSecondaryKeywordCore(row, primary, mapped, productDestination)
}
