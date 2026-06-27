/**
 * 모두투어 전용: `Product.schedule[].imageKeyword` / `imageKeyword2` — Pexels 검색용 영문.
 * REGRESSION-FREEZE[modetour-schedule-image-keyword-ko-route]: routeText 세그먼트 순서만 — allocateModetourImageKeywordsByScheduleRules — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: 일차 슬롯 1·2·귀국 — manifest
 * 일정요약(routeText) a→g 순서만 — LLM·타일 본문·타상품 후보 스캔 없음.
 * REGRESSION-FREEZE[modetour-register-danang-live-gate]: 베트남 POI 오매핑 차단 — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: dedupe 후 imageKeyword2 reconcile — manifest
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: POI regex — schedule-poi-regex-ssot SSOT — manifest
 * REGRESSION-FREEZE[modetour-register-ssot-freeze]: 등록 imageKeyword·북경 dual-slot 스냅샷 — manifest
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
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import {
  findMappedKoreanPoisInTextByMentionOrder,
  isDestinationHubEnglishKeyword,
  isDestinationMapEnglishHubKeyword,
  isKnownDestinationCityEnglishKeyword,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
  mapDestination,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isAirlineCarrierImageKeyword,
  isHotelLodgingImageKeyword,
  isNonLandmarkFoodOrDiningImageKeyword,
  isNonLandmarkHistoricalPrisonImageKeyword,
  isNonLandmarkRouteTextSegment,
  isNonLandmarkSpaShoppingLoungeImageKeyword,
  isScheduleImageKeywordLandmarkEligible,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'
import {
  isBlockedScheduleImageKeyword,
} from '@/lib/schedule-image-keyword-blocklist'
import {
  acceptScheduleTourismImageKeywordOrEmpty,
  fillScheduleMiddleImageKeyword2Gap,
  isScheduleAirportLikeImageKeyword,
  isScheduleAirportOnlyRouteText,
  isScheduleAirportRouteSegmentText,
  isScheduleInFlightOvernightRow,
  pickUnusedScheduleImageKeywordFromAdjacentDays,
  resolveScheduleKeywordSlotKind,
  shouldFillScheduleMiddleKeyword2Gap,
  type ScheduleAdjacentDayAlloc,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { slugify as transliterateSlugify } from 'transliteration'

export type ModetourScheduleImageKeywordOpts = {
  productDestination?: string | null
  productTitle?: string
  pastedBlob?: string
}

export type ModetourScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

type ModetourScheduleCardDayKind = 'tourism' | 'movement' | 'return_home'

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const MODETOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const MODETOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  /\bLouvre\b/i,
  /Notre\s*Dame/i,
  /\bColosseum\b/i,
  /\bRome\b/i,
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
  if (!a || !b) return false
  return normKey(a) === normKey(b)
}

function buildModetourDayHaystack(row: ModetourScheduleImageKeywordRow): string {
  return [row.title, row.description, row.routeText].filter(Boolean).join('\n').replace(/\r/g, '')
}

function stripRouteSegmentNoise(seg: string): string {
  return seg
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isModetourDomesticHubToken(token: string): boolean {
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

const MODETOUR_FOREIGN_AIRPORT_ROUTE_RE =
  /(?:국제)?\s*공항|airport|터미널|terminal|JFK|Kennedy|Newark|Gatwick|Heathrow|Changi|Suvarnabhumi|하츠필드|Hartsfield|Jackson/i

function isModetourForeignAirportRouteSegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isModetourDomesticHubToken(t)) return false
  if (MODETOUR_FOREIGN_AIRPORT_ROUTE_RE.test(t)) return true
  return false
}

function isModetourAirportLikeKeyword(kw: string): boolean {
  return isScheduleAirportLikeImageKeyword(kw)
}

function modetourAdjacentLandmarkCandidates(
  row: ModetourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  return collectModetourDayOrderedKeywordCandidates(row, 'middle', productDestination)
}

function pickModetourAdjacentUnusedKeyword(
  anchorDay: number,
  maxDay: number,
  sorted: readonly ModetourScheduleImageKeywordRow[],
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
    collectLandmarkCandidates: (r) => modetourAdjacentLandmarkCandidates(r, productDestination),
    byDayAlloc: byDay,
    scan,
    excludePrimary,
    allowTripWideReuse,
    ignoreAdjacentDaySlots,
    rejectKeyword:
      rejectKeyword ??
      ((kw) => !tryAcceptModetourLlmImageKeyword(kw, productDestination)),
  })
}

function routeTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText).map(stripRouteSegmentNoise).filter((s) => s.length >= 2)
}

function countModetourForeignRouteSegments(routeText: string | null | undefined): number {
  return routeTextSegments(routeText).filter((s) => !isModetourDomesticHubToken(s)).length
}

/** routeText 세그먼트가 목적지 허브 도시만(상해·북경 등)인지 — 관광 1순위에서 스킵 */
function isModetourDestinationHubOnlySegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t) return false
  if (mapKoreanPoiSegment(t)) return false
  const cityEn = mapDestination(t)
  if (!cityEn || cityEn === t || /[\uAC00-\uD7AF]/.test(cityEn)) return false
  if (!isKnownDestinationCityEnglishKeyword(cityEn) && !isDestinationMapEnglishHubKeyword(cityEn)) {
    return false
  }
  if (/공원|기념|사|묘|궁|탑|거리|광장|유람|전망|선택|관광|호텔|리조트|박물|청사|옛|성|교|시장|마트|카페|스타벅스/u.test(t)) {
    return false
  }
  return true
}

/** 이동·경유 구간 라벨(누브라 밸리 등) — routeText 순서에서 관광 1순위 스킵 */
function isModetourRouteCorridorValleySegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t) return false
  return /밸리$/u.test(t) || /\bvalley$/i.test(t)
}

function isModetourRouteMovementCityKeyword(kw: string): boolean {
  return isKnownDestinationCityEnglishKeyword(kw) || isDestinationMapEnglishHubKeyword(kw)
}

/** 관광 일차 — routeText 선행 목적지 허브(상해·Da Nang 등) 스킵 */
function isModetourForeignDestinationCitySegment(
  seg: string,
  productDestination: string | null | undefined,
): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (mapKoreanPoiSegment(t)) return false
  if (isModetourDestinationHubOnlySegment(seg)) return true
  if (!t) return false
  if (isDestinationMapEnglishHubKeyword(t)) return true
  const destEn = mapDestination(String(productDestination ?? '').trim())
  if (destEn && !/[\uAC00-\uD7AF]/.test(destEn) && keysEqual(t, destEn)) return true
  return false
}

function modetourTransliteratePlacePhrase(ko: string): string {
  const raw = transliterateSlugify(String(ko ?? '').trim(), {
    lowercase: false,
    separator: ' ',
    trim: true,
  })
  return raw
    .replace(/[^A-Za-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** POI 사전·regex에 없을 때 — 공원·기념관·공묘 등 접미사 규칙(도시·상품별 ROI 아님) */
function modetourKoreanPlaceSuffixEnglishFallback(seg: string): string {
  let t = stripRouteSegmentNoise(seg)
  t = t.replace(/^추천\s*선택관광[ㅣ|｜·]\s*/u, '').replace(/\(\$[^)]*\)/g, '').trim()
  if (!t || t.length < 2) return ''

  const memorial = t.match(/^(.+?)(?:\s*의사)?\s*기념관/u)
  if (memorial?.[1]) {
    const core = memorial[1].replace(/\s+/g, ' ').trim()
    if (core.length >= 2) return `${modetourTransliteratePlacePhrase(core)} Memorial Hall`
  }
  const park = t.match(/^(.+?)공원/u)
  if (park?.[1] && park[1].trim().length >= 2) {
    return `${modetourTransliteratePlacePhrase(park[1].trim())} Park`
  }
  const temple = t.match(/^(.+?)공묘/u)
  if (temple?.[1] && temple[1].trim().length >= 2) {
    return `${modetourTransliteratePlacePhrase(temple[1].trim())} Temple`
  }
  const oldStreet = t.match(/^(.+?)옛\s*거리/u)
  if (oldStreet?.[1]) {
    const stem = oldStreet[1].trim()
    if (stem.length >= 2 && !isModetourDestinationHubOnlySegment(stem)) {
      return `${modetourTransliteratePlacePhrase(stem)} Old Street`
    }
  }
  return ''
}

function isModetourRouteOrderKeywordBlocked(kw: string): boolean {
  const n = normalizeToPlaceName(kw)
  if (!n || n.length < 2) return true
  if (isAirlineCarrierImageKeyword(n)) return true
  if (isNonLandmarkFoodOrDiningImageKeyword(n)) return true
  if (isNonLandmarkSpaShoppingLoungeImageKeyword(n)) return true
  if (isNonLandmarkHistoricalPrisonImageKeyword(n)) return true
  if (isHotelLodgingImageKeyword(n)) return true
  return false
}

function tryAcceptModetourRouteSegmentKeyword(
  raw: string,
  productDestination: string | null | undefined,
  opts?: { allowDestinationCity?: boolean; trustRouteMappedPoi?: boolean },
): string {
  const accepted = tryAcceptModetourLlmImageKeyword(raw, productDestination)

  if (opts?.allowDestinationCity) {
    return accepted && isModetourRouteMovementCityKeyword(accepted) ? accepted : ''
  }

  if (opts?.trustRouteMappedPoi) {
    if (
      accepted &&
      !isKnownDestinationCityEnglishKeyword(accepted) &&
      !isDestinationHubEnglishKeyword(accepted, productDestination) &&
      !isModetourRouteOrderKeywordBlocked(accepted)
    ) {
      return accepted
    }
    const bare = String(raw ?? '').trim()
    if (bare.length >= 2 && /^[A-Za-z0-9\s,.'-]+$/.test(bare) && !/[\uAC00-\uD7AF]/.test(bare)) {
      if (isKnownDestinationCityEnglishKeyword(bare) || isDestinationHubEnglishKeyword(bare, productDestination)) {
        return ''
      }
      return isModetourRouteOrderKeywordBlocked(bare) ? '' : bare
    }
    return ''
  }

  if (!accepted) return ''
  if (
    isKnownDestinationCityEnglishKeyword(accepted) ||
    isDestinationHubEnglishKeyword(accepted, productDestination)
  ) {
    return ''
  }
  return isScheduleImageKeywordLandmarkEligible(accepted) ? accepted : ''
}

/** routeText 한 세그먼트 → 영문 imageKeyword 후보 (일정 순서 SSOT) */
function modetourRouteSegmentToImageKeyword(
  seg: string,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string {
  if (isModetourDomesticHubToken(seg)) return ''
  if (isModetourForeignAirportRouteSegment(seg)) return ''
  if (isNonLandmarkRouteTextSegment(seg)) return ''

  if (dayKind === 'tourism' && isModetourRouteCorridorValleySegment(seg)) return ''

  const tSeg = stripRouteSegmentNoise(seg)
  const isLatinSeg = isLatinRoutePlaceSegment(tSeg)
  if (
    dayKind !== 'movement' &&
    isModetourForeignDestinationCitySegment(seg, productDestination)
  ) {
    const destEn = mapDestination(String(productDestination ?? '').trim())
    const keepLatinRouteOrder =
      dayKind === 'tourism' &&
      isLatinSeg &&
      destEn &&
      !keysEqual(tSeg, destEn) &&
      !keysEqual(mapDestination(tSeg), destEn)
    if (!keepLatinRouteOrder) return ''
  }

  if (dayKind === 'movement') {
    const t = stripRouteSegmentNoise(seg)
    const cityEn = mapDestination(t)
    if (cityEn && cityEn !== t && !/[\uAC00-\uD7AF]/.test(cityEn)) {
      return tryAcceptModetourRouteSegmentKeyword(cityEn, productDestination, { allowDestinationCity: true })
    }
    const fromLatin = tryAcceptModetourRouteLatinSegment(seg, productDestination)
    if (fromLatin) return fromLatin
    return ''
  }

  const fromLatinRoute = tryAcceptModetourRouteLatinSegment(seg, productDestination)
  if (fromLatinRoute) {
    return fromLatinRoute
  }

  const latin = extractLatinEnglishFromRouteSegment(seg)
  if (latin) {
    return latin
  }

  const t = stripRouteSegmentNoise(seg)
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    let fin = fromPoi
    try {
      fin = finalizeScheduleImageKeyword(fromPoi)
    } catch {
      /* keep */
    }
    const fromDict = tryAcceptModetourRouteSegmentKeyword(fin, productDestination, {
      trustRouteMappedPoi: true,
    })
    if (fromDict) return fromDict
  }

  const fromSpot = firstMatchingScheduleSpotEn(t)
  if (fromSpot) {
    let fin = fromSpot
    try {
      fin = finalizeScheduleImageKeyword(fromSpot)
    } catch {
      /* keep */
    }
    const fromRegex = tryAcceptModetourRouteSegmentKeyword(fin, productDestination, {
      trustRouteMappedPoi: true,
    })
    if (fromRegex) return fromRegex
  }

  const fromSuffix = modetourKoreanPlaceSuffixEnglishFallback(seg)
  if (fromSuffix) {
    const fromFallback = tryAcceptModetourRouteSegmentKeyword(fromSuffix, productDestination, {
      trustRouteMappedPoi: true,
    })
    if (fromFallback) return fromFallback
  }

  return ''
}

/** 일정 routeText 세그먼트 순서대로 imageKeyword 후보(중복 제거, 순서 유지) */
export function collectModetourRouteOrderedSegmentKeywords(
  routeText: string | null | undefined,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    const kw = modetourRouteSegmentToImageKeyword(seg, dayKind, productDestination)
    if (!kw) continue
    if (out.some((x) => keysEqual(x, kw))) continue
    out.push(kw)
  }
  return out
}

function modetourKeywordSlotDayKind(
  slotKind: ModetourKeywordSlotKind,
): ModetourScheduleCardDayKind {
  if (slotKind === 'departure') return 'movement'
  if (slotKind === 'return') return 'return_home'
  return 'tourism'
}

/** routeText a→g 순서 우선, 부족 시 명소·LLM — allocate 슬롯 채움 SSOT */
function collectModetourDayOrderedKeywordCandidates(
  row: ModetourScheduleImageKeywordRow,
  slotKind: ModetourKeywordSlotKind,
  productDestination: string | null | undefined,
): string[] {
  const dayKind = modetourKeywordSlotDayKind(slotKind)
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const accepted = tryAcceptModetourLlmImageKeyword(raw, productDestination)
    if (!accepted) return
    if (out.some((x) => keysEqual(x, accepted))) return
    out.push(accepted)
  }
  for (const kw of collectModetourRouteOrderedSegmentKeywords(
    row.routeText,
    dayKind,
    productDestination,
  )) {
    push(kw)
  }
  for (const kw of collectModetourLandmarkKeywords(row, productDestination)) push(kw)
  push(inferModetourKeywordFromDayContent(row, productDestination))
  push(row.imageKeyword)
  push(row.imageKeyword2)
  return out
}

function isModetourFlightDepartureRouteText(routeText: string | null | undefined): boolean {
  const segs = routeTextSegments(routeText)
  if (!segs.length) return false
  const hasHub = segs.some((s) => isModetourDomesticHubToken(s))
  if (!hasHub) return false
  return segs.some(
    (s) =>
      !isModetourDomesticHubToken(s) &&
      !isScheduleAirportRouteSegmentText(s) &&
      !isNonLandmarkRouteTextSegment(s),
  )
}

function pickModetourReturnKeywordFromPrevDay(
  prevAlloc: { primary: string; secondary: string | null } | undefined,
  prevRouteOrdered: readonly string[],
  prevFullCandidates: readonly string[],
  productDestination: string | null | undefined,
  used?: ReadonlySet<string>,
): string {
  const rejectReturnKw = (kw: string): boolean =>
    !kw ||
    isModetourAirportLikeKeyword(kw) ||
    isDestinationHubEnglishKeyword(kw, productDestination ?? null) ||
    isKnownDestinationCityEnglishKeyword(kw)

  const pickFrom = (list: readonly string[], allowUsed = false): string => {
    for (let i = list.length - 1; i >= 0; i--) {
      const kw = list[i]!
      if (prevAlloc && keysEqual(kw, prevAlloc.primary)) continue
      if (prevAlloc?.secondary && keysEqual(kw, prevAlloc.secondary)) continue
      if (rejectReturnKw(kw)) continue
      const nk = normKey(kw)
      if (!allowUsed && used && nk && used.has(nk)) continue
      return kw
    }
    return ''
  }
  return pickFrom(prevRouteOrdered) || pickFrom(prevFullCandidates)
}

function pickModetourReturnReuseTourismKeyword(
  sorted: readonly ModetourScheduleImageKeywordRow[],
  maxDay: number,
  productDestination: string | null | undefined,
): string {
  for (let walkDay = maxDay - 1; walkDay >= 1; walkDay--) {
    const prevRow = sorted.find((r) => Number(r.day) === walkDay)
    if (!prevRow) continue
    const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
      prevRow.routeText,
      'tourism',
      productDestination,
    )
    for (let i = routeOrdered.length - 1; i >= 0; i--) {
      const kw = routeOrdered[i]!
      if (
        !kw ||
        isModetourAirportLikeKeyword(kw) ||
        isDestinationHubEnglishKeyword(kw, productDestination ?? null) ||
        isKnownDestinationCityEnglishKeyword(kw)
      ) {
        continue
      }
      return kw
    }
  }
  return ''
}

function pickFirstUnusedModetourRouteKeyword(
  ordered: readonly string[],
  used: ReadonlySet<string>,
  excludePrimary?: string,
  productDestination?: string | null,
): string {
  for (const kw of ordered) {
    if (!kw) continue
    if (isModetourAirportLikeKeyword(kw) && !isBlockedScheduleImageKeyword(kw)) continue
    if (isDestinationHubEnglishKeyword(kw, productDestination ?? null)) continue
    if (isKnownDestinationCityEnglishKeyword(kw)) continue
    if (/^leh$/i.test(normKey(kw))) continue
    if (excludePrimary && modetourKeywordKeysOverlap(kw, excludePrimary)) continue
    const nk = normKey(kw)
    if (!nk || used.has(nk)) continue
    return kw
  }
  return ''
}

function isLatinRoutePlaceSegment(seg: string): boolean {
  const t = stripRouteSegmentNoise(seg)
  if (!t || t.length < 2) return false
  if (/[가-힣]/.test(t)) return false
  if (/[\u4e00-\u9fff]/.test(t)) return false
  return t.replace(/[^A-Za-z]/g, '').length >= 3
}

function isDomesticOnlyRouteText(routeText: string | null | undefined): boolean {
  const segs = routeTextSegments(routeText)
  if (!segs.length) return false
  return segs.every((s) => isModetourDomesticHubToken(s))
}

/** 마지막 귀국일 — routeText에 인천·김포 등 국내 허브가 있으면 2순위 없음(당일 관광 1곳만). */
function isModetourReturnLegWithDomesticHub(row: ModetourScheduleImageKeywordRow): boolean {
  const hay = buildModetourDayHaystack(row)
  if (!/(?:귀국|인천\s*도착|ICN\s*도착|서울\s*도착|김포\s*도착)/u.test(hay)) return false
  return routeTextSegments(row.routeText).some((s) => isModetourDomesticHubToken(s))
}

/** LLM/파서 placeholder·불량 패턴 */
export function isModetourPlaceholderImageKeyword(s: string): boolean {
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^day\s*\d+\s*travel$/i.test(t)) return true
  if (/^제\s*\d+\s*일차(?:\s*일정)?$/u.test(t)) return true
  if (/^real\s+place\s+name\s+in\s+english$/i.test(t)) return true
  return false
}

function isModetourLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 3 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (MODETOUR_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (MODETOUR_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

export function isModetourCrossContinentHallucinationKeyword(
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

function extractLatinEnglishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isModetourDomesticHubToken(t)) return ''
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

function englishFromKoreanRouteSegment(seg: string): string {
  return englishFromScheduleKoreanSegment(seg)
}

function tryAcceptMappedPoiKeyword(
  seg: string,
  productDestination: string | null | undefined,
): string {
  const fromPoi = mapKoreanPoiSegment(stripRouteSegmentNoise(seg))
  if (!fromPoi) return ''
  let fin = fromPoi
  try {
    fin = finalizeScheduleImageKeyword(fromPoi)
  } catch {
    /* keep fromPoi */
  }
  const accepted = tryAcceptModetourLlmImageKeyword(fin, productDestination)
  if (
    !accepted ||
    isDestinationHubEnglishKeyword(accepted, productDestination) ||
    !isScheduleImageKeywordLandmarkEligible(accepted)
  ) {
    return ''
  }
  return accepted
}

function tryAcceptSegmentKeywordCandidates(
  candidates: string[],
  productDestination: string | null | undefined,
): string {
  const seen = new Set<string>()
  for (const cand of candidates) {
    const t = String(cand ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    const accepted = tryAcceptModetourLlmImageKeyword(t, productDestination)
    if (accepted) return accepted
  }
  return ''
}

function segmentToAcceptedModetourKeyword(
  seg: string,
  productDestination: string | null | undefined,
): string {
  const t = stripRouteSegmentNoise(seg)
  const latin = extractLatinEnglishFromRouteSegment(seg)
  const rawLatin = isLatinRoutePlaceSegment(t) ? t : ''
  const latinAccepted = tryAcceptSegmentKeywordCandidates(
    [rawLatin, latin].filter((c, i, arr) => Boolean(c) && arr.indexOf(c) === i),
    productDestination,
  )
  if (latinAccepted) return latinAccepted

  const fromKo = englishFromKoreanRouteSegment(seg)
  if (fromKo) {
    const accepted = tryAcceptModetourLlmImageKeyword(fromKo, productDestination)
    if (accepted) return accepted
  }
  return ''
}

function pushUniqueLandmark(list: string[], raw: string): void {
  const kw = String(raw ?? '').trim()
  if (!kw) return
  if (list.some((x) => keysEqual(x, kw))) return
  list.push(kw)
}

function collectRouteLandmarkKeywordsFromRouteText(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string[] {
  const landmarks: string[] = []
  for (const seg of routeTextSegments(routeText)) {
    if (isNonLandmarkRouteTextSegment(seg)) continue
    pushUniqueLandmark(landmarks, segmentToAcceptedModetourKeyword(seg, productDestination))
  }
  return landmarks
}

/** routeText 해외 구간 — 영문·한글(매핑), pickLast면 이동 순서상 뒤쪽 우선 */
function pickForeignPlaceFromRouteText(
  routeText: string | null | undefined,
  pickLast: boolean,
  productDestination: string | null | undefined,
  opts?: { skipDestinationCity?: boolean },
): string {
  const segs = routeTextSegments(routeText).filter((s) => !isModetourDomesticHubToken(s))
  if (!segs.length) return ''
  const ordered = pickLast ? [...segs].reverse() : segs
  let cityFallback = ''
  for (const seg of ordered) {
    const kw = segmentToAcceptedModetourKeyword(seg, productDestination)
    if (!kw) continue
    if (opts?.skipDestinationCity && isDestinationHubEnglishKeyword(kw, productDestination)) {
      if (!cityFallback) cityFallback = kw
      continue
    }
    return kw
  }
  return cityFallback
}

function pickFirstTourismPoiFromRouteText(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(routeText)) {
    if (isModetourDomesticHubToken(seg)) continue
    if (isNonLandmarkRouteTextSegment(seg)) continue
    const t = stripRouteSegmentNoise(seg)
    const fromDict = tryAcceptMappedPoiKeyword(seg, productDestination)
    if (fromDict) return fromDict
    const spotEn = firstMatchingScheduleSpotEn(t)
    if (spotEn) {
      try {
        const fin = finalizeScheduleImageKeyword(spotEn)
        return fin.length >= spotEn.length - 4 ? fin : spotEn
      } catch {
        return spotEn
      }
    }
    const kw = segmentToAcceptedModetourKeyword(seg, productDestination)
    if (
      kw &&
      !isDestinationHubEnglishKeyword(kw, productDestination) &&
      isScheduleImageKeywordLandmarkEligible(kw)
    ) {
      return kw
    }
  }

  const landmarks = collectRouteLandmarkKeywordsFromRouteText(routeText, productDestination)
  const poi = landmarks.find(
    (kw) =>
      !isDestinationHubEnglishKeyword(kw, productDestination) &&
      isScheduleImageKeywordLandmarkEligible(kw),
  )
  if (poi) return poi

  return pickForeignPlaceFromRouteText(routeText, false, productDestination, { skipDestinationCity: true })
}

function filterTourismRouteLandmarkCandidates(
  landmarks: readonly string[],
  productDestination: string | null | undefined,
): string[] {
  return landmarks.filter(
    (kw) =>
      kw &&
      !isDestinationHubEnglishKeyword(kw, productDestination) &&
      isScheduleImageKeywordLandmarkEligible(kw),
  )
}

function collectModetourLandmarkKeywords(
  row: ModetourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  for (const seg of routeTextSegments(row.routeText)) {
    if (isModetourDomesticHubToken(seg)) continue
    if (isNonLandmarkRouteTextSegment(seg)) continue
    const kw = segmentToAcceptedModetourKeyword(seg, productDestination)
    if (kw) pushUniqueLandmark(out, kw)
  }
  return out
}

function resolveRouteTextSecondPlace(routeText: string | null | undefined): string {
  const segs = routeTextSegments(routeText)
  if (segs.length < 2) return ''
  return (
    extractLatinEnglishFromRouteSegment(segs[1]!) || englishFromKoreanRouteSegment(segs[1]!)
  )
}

function tryAcceptModetourLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  const fromBase = acceptLlmScheduleImageKeyword(raw, {
    productDestination,
    isFormatOk: isModetourLlmImageKeywordFormatOk,
    isDomesticHub: isModetourDomesticHubToken,
    isCrossContinentHallucination: isModetourCrossContinentHallucinationKeyword,
  })
  if (fromBase) return fromBase
  const t = String(raw ?? '').trim()
  if (!/^[A-Za-z][A-Za-z0-9\s,.'-]{2,}$/.test(t) || /[\uAC00-\uD7AF]/.test(t)) return ''
  let fin = t
  try {
    fin = finalizeScheduleImageKeyword(t)
  } catch {
    /* keep t */
  }
  if (!fin || fin.length < 2) return ''
  if (isModetourCrossContinentHallucinationKeyword(fin, productDestination)) return ''
  if (isModetourDomesticHubToken(fin)) return ''
  if (t.split(/\s+/).filter(Boolean).length >= 2) return fin
  return ''
}

/** routeText 라틴 세그먼트(Da Nang, Hoi An) — finalize·짧은 토큰 허용 */
function tryAcceptModetourRouteLatinSegment(
  seg: string,
  productDestination: string | null | undefined,
): string {
  const t = stripRouteSegmentNoise(seg)
  if (!isLatinRoutePlaceSegment(t)) return ''
  let fin = t
  try {
    fin = finalizeScheduleImageKeyword(t)
  } catch {
    /* keep t */
  }
  if (!fin || fin.length < 2) return ''
  if (isModetourCrossContinentHallucinationKeyword(fin, productDestination)) return ''
  if (isModetourDomesticHubToken(fin)) return ''
  return fin
}

function inferModetourKeywordFromDayContent(
  row: ModetourScheduleImageKeywordRow,
  productDestination: string | null | undefined,
): string {
  const inferred = inferEnglishPlaceKeywordFromDayContent(row, productDestination)
  if (!inferred) return ''
  return tryAcceptModetourLlmImageKeyword(inferred, productDestination)
}

function preferPoiOverBareCityLlm(
  row: ModetourScheduleImageKeywordRow,
  acceptedCity: string,
  productDestination: string | null | undefined,
): string {
  const landmarks = collectModetourLandmarkKeywords(row, productDestination)
  for (const kw of landmarks) {
    if (!isKnownDestinationCityEnglishKeyword(kw) && normKey(kw) !== normKey(acceptedCity)) {
      return kw
    }
  }
  const bodyHaystack = [row.title, row.description].filter(Boolean).join('\n')
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(bodyHaystack)) {
    const kw = tryAcceptModetourLlmImageKeyword(en, productDestination)
    if (kw && normKey(kw) !== normKey(acceptedCity) && !isKnownDestinationCityEnglishKeyword(kw)) {
      return kw
    }
  }
  return acceptedCity
}

export function classifyModetourScheduleCardDayKind(
  day: number,
  maxDay: number,
  joined: string,
): ModetourScheduleCardDayKind {
  const j = joined.slice(0, 12_000)
  if (
    day === maxDay &&
    maxDay >= 2 &&
    /(인천|ICN|김포|GMP)/.test(j) &&
    /(출발|귀국|탑승)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|호치민|방콕|Bangkok|Tokyo|Osaka|델리|Delhi|홍콩|Hong\s*Kong|타이페이|Taipei|타오위uan|桃園|Taoyuan|대만|Taiwan)/i.test(
      j,
    )
  ) {
    return 'return_home'
  }
  if (day === maxDay && maxDay >= 2 && /(?:귀국|출국)/u.test(j)) {
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
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천|부산|PUS|대구|TAE|청주|CJJ)/.test(j)) {
    return 'movement'
  }
  if (day === 1 && /출입국/.test(j) && !/(귀국|출국)/.test(j)) {
    if (/(?:인천|김포|ICN|GMP|부산|PUS|청주|CJJ|대구|TAE)/.test(j)) {
      return 'movement'
    }
  }
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|김포|인천|부산|델리|Delhi|타이페이|Taipei|타오위uan|桃園|Taoyuan|대만)/i.test(j) &&
    /(가이드|호텔|공항|출발|탑승)/.test(j)
  ) {
    return 'movement'
  }
  if (
    day === 1 &&
    maxDay >= 2 &&
    /(?:인천|김포|ICN|GMP|부산|PUS|청주|CJJ)(?:\s*국제?\s*공항)?\s*[-–—]\s*/u.test(j) &&
    !/(?:귀국\s*일정|출국\s*만)/u.test(j)
  ) {
    return 'movement'
  }
  return 'tourism'
}

function pickModetourMovementForeignCityKeyword(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(routeText)) {
    if (isModetourDomesticHubToken(seg)) continue
    if (isNonLandmarkRouteTextSegment(seg)) continue
    const t = stripRouteSegmentNoise(seg)
    const fromDest = mapDestination(t)
    if (fromDest && fromDest !== t && !/[\uAC00-\uD7AF]/.test(fromDest)) {
      const accepted = tryAcceptModetourLlmImageKeyword(fromDest, productDestination)
      if (accepted && isModetourRouteMovementCityKeyword(accepted)) return accepted
    }
    if (/^[A-Za-z][A-Za-z\s-]{2,}$/.test(t)) {
      const accepted = tryAcceptModetourLlmImageKeyword(t, productDestination)
      if (accepted && isModetourRouteMovementCityKeyword(accepted)) return accepted
    }
    const fromLatin = tryAcceptModetourRouteLatinSegment(seg, productDestination)
    if (fromLatin) return fromLatin
  }
  return ''
}

function resolveModetourMovementDayKeyword(
  row: ModetourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  _allRows: ModetourScheduleImageKeywordRow[],
): string {
  if (dayKindIsReturnOnlyDomestic(row, day, maxDay)) return ''
  return pickModetourMovementForeignCityKeyword(row.routeText, productDestination) || ''
}

function dayKindIsReturnOnlyDomestic(
  row: ModetourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
): boolean {
  if (day !== maxDay || maxDay < 2) return false
  return isDomesticOnlyRouteText(row.routeText)
}

function collectTripForeignPlaceKeywordsInDayOrder(
  rows: ModetourScheduleImageKeywordRow[],
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const sorted = [...rows].filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  for (const row of sorted) {
    for (const seg of routeTextSegments(row.routeText)) {
      if (isModetourDomesticHubToken(seg)) continue
      const kw = segmentToAcceptedModetourKeyword(seg, productDestination)
      if (!kw) continue
      const nk = normKey(kw)
      if (seen.has(nk)) continue
      seen.add(nk)
      out.push(kw)
    }
  }
  return out
}

function resolveModetourPrimaryKeyword(
  row: ModetourScheduleImageKeywordRow,
  dayKind: ModetourScheduleCardDayKind,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: ModetourScheduleImageKeywordRow[],
): string {
  const acceptLlm = (raw: string | null | undefined) =>
    tryAcceptModetourLlmImageKeyword(raw, productDestination)
  const accepted = acceptLlm(row.imageKeyword)
  const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
    row.routeText,
    dayKind,
    productDestination,
  )

  const haystack = buildModetourDayHaystack(row)
  if (isRegisterScheduleFreeLeisureDay(haystack)) {
    return ''
  }

  if (dayKind === 'return_home') {
    return isDomesticOnlyRouteText(row.routeText) ? '' : routeOrdered[0] || ''
  }

  if (dayKind === 'movement') {
    return resolveModetourMovementDayKeyword(row, day, maxDay, productDestination, allRows)
  }

  if (
    accepted &&
    routeOrdered[0] &&
    (isKnownDestinationCityEnglishKeyword(accepted) ||
      isDestinationHubEnglishKeyword(accepted, productDestination)) &&
    !keysEqual(accepted, routeOrdered[0]!)
  ) {
    return routeOrdered[0]!
  }

  if (!accepted && routeOrdered[0]) {
    return routeOrdered[0]
  }

  const routeTextPresent = Boolean(String(row.routeText ?? '').trim())
  const fromRouteOrderedFirst = routeTextPresent ? routeOrdered[0] || '' : ''

  if (accepted) {
    if (isKnownDestinationCityEnglishKeyword(accepted)) {
      const fromPoi = preferPoiOverBareCityLlm(row, accepted, productDestination)
      if (fromPoi !== accepted) return fromPoi
    }

    if (routeTextPresent && fromRouteOrderedFirst) {
      const routeOverLlm =
        isDestinationHubEnglishKeyword(accepted, productDestination) ||
        normKey(fromRouteOrderedFirst) !== normKey(accepted)
      if (routeOverLlm) {
        const landmarks = collectModetourLandmarkKeywords(row, productDestination)
        const poiLandmarks = landmarks.filter(
          (kw) =>
            !isDestinationHubEnglishKeyword(kw, productDestination) &&
            isScheduleImageKeywordLandmarkEligible(kw),
        )
        const resolved = resolveTourismKeywordPreferDistinctPerDay({
          row,
          acceptedLlm: fromRouteOrderedFirst,
          allRows,
          acceptLlm,
          daySpecificCandidates: poiLandmarks,
        })
        return resolved || fromRouteOrderedFirst
      }
    }

    const landmarks = collectModetourLandmarkKeywords(row, productDestination)
    const fromRouteLast = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
    const fromRouteFirst = pickFirstTourismPoiFromRouteText(row.routeText, productDestination)
    const poiLandmarks = landmarks.filter(
      (kw) =>
        !isDestinationHubEnglishKeyword(kw, productDestination) &&
        isScheduleImageKeywordLandmarkEligible(kw) &&
        (!fromRouteFirst || normKey(kw) !== normKey(fromRouteFirst)),
    )
    const dayCands = [
      ...poiLandmarks,
      ...(isScheduleImageKeywordLandmarkEligible(fromRouteLast) ? [fromRouteLast] : []),
      ...(isScheduleImageKeywordLandmarkEligible(fromRouteFirst) ? [fromRouteFirst] : []),
    ].filter(Boolean)
    const llmKey = normKey(accepted)
    let dup = 0
    for (const r of allRows) {
      const a = acceptLlm(r.imageKeyword)
      if (a && normKey(a) === llmKey) dup++
    }
    if (dup >= 2 && fromRouteLast && normKey(fromRouteLast) === llmKey) {
      return accepted
    }
    const resolved = resolveTourismKeywordPreferDistinctPerDay({
      row,
      acceptedLlm: accepted,
      allRows,
      acceptLlm,
      daySpecificCandidates: dayCands,
    })
    if (resolved) return resolved
    return accepted
  }

  const fromRouteFirst = routeOrdered[0] || pickFirstTourismPoiFromRouteText(row.routeText, productDestination)
  if (fromRouteFirst) return fromRouteFirst

  const landmarks = collectModetourLandmarkKeywords(row, productDestination)
  const fromLandmark =
    landmarks.find((kw) => !isDestinationHubEnglishKeyword(kw, productDestination)) ??
    landmarks[0]
  if (fromLandmark) return fromLandmark

  const fromRouteLast = pickForeignPlaceFromRouteText(row.routeText, true, productDestination)
  if (fromRouteLast) return fromRouteLast

  return inferModetourKeywordFromDayContent(row, productDestination)
}

function modetourKeywordKeysOverlap(a: string, b: string): boolean {
  const ak = normKey(a)
  const bk = normKey(b)
  if (!ak || !bk) return false
  if (ak === bk) return true
  return ak.includes(bk) || bk.includes(ak)
}

/** routeText 일정 순서 — 1순위 다음 세그먼트 */
function pickModetourRouteOrderedSecondKeyword(
  primary: string,
  routeText: string | null | undefined,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string | null {
  const ordered = collectModetourRouteOrderedSegmentKeywords(routeText, dayKind, productDestination)
  for (const kw of ordered) {
    if (!modetourKeywordKeysOverlap(primary, kw)) return kw
  }
  return null
}

function isModetourLocalImmigrationTourismDay(
  row: ModetourScheduleImageKeywordRow,
  day: number,
  dayKind: ModetourScheduleCardDayKind,
): boolean {
  if (day !== 1 || dayKind !== 'tourism') return false
  const hay = buildModetourDayHaystack(row)
  if (!/(?:출입국|입국\s*정보)/u.test(hay)) return false
  return !routeTextSegments(row.routeText).some((s) => isModetourDomesticHubToken(s))
}

function resolveModetourSecondaryKeyword(
  row: ModetourScheduleImageKeywordRow,
  primary: string,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
  day?: number,
): string | null {
  if (!primary) return null
  if (day === 1 && isModetourLocalImmigrationTourismDay(row, day, dayKind)) return null
  if (isModetourReturnLegWithDomesticHub(row)) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const pk = normKey(primary)

  const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
    row.routeText,
    dayKind,
    productDestination,
  )
  for (const kw of routeOrdered) {
    if (!modetourKeywordKeysOverlap(kw, primary)) return kw
  }

  const fromRouteOrdered =
    pickModetourRouteOrderedSecondKeyword(primary, row.routeText, dayKind, productDestination) ||
    pickDistinctSecondScheduleImageKeyword(
      primary,
      filterTourismRouteLandmarkCandidates(
        collectRouteLandmarkKeywordsFromRouteText(row.routeText, productDestination),
        productDestination,
      ),
    )
  if (fromRouteOrdered) return fromRouteOrdered

  const fromLlm = tryAcceptModetourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (
    fromLlm &&
    normKey(fromLlm) !== pk &&
    !isKnownDestinationCityEnglishKeyword(fromLlm) &&
    !isDestinationHubEnglishKeyword(fromLlm, productDestination)
  ) {
    return fromLlm
  }

  const fromRouteOrderedAny = pickDistinctSecondScheduleImageKeyword(
    primary,
    collectRouteLandmarkKeywordsFromRouteText(row.routeText, productDestination).filter(
      (kw) => !isDestinationHubEnglishKeyword(kw, productDestination),
    ),
  )
  if (fromRouteOrderedAny) return fromRouteOrderedAny

  const fromRouteRaw = resolveRouteTextSecondPlace(row.routeText)
  const fromRoute = fromRouteRaw
    ? tryAcceptModetourLlmImageKeyword(fromRouteRaw, productDestination)
    : ''
  if (fromRoute && normKey(fromRoute) !== pk) return fromRoute

  const landmarkCandidates = collectModetourLandmarkKeywords(row, productDestination)
  for (const kw of landmarkCandidates) {
    if (normKey(kw) === pk) continue
    if (
      !isDestinationHubEnglishKeyword(kw, productDestination) &&
      isScheduleImageKeywordLandmarkEligible(kw)
    ) {
      return kw
    }
  }
  if (!isKnownDestinationCityEnglishKeyword(primary)) return null
  for (const kw of landmarkCandidates) {
    if (normKey(kw) !== pk) return kw
  }

  return null
}

function collectModetourDayPrimaryCandidates(
  row: ModetourScheduleImageKeywordRow,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const accepted = tryAcceptModetourLlmImageKeyword(raw, productDestination)
    if (!accepted) return
    if (out.some((x) => keysEqual(x, accepted))) return
    out.push(accepted)
  }

  if (dayKind === 'movement' || dayKind === 'return_home') {
    push(pickForeignPlaceFromRouteText(row.routeText, true, productDestination))
    push(pickForeignPlaceFromRouteText(row.routeText, false, productDestination))
    push(inferModetourKeywordFromDayContent(row, productDestination))
    push(row.imageKeyword)
    return out
  }

  for (const kw of collectModetourRouteOrderedSegmentKeywords(row.routeText, dayKind, productDestination)) {
    push(kw)
  }
  for (const kw of collectRouteLandmarkKeywordsFromRouteText(row.routeText, productDestination)) push(kw)
  push(pickForeignPlaceFromRouteText(row.routeText, true, productDestination))
  push(pickFirstTourismPoiFromRouteText(row.routeText, productDestination))
  push(inferModetourKeywordFromDayContent(row, productDestination))
  push(row.imageKeyword)
  return out
}

function collectModetourTripLandmarkCandidates(
  rows: ModetourScheduleImageKeywordRow[],
  productDestination: string | null | undefined,
): string[] {
  const out: string[] = []
  const sorted = [...rows].filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  for (const row of sorted) {
    for (const kw of collectModetourLandmarkKeywords(row, productDestination)) {
      if (!out.some((x) => keysEqual(x, kw))) out.push(kw)
    }
  }
  return out
}

/** 일차 순서대로 1·2순위 중복 제거 — 출발·귀국일은 1순위만, 도시명만이면 미사용 명소로 교체 */
function reconcileModetourTripWideImageKeywords<T extends ModetourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const used = new Set<string>()
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const byDay = new Map<number, T>()

  for (const row of sorted) {
    const day = Number(row.day)
    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (dayKind === 'return_home') {
      primary = isDomesticOnlyRouteText(row.routeText)
        ? ''
        : pickFirstUnusedModetourRouteKeyword(
            collectModetourRouteOrderedSegmentKeywords(row.routeText, dayKind, productDestination),
            used,
          )
      secondary = ''
    } else if (dayKind === 'movement') {
      if (
        !primary ||
        used.has(normKey(primary)) ||
        !isModetourRouteMovementCityKeyword(primary)
      ) {
        primary = pickModetourMovementForeignCityKeyword(row.routeText, productDestination) || ''
      }
      if (primary) used.add(normKey(primary))
      secondary = ''
    } else {
      const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
        row.routeText,
        dayKind,
        productDestination,
      )
      if (
        !primary ||
        used.has(normKey(primary)) ||
        isKnownDestinationCityEnglishKeyword(primary) ||
        isDestinationHubEnglishKeyword(primary, productDestination)
      ) {
        primary = pickFirstUnusedModetourRouteKeyword(routeOrdered, used, undefined, productDestination)
      } else {
        used.add(normKey(primary))
      }

      if (secondary) {
        if (
          normKey(secondary) === normKey(primary) ||
          used.has(normKey(secondary)) ||
          isKnownDestinationCityEnglishKeyword(secondary)
        ) {
          secondary = ''
        } else {
          used.add(normKey(secondary))
        }
      }

      if (!secondary) {
        if (isModetourReturnLegWithDomesticHub(row)) {
          secondary = ''
        } else {
          const secCand = pickFirstUnusedModetourRouteKeyword(routeOrdered, used, primary)
          if (secCand) {
            secondary = secCand
            used.add(normKey(secondary))
          }
        }
      }
    }

    byDay.set(day, {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary ? secondary : null,
    })
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    return byDay.get(day) ?? row
  })
}

/** 여행 전체 — 동일 랜드마크가 여러 일차·슬롯에 반복되지 않도록 routeText 순서로 재배치 */
function enforceModetourTripWideKeywordUniqueness<T extends ModetourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const used = new Set<string>()
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const byDay = new Map<number, T>()

  const pickUnusedFromRoute = (
    row: ModetourScheduleImageKeywordRow,
    dayKind: ModetourScheduleCardDayKind,
    excludePrimary: string,
  ): string => {
    const ordered = collectModetourRouteOrderedSegmentKeywords(
      row.routeText,
      dayKind,
      productDestination,
    )
    return pickFirstUnusedModetourRouteKeyword(ordered, used, excludePrimary || undefined)
  }

  for (const row of sorted) {
    const day = Number(row.day)
    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    const returnLeg = isModetourReturnLegWithDomesticHub(row)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (dayKind === 'movement' || dayKind === 'return_home' || returnLeg) {
      secondary = ''
    }

    if (primary && used.has(normKey(primary))) {
      if (dayKind === 'movement') {
        primary = pickModetourMovementForeignCityKeyword(row.routeText, productDestination) || ''
      } else {
        primary = pickUnusedFromRoute(row, dayKind, '')
      }
    }
    if (primary) used.add(normKey(primary))

    if (secondary) {
      if (normKey(secondary) === normKey(primary) || used.has(normKey(secondary))) {
        secondary = ''
      }
    }
    if (
      !secondary &&
      dayKind === 'tourism' &&
      !returnLeg &&
      primary &&
      shouldReconcileScheduleImageKeyword2(primary, null)
    ) {
      secondary = pickUnusedFromRoute(row, dayKind, primary)
    }
    if (secondary) used.add(normKey(secondary))

    byDay.set(day, {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary ? secondary : null,
    })
  }

  return rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    return byDay.get(day) ?? row
  })
}

/** 관광 일차 — 동일 1순위가 여러 day에 남으면 route·본문 명소로 분산 */
function dedupeModetourTourismPrimaryKeywordsAcrossDays<T extends ModetourScheduleImageKeywordRow>(
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
    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(Number(row.day), maxDay, haystack)
    if (dayKind !== 'tourism') continue
    for (const kw of collectModetourDayPrimaryCandidates(row, dayKind, productDestination)) {
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

    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    if (dayKind !== 'tourism') return row

    const primary = String(row.imageKeyword ?? '').trim()
    if (!primary) return row

    const nk = normKey(primary)
    if (!used.has(nk)) {
      used.add(nk)
      return row
    }

    const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
      row.routeText,
      dayKind,
      productDestination,
    )
    const fromDay = pickFirstUnusedModetourRouteKeyword(routeOrdered, used)
    if (fromDay) return { ...row, imageKeyword: fromDay }

    if (!String(row.routeText ?? '').trim()) {
      const fromTrip = pickUnused(tripLandmarks)
      if (fromTrip) return { ...row, imageKeyword: fromTrip }
    }

    return row
  })
}

type ModetourKeywordSlotKind = 'departure' | 'middle' | 'return'

/** 1일차=departure, 2~(N-1)=middle, N일차=return — 일차 번호 SSOT (dayKind·자유일 무관) */
function resolveModetourKeywordSlotKind(
  day: number,
  maxDay: number,
  scheduleRowCount: number,
): ModetourKeywordSlotKind {
  return resolveScheduleKeywordSlotKind(day, maxDay, scheduleRowCount)
}

function pickModetourDepartureRepresentativeKeyword(
  routeText: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  for (const seg of routeTextSegments(routeText)) {
    if (isModetourDomesticHubToken(seg)) continue
    const kw = modetourRouteSegmentToImageKeyword(seg, 'movement', productDestination)
    if (kw && !isModetourDomesticHubToken(kw)) return kw
  }
  const dest = String(productDestination ?? '').trim()
  if (!dest) return ''
  const fromProduct =
    modetourRouteSegmentToImageKeyword(dest, 'movement', productDestination) || mapDestination(dest)
  if (!fromProduct || isModetourDomesticHubToken(fromProduct)) return ''
  try {
    return finalizeScheduleImageKeyword(fromProduct)
  } catch {
    return fromProduct
  }
}

function findPrevScheduledRow<T extends ModetourScheduleImageKeywordRow>(
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

/** 일정요약 routeText 순서 + 일차 슬롯 규칙 SSOT (이 상품 1건만, trip-wide used) */
function allocateModetourImageKeywordsByScheduleRules<T extends ModetourScheduleImageKeywordRow>(
  rows: T[],
  maxDay: number,
  productDestination: string | null | undefined,
): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0).sort((a, b) => Number(a.day) - Number(b.day))
  const used = new Set<string>()
  const byDay = new Map<number, { primary: string; secondary: string | null }>()

  for (const row of sorted) {
    const day = Number(row.day)
    const slotKind = resolveModetourKeywordSlotKind(day, maxDay, sorted.length)

    if (slotKind === 'departure') {
      const routeOrderedMovement = collectModetourRouteOrderedSegmentKeywords(
        row.routeText,
        'movement',
        productDestination,
      )
      const routeOrderedTourism = collectModetourRouteOrderedSegmentKeywords(
        row.routeText,
        'tourism',
        productDestination,
      )
      const flightDeparture = isModetourFlightDepartureRouteText(row.routeText)
      let primary = ''
      if (flightDeparture) {
        primary =
          pickModetourDepartureRepresentativeKeyword(row.routeText, productDestination) ||
          pickFirstUnusedModetourRouteKeyword(routeOrderedMovement, used, undefined, productDestination) ||
          ''
      } else {
        primary =
          pickFirstUnusedModetourRouteKeyword(routeOrderedTourism, used, undefined, productDestination) ||
          pickModetourDepartureRepresentativeKeyword(row.routeText, productDestination) ||
          pickFirstUnusedModetourRouteKeyword(routeOrderedMovement, used, undefined, productDestination) ||
          ''
      }
      if (primary && isModetourAirportLikeKeyword(primary)) primary = ''
      if (!primary) {
        primary = pickFirstUnusedModetourRouteKeyword(routeOrderedMovement, used, undefined, productDestination)
      }
      if (!primary && !isScheduleInFlightOvernightRow(row)) {
        const hasRoutePlace =
          routeOrderedTourism.some((kw) => String(kw ?? '').trim()) ||
          routeOrderedMovement.some((kw) => String(kw ?? '').trim())
        if (isScheduleAirportOnlyRouteText(row.routeText, isModetourDomesticHubToken) || !hasRoutePlace) {
          primary =
            pickModetourAdjacentUnusedKeyword(
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
      if (primary && isModetourAirportLikeKeyword(primary)) primary = ''
      if (primary) used.add(normKey(primary))
      byDay.set(day, { primary, secondary: null })
      continue
    }

    if (slotKind === 'return') {
      const haystack = buildModetourDayHaystack(row)
      const returnDayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
      const domesticReturn =
        returnDayKind === 'return_home' && isDomesticOnlyRouteText(row.routeText)
      let primary = ''
      if (!domesticReturn) {
        const prev =
          sorted.find((r) => Number(r.day) === maxDay - 1) ??
          findPrevScheduledRow(sorted, maxDay)
        if (prev) {
          let walkDay = Number(prev.day)
          while (walkDay > 0 && !primary) {
            const prevRow =
              sorted.find((r) => Number(r.day) === walkDay) ??
              findPrevScheduledRow(sorted, walkDay + 1)
            if (!prevRow) break
            const prevAlloc = byDay.get(Number(prevRow.day))
            const prevRouteOrdered = collectModetourRouteOrderedSegmentKeywords(
              prevRow.routeText,
              'return_home',
              productDestination,
            )
            const prevFull = collectModetourDayOrderedKeywordCandidates(
              prevRow,
              'return',
              productDestination,
            )
            primary = pickModetourReturnKeywordFromPrevDay(
              prevAlloc,
              prevRouteOrdered,
              prevFull,
              productDestination,
              used,
            )
            walkDay = Number(prevRow.day) - 1
          }
        }
      }
      if (!primary) {
        primary =
          pickModetourAdjacentUnusedKeyword(
            day,
            maxDay,
            sorted,
            used,
            byDay,
            productDestination,
            'backward',
          ) || ''
      }
      if (!primary) {
        const ownRoute = collectModetourRouteOrderedSegmentKeywords(
          row.routeText,
          'return_home',
          productDestination,
        )
        for (let i = ownRoute.length - 1; i >= 0; i--) {
          const kw = ownRoute[i]!
          if (
            !kw ||
            isModetourAirportLikeKeyword(kw) ||
            isDestinationHubEnglishKeyword(kw, productDestination ?? null) ||
            isKnownDestinationCityEnglishKeyword(kw)
          ) {
            continue
          }
          const nk = normKey(kw)
          if (nk && used.has(nk)) continue
          primary = kw
          break
        }
      }
      if (!primary) {
        primary = pickModetourReturnReuseTourismKeyword(sorted, maxDay, productDestination)
      }
      if (primary) used.add(normKey(primary))
      byDay.set(day, { primary, secondary: null })
      continue
    }

    const movementOnly =
      isScheduleInFlightOvernightRow(row) ||
      isScheduleAirportOnlyRouteText(row.routeText, isModetourDomesticHubToken)

    const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
      row.routeText,
      'tourism',
      productDestination,
    )
    const ordered = collectModetourDayOrderedKeywordCandidates(row, slotKind, productDestination)
    let primary = movementOnly
      ? ''
      : pickFirstUnusedModetourRouteKeyword(routeOrdered, used, undefined, productDestination)
    if (!primary) {
      primary = pickFirstUnusedModetourRouteKeyword(ordered, used, undefined, productDestination)
    }
    if (movementOnly) {
      if (!primary || isModetourAirportLikeKeyword(primary)) {
        primary =
          pickModetourAdjacentUnusedKeyword(
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
        pickModetourAdjacentUnusedKeyword(
          day,
          maxDay,
          sorted,
          used,
          byDay,
          productDestination,
          'both',
        ) || ''
    }
    if (primary) used.add(normKey(primary))
    let secondary = ''
    if (primary) {
      const fromLlm2 = tryAcceptModetourLlmImageKeyword(row.imageKeyword2, productDestination)
      if (
        fromLlm2 &&
        !modetourKeywordKeysOverlap(fromLlm2, primary) &&
        !used.has(normKey(fromLlm2))
      ) {
        secondary = fromLlm2
      }
      if (!secondary) {
        secondary = pickFirstUnusedModetourRouteKeyword(routeOrdered, used, primary, productDestination) || ''
      }
    }
    const hasSecondRouteKeyword =
      !!primary &&
      routeOrdered.some((kw) => kw && !modetourKeywordKeysOverlap(kw, primary))
    if (primary && !secondary && hasSecondRouteKeyword) {
      secondary =
        pickModetourRouteOrderedSecondKeyword(
          primary,
          row.routeText,
          'tourism',
          productDestination,
        ) || ''
      if (secondary && used.has(normKey(secondary))) secondary = ''
    }
    if (
      primary &&
      !secondary &&
      shouldFillScheduleMiddleKeyword2Gap(row, routeOrdered, primary, modetourKeywordKeysOverlap, {
        movementOnly,
      })
    ) {
      secondary = fillScheduleMiddleImageKeyword2Gap({
        primary,
        routeOrdered,
        extraOrdered: ordered,
        overlaps: modetourKeywordKeysOverlap,
        rejectKeyword: (kw) =>
          isModetourAirportLikeKeyword(kw) ||
          isDestinationHubEnglishKeyword(kw, productDestination ?? null),
        pickAdjacent: (allowTripWideReuse, ignoreAdjacentDaySlots) =>
          pickModetourAdjacentUnusedKeyword(
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
              isModetourAirportLikeKeyword(kw) ||
              isDestinationHubEnglishKeyword(kw, productDestination ?? null),
            ignoreAdjacentDaySlots,
          ),
      })
    }
    if (secondary) used.add(normKey(secondary))
    if (secondary && modetourKeywordKeysOverlap(secondary, primary)) {
      secondary = ''
    }
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

export function applyModetourScheduleImageKeywordsToRows<
  T extends ModetourScheduleImageKeywordRow,
>(rows: T[], opts?: ModetourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null
  let out = allocateModetourImageKeywordsByScheduleRules(rows, maxDay, productDestination)

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

    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    const slotKind = resolveModetourKeywordSlotKind(day, maxDay, sorted.length)
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = row.imageKeyword2

    if (!primary) {
      if (slotKind === 'departure' || dayKind === 'movement') {
        primary =
          resolveModetourMovementDayKeyword(row, day, maxDay, productDestination, out) ||
          pickModetourDepartureRepresentativeKeyword(row.routeText, productDestination) ||
          ''
      } else {
        primary = resolveModetourPrimaryKeyword(
          row,
          dayKind,
          day,
          maxDay,
          productDestination,
          out,
        )
      }
      if (primary) {
        used.add(normKey(primary))
      }
    }

    if (
      slotKind === 'middle' &&
      primary &&
      !String(secondary ?? '').trim()
    ) {
      const routeOrdered = collectModetourRouteOrderedSegmentKeywords(
        row.routeText,
        dayKind,
        productDestination,
      )
      const hasSecondRouteKeyword = routeOrdered.some(
        (kw) => kw && !modetourKeywordKeysOverlap(kw, primary),
      )
      if (hasSecondRouteKeyword) {
        const resolved2 = resolveModetourSecondaryKeyword(
          row,
          primary,
          dayKind,
          productDestination,
          day,
        )
        if (resolved2) {
          const nk2 = normKey(resolved2)
          if (nk2 !== normKey(primary) && !used.has(nk2)) {
            secondary = resolved2
            used.add(nk2)
          } else if (nk2 !== normKey(primary)) {
            secondary = resolved2
          }
        }
      }
    }

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: slotKind === 'middle' ? secondary ?? null : null,
    }
  })
}
