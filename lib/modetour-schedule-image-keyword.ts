/**
 * 모두투어 전용: `Product.schedule[].imageKeyword` / `imageKeyword2` — Pexels 검색용 영문.
 * LLM 영문 우선 + 한글·라틴 routeText 명소 보완(하나투어·노랑풍선 SSOT 패턴).
 * REGRESSION-FREEZE[modetour-schedule-image-keyword-ko-route]: 한글 routeText·도시명 반복 분산 — manifest
 * REGRESSION-FREEZE[modetour-register-danang-live-gate]: 베트남 POI 오매핑 차단 — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: dedupe 후 imageKeyword2 reconcile — manifest
 */
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  isRegisterScheduleFreeLeisureDay,
  pickDistinctSecondScheduleImageKeyword,
  resolveTourismKeywordPreferDistinctPerDay,
  shouldReconcileScheduleImageKeyword2,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import {
  findAllMappedKoreanPoisInText,
  findMappedKoreanPoisInTextByMentionOrder,
  isDestinationHubEnglishKeyword,
  isKnownDestinationCityEnglishKeyword,
  mapDestination,
  mapKoreanPoiSegment,
  normalizeSemanticPoiKey,
} from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isNonLandmarkRouteTextSegment,
  isScheduleImageKeywordLandmarkEligible,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'

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

/** 모두투어 routeText 한글 구간 — 공용 POI 사전보다 우선(베트남 오매핑 차단) */
const MODETOUR_ROUTE_POI_OVERRIDES: ReadonlyArray<{ re: RegExp; en: string }> = [
  { re: /내원교/u, en: 'Japanese Covered Bridge' },
  { re: /호이안\s*고대\s*도시|호이안\s*올드\s*타운|호이안\s*고성/u, en: 'Hoi An Ancient Town' },
  { re: /^호이안$/u, en: 'Hoi An Ancient Town' },
  { re: /영흥사|손짜/u, en: 'Linh Ung Pagoda' },
  { re: /다낭\s*대성당/u, en: 'Da Nang Cathedral' },
  { re: /미케\s*비치/u, en: 'My Khe Beach' },
]

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

function routeTextSegments(routeText: string | null | undefined): string[] {
  return splitRouteTextPlaceSegments(routeText).map(stripRouteSegmentNoise).filter((s) => s.length >= 2)
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
  const t = stripRouteSegmentNoise(seg)
  if (!t || isModetourDomesticHubToken(t)) return ''
  for (const { re, en } of MODETOUR_ROUTE_POI_OVERRIDES) {
    if (re.test(t)) {
      try {
        return finalizeScheduleImageKeyword(en)
      } catch {
        return en
      }
    }
  }
  const fromPoi = mapKoreanPoiSegment(t)
  if (fromPoi) {
    try {
      return finalizeScheduleImageKeyword(fromPoi)
    } catch {
      /* continue */
    }
  }
  const fromDest = mapDestination(t)
  if (fromDest && fromDest !== t && !/[\uAC00-\uD7AF]/.test(fromDest)) {
    try {
      return finalizeScheduleImageKeyword(fromDest)
    } catch {
      /* continue */
    }
  }
  return ''
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
  if (!landmarks.length) {
    const rt = String(routeText ?? '').trim()
    for (const en of findAllMappedKoreanPoisInText(rt)) {
      try {
        pushUniqueLandmark(landmarks, finalizeScheduleImageKeyword(en))
      } catch {
        pushUniqueLandmark(landmarks, en)
      }
    }
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
    for (const { re, en } of MODETOUR_ROUTE_POI_OVERRIDES) {
      if (re.test(t)) {
        try {
          const fin = finalizeScheduleImageKeyword(en)
          return fin.length >= en.length - 4 ? fin : en
        } catch {
          return en
        }
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

  const hay = String(routeText ?? '').trim()
  for (const { en } of findMappedKoreanPoisInTextByMentionOrder(hay)) {
    const accepted = tryAcceptModetourLlmImageKeyword(en, productDestination)
    if (
      accepted &&
      !isDestinationHubEnglishKeyword(accepted, productDestination) &&
      isScheduleImageKeywordLandmarkEligible(accepted)
    ) {
      return accepted
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
  const haystack = buildModetourDayHaystack(row)
  for (const en of findAllMappedKoreanPoisInText(haystack)) {
    const accepted = tryAcceptModetourLlmImageKeyword(en, productDestination)
    if (accepted) pushUniqueLandmark(out, accepted)
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
  return acceptLlmScheduleImageKeyword(raw, {
    productDestination,
    isFormatOk: isModetourLlmImageKeywordFormatOk,
    isDomesticHub: isModetourDomesticHubToken,
    isCrossContinentHallucination: isModetourCrossContinentHallucinationKeyword,
  })
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
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|호치민|방콕|Bangkok|Tokyo|Osaka|델리|Delhi|홍콩|Hong\s*Kong)/i.test(
      j,
    )
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
  if (day === 1 && /출발/.test(j) && /(도착|입국)/.test(j) && /(공항|ICN|PVG|GMP|김포|인천|부산|PUS|대구|TAE|청주|CJJ)/.test(j)) {
    return 'movement'
  }
  if (
    day === 1 &&
    /(입국|도착|공항|피켓|미팅)/.test(j) &&
    /(상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|김포|인천|부산|델리|Delhi)/i.test(j) &&
    /(가이드|호텔|공항|출발|탑승)/.test(j)
  ) {
    return 'movement'
  }
  return 'tourism'
}

function resolveModetourMovementDayKeyword(
  row: ModetourScheduleImageKeywordRow,
  day: number,
  maxDay: number,
  productDestination: string | null | undefined,
  allRows: ModetourScheduleImageKeywordRow[],
): string {
  if (dayKindIsReturnOnlyDomestic(row, day, maxDay)) return ''

  if (day === 1) {
    const fromFirst = pickForeignPlaceFromRouteText(row.routeText, false, productDestination)
    if (fromFirst) return fromFirst
  }

  const pickLast = day === maxDay && maxDay >= 2
  const fromRoute = pickForeignPlaceFromRouteText(row.routeText, pickLast, productDestination)
  if (fromRoute) return fromRoute

  const tripPlaces = collectTripForeignPlaceKeywordsInDayOrder(allRows, productDestination)
  if (day === 1 && tripPlaces[0]) return tripPlaces[0]!
  if (day === maxDay && tripPlaces.length) return tripPlaces[tripPlaces.length - 1]!

  return inferModetourKeywordFromDayContent(row, productDestination)
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

  if (dayKind === 'return_home') {
    return ''
  }

  const haystack = buildModetourDayHaystack(row)
  if (isRegisterScheduleFreeLeisureDay(haystack)) {
    return ''
  }

  if (dayKind === 'movement') {
    return resolveModetourMovementDayKeyword(row, day, maxDay, productDestination, allRows)
  }

  if (accepted) {
    if (isKnownDestinationCityEnglishKeyword(accepted)) {
      const fromPoi = preferPoiOverBareCityLlm(row, accepted, productDestination)
      if (fromPoi !== accepted) return fromPoi
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

  const fromRouteFirst = pickFirstTourismPoiFromRouteText(row.routeText, productDestination)
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

function resolveModetourSecondaryKeyword(
  row: ModetourScheduleImageKeywordRow,
  primary: string,
  dayKind: ModetourScheduleCardDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (!primary) return null
  if (dayKind === 'movement' || dayKind === 'return_home') return null

  const pk = normKey(primary)

  const fromLlm = tryAcceptModetourLlmImageKeyword(row.imageKeyword2, productDestination)
  if (fromLlm && normKey(fromLlm) !== pk) return fromLlm

  const fromRouteOrdered = pickDistinctSecondScheduleImageKeyword(
    primary,
    filterTourismRouteLandmarkCandidates(
      collectRouteLandmarkKeywordsFromRouteText(row.routeText, productDestination),
      productDestination,
    ),
  )
  if (fromRouteOrdered) return fromRouteOrdered

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

  for (const kw of collectRouteLandmarkKeywordsFromRouteText(row.routeText, productDestination)) push(kw)
  for (const en of findAllMappedKoreanPoisInText(buildModetourDayHaystack(row))) push(en)
  push(pickForeignPlaceFromRouteText(row.routeText, true, productDestination))
  push(pickFirstTourismPoiFromRouteText(row.routeText, productDestination))
  push(inferModetourKeywordFromDayContent(row, productDestination))
  push(row.imageKeyword)
  return out
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

    const fromDay = pickUnused(collectModetourDayPrimaryCandidates(row, dayKind, productDestination))
    if (fromDay) return { ...row, imageKeyword: fromDay }

    const fromTrip = pickUnused(tripLandmarks)
    if (fromTrip) return { ...row, imageKeyword: fromTrip }

    return row
  })
}

export function applyModetourScheduleImageKeywordsToRows<
  T extends ModetourScheduleImageKeywordRow,
>(rows: T[], opts?: ModetourScheduleImageKeywordOpts): T[] {
  const sorted = rows.filter((r) => Number(r.day) > 0)
  const maxDay = sorted.length ? Math.max(...sorted.map((r) => Number(r.day))) : 1
  const productDestination = opts?.productDestination ?? null

  const mapped = rows.map((row) => {
    const day = Number(row.day)
    if (day <= 0) {
      return {
        ...row,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: row.imageKeyword2 ?? null,
      }
    }

    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveModetourPrimaryKeyword(row, dayKind, day, maxDay, productDestination, sorted)
    const secondary = resolveModetourSecondaryKeyword(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })

  const deduped = dedupeModetourTourismPrimaryKeywordsAcrossDays(mapped, maxDay, productDestination)

  // dedupe가 1순위만 바꾸므로 2순위 null·중복이면 최종 primary 기준으로 재산출
  return deduped.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const primary = String(row.imageKeyword ?? '').trim()
    if (!shouldReconcileScheduleImageKeyword2(primary, row.imageKeyword2)) return row
    const haystack = buildModetourDayHaystack(row)
    const dayKind = classifyModetourScheduleCardDayKind(day, maxDay, haystack)
    const secondary = resolveModetourSecondaryKeyword(row, primary, dayKind, productDestination)
    return { ...row, imageKeyword2: secondary }
  })
}
