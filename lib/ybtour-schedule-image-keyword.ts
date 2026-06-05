/**
 * 노랑풍선(ybtour): 일차 imageKeyword / imageKeyword2 — Pexels 검색용 영문.
 * 모두투어와 동일 우선순위: LLM → routeText 라틴 세그먼트 → 본문 추론;
 * 2순위: LLM2 → routeText 2번째 라틴; movement/return_home 일차는 imageKeyword2 null.
 * REGRESSION-FREEZE[ybtour-schedule-image-keyword-distinct]: 동일 랜드마크 전일차 반복 금지 — manifest
 */
import {
  acceptLlmScheduleImageKeyword,
  inferEnglishPlaceKeywordFromDayContent,
  resolveTourismKeywordPreferDistinctPerDay,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { findAllMappedKoreanPoisInText, mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import {
  finalizeScheduleImageKeyword,
  isBareCityOrCountryKeyword,
  isNonLandmarkRouteTextSegment,
  normalizeToPlaceName,
} from '@/lib/pexels-place-name-keyword'

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
  '- **imageKeyword / imageKeyword2**: 공통 [schedule[].imageKeyword / imageKeyword2] 규칙 + 서버는 **LLM 영문 우선**, 없으면 routeText **라틴(영문) 세그먼트**, 본문 추론 순. **imageKeyword2** = LLM 2순위 또는 routeText **두 번째 세그먼트의 라틴 표기**(1순위와 다른 명소). 출발·귀국·이동(movement/return) 일차는 imageKeyword2 **null**.\n' +
  '- **routeText**: 한국어로 작성(이동 순서 ` - `). imageKeyword는 routeText 한글을 **직접** 영문으로 바꾸지 말고 **영문 관광지·랜드마크 고유명**을 채운다(서버가 라틴·본문으로 보완).\n'

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const MIDDLE_EAST_AFRICA_PRODUCT_DEST_RE =
  /이집트|Egypt|두바이|Dubai|모로코|Morocco|튀니지|Tunisia|케냐|Kenya|남아프리카|South\s*Africa|에티오피아|Ethiopia|이스라엘|Israel|요르단|Jordan/i

const JAPAN_HALLUCINATION_ON_NON_JAPAN_DEST_RE =
  /\b(Osaka(?:\s*Castle)?|Tokyo|Kyoto|Dotonbori|Shibuya|Harajuku|Fushimi|Kinkakuji|Ginkakuji|Mount\s*Fuji|Fuji)\b/i

const YBTOUR_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const YBTOUR_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

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
    /(홍콩|Hong\s*Kong|두바이|Dubai|카이로|Cairo|상해|PVG|푸동|연길|YNJ|다낭|Da\s*Nang|호치민|방콕|Bangkok|Tokyo|Osaka)/i.test(j)
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
    /(홍콩|Hong\s*Kong|두바이|Dubai|카이로|Cairo|상해|PVG|김포|인천|부산)/i.test(j) &&
    /(가이드|호텔|공항|출발|탑승)/.test(j)
  ) {
    return 'movement'
  }
  return 'tourism'
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

  if (dayKind === 'movement' || dayKind === 'return_home') {
    const pickLast = day === maxDay && maxDay >= 2
    const fromRoute = pickEnglishRouteTextPlace(row.routeText, pickLast)
    if (fromRoute) return fromRoute
    const fromRouteKo = pickFirstAcceptedFromRouteKoreanSegments(row, productDestination)
    if (fromRouteKo) return fromRouteKo
    return inferYbtourKeywordFromDayContent(row, productDestination)
  }

  const fromRoute = pickEnglishRouteTextPlace(row.routeText, false)
  if (fromRoute) return fromRoute

  const fromRouteKo = pickFirstAcceptedFromRouteKoreanSegments(row, productDestination)
  if (fromRouteKo) return fromRouteKo

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

  const landmarks = collectRouteLandmarkKeywordsFromRouteText(row.routeText)
  for (const kw of landmarks) {
    const accepted = tryAcceptYbtourLlmImageKeyword(kw, productDestination)
    if (accepted && normKey(accepted) !== normKey(primary)) return accepted
  }

  return null
}

export function applyYbtourScheduleImageKeywordsToRows<
  T extends YbtourScheduleImageKeywordRow,
>(rows: T[], opts?: YbtourScheduleImageKeywordOpts): T[] {
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

    const haystack = buildYbtourDayHaystack(row)
    const dayKind = classifyYbtourScheduleCardDayKind(day, maxDay, haystack)
    const primary = resolveYbtourPrimaryKeywordCore(row, dayKind, day, maxDay, productDestination, sorted)
    const secondary = resolveYbtourSecondaryKeywordCore(row, primary, dayKind, productDestination)

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  })

  return dedupeYbtourTourismPrimaryKeywordsAcrossDays(mapped, maxDay, productDestination)
}

/* ——— 레거시·에어텔 routeText KO→EN 헬퍼 (apply SSOT와 분리) ——— */

function englishFromRouteSegment(seg: string): string {
  const t = stripRouteSegmentNoise(seg)
  if (!t || isYbtourDomesticHubToken(t)) return ''

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

  if (/^[A-Za-z][A-Za-z0-9\s,.'-]{2,}$/.test(t) && !/[\uAC00-\uD7AF]/.test(t)) {
    try {
      return finalizeScheduleImageKeyword(t)
    } catch {
      return ''
    }
  }

  return ''
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
