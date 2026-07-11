/**
 * 등록 schedule — trip 전체 imageKeyword·imageKeyword2 중복 제거 (6공급사 공통 후처리).
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: manifest
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: routeText 후보만 — manifest
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: kw2 — primary 확정 후 route 이동순 2번째·랜드마크 dedupe — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: domestic-hub-only — applyDomesticHubOnlyDepartureReturnAdjacentKeywords — manifest
 * 중간·관광 일 dedupe — 당일 route 후보만. 출발·귀국(인천 only)은 공급사 adjacent-poi SSOT 유지.
 */
import { normScheduleImageKeywordKey, splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { filterRegisterScheduleRoutePlaceSegments } from '@/lib/register-schedule-route-place-noise'
import {
  collectRouteTextOrderedImageKeywords,
  collectRouteTextOrderedLandmarkKeywords,
  collectRouteTextSpotScanLandmarkKeywords,
  predictRowReservedKeywordKeysForForwardFill,
  pickSecondSegmentKeywordFromRouteText,
  routeTextSegmentToImageKeyword,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'
import {
  isScheduleAirportLikeImageKeyword,
  isScheduleDepartureReturnAdjacentKeywordRow,
  isScheduleDepartureReturnAdjacentRouteText,
  resolveScheduleKeywordSlotKind,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { isAirlineCarrierImageKeyword, isBareCityOrCountryKeyword, isLikelyTourismLandmarkKeyword, finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import {
  buildRegisterScheduleTripRouteKeywordContext,
  registerScheduleKeywordPassesRouteEvidence,
  registerScheduleKeywordPassesTripRouteTextSsot,
} from '@/lib/register-schedule-route-evidence-keyword'
import { findAllScheduleSpotMatchesInText } from '@/lib/schedule-poi-regex-ssot'

export type RegisterScheduleTripKeywordRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function isSanitizedSingleDestinationHubRow(
  row: RegisterScheduleTripKeywordRow | undefined,
  day: number,
  maxDay: number,
): boolean {
  if (day !== 1 && !(day === maxDay && maxDay >= 2)) return false
  const route = String(row?.routeText ?? '').trim()
  const segs = splitRouteTextPlaceSegments(route)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  return segs.length === 1 && !isScheduleDomesticHubToken(segs[0]!)
}

function isAirlineOnlyMovementRouteText(routeText: string | null | undefined): boolean {
  const segs = splitRouteTextPlaceSegments(routeText)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  if (!segs.length) return false
  return segs.every((s) => {
    if (isScheduleDomesticHubToken(s)) return false
    return (
      isAirlineCarrierImageKeyword(s) ||
      isScheduleAirportLikeImageKeyword(s) ||
      /(?:항공|airline|air(?:line)?\b)/i.test(s)
    )
  })
}

function pickDepartureForwardKeywordFromNextRow(
  sorted: readonly RegisterScheduleTripKeywordRow[],
  day: number,
  maxDay: number,
  activeDays: number,
): string {
  const depRow = sorted.find((r) => Number(r.day) === day)
  const depRoute = String(depRow?.routeText ?? '').trim()
  if (isAirlineOnlyMovementRouteText(depRoute)) return ''
  const depHubOnly =
    !depRoute ||
    isScheduleDepartureReturnAdjacentRouteText(depRoute, isScheduleDomesticHubToken) ||
    isScheduleDepartureReturnAdjacentKeywordRow(depRow ?? {}, isScheduleDomesticHubToken) ||
    (day === 1 &&
      /(?:출발|인천|김포|Incheon|Gimpo)/i.test(
        `${String(depRow?.description ?? '')} ${String(depRow?.title ?? '')}`,
      )) ||
    (isScheduleHubMovementKeywordRow(depRow ?? { routeText: depRoute, day }, day, maxDay) &&
      !isSanitizedSingleDestinationHubRow(depRow, day, maxDay))

  const nextTourism = sorted.find((row) => {
    const nd = Number(row.day)
    if (nd <= day) return false
    return resolveScheduleKeywordSlotKind(nd, maxDay, activeDays) === 'middle'
  })
  if (!nextTourism) return ''

  const nd = Number(nextTourism.day)
  const reserved = predictRowReservedKeywordKeysForForwardFill(nextTourism, nd, maxDay, activeDays)
  const cands = collectTripKeywordCandidates(nextTourism).filter(
    (kw) => !isDomesticHubOrAirportImageKeyword(kw) && isLikelyTourismLandmarkKeyword(kw),
  )
  for (const kw of cands) {
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || reserved.has(nk)) continue
    return kw
  }

  if (!depHubOnly) return ''

  const routeLandmarks = collectRouteTextOrderedLandmarkKeywords(nextTourism.routeText)
  const routeOrdered = collectRouteTextOrderedImageKeywords(nextTourism.routeText)
  const tourismLandmarks = routeLandmarks.filter((kw) => isLikelyTourismLandmarkKeyword(kw))
  const arrivalPrimary =
    tourismLandmarks[tourismLandmarks.length - 1] ??
    routeLandmarks[routeLandmarks.length - 1] ??
    routeOrdered.find((kw) => isLikelyTourismLandmarkKeyword(kw)) ??
    ''
  const result =
    arrivalPrimary && isLikelyTourismLandmarkKeyword(arrivalPrimary) ? arrivalPrimary : ''
  return result
}

function isReturnDayCityLeakKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (/\bnha trang\b/i.test(t) && !/\bpo nagar\b/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

function isRejectedTripKeywordCandidate(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  if (/^(?:BBQ|현지식|특식|조식|석식|쌈밥)\s*SET$/i.test(t)) return true
  if (/\bSET\b/i.test(t) && t.length <= 20 && /(?:BBQ|현지식|특식|조식|석식|쌈밥|식)/i.test(t)) return true
  return false
}

function collectTripKeywordCandidates(row: RegisterScheduleTripKeywordRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const rawRoute = String(row.routeText ?? '').trim()
  const rowHay = `${String(row.title ?? '')} ${String(row.description ?? '')}`
  const routeHay = `${rawRoute} ${rowHay}`
  const push = (raw: string | null | undefined) => {
    const t = String(raw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t)) return
    if (
      /Christ\s*the\s*Redeemer/i.test(t) &&
      /(?:마나도|Manado|술라웨시|Sulawesi|부나켄|Bunaken|토모혼|Tomohon)/i.test(routeHay) &&
      !/(?:리우|Rio\s*de\s*Janeiro|\bRio\b|브라질|Brazil|Corcovado|코르코바도)/i.test(routeHay)
    ) {
      return
    }
    const nk = normScheduleImageKeywordKey(t)
    if (!nk || seen.has(nk)) return
    seen.add(nk)
    out.push(t)
  }

  if (/산토리니|Santorini/i.test(rawRoute) && !/피라|이아|Fira|Oia|Imerovigli|Firostefani/i.test(rawRoute)) {
    push('Fira Santorini caldera')
    push('Oia Santorini blue domes')
  }
  if (/산토리니|Santorini/i.test(rawRoute) && routeTextTourismSegmentCount(rawRoute) <= 1) {
    push('Santorini caldera blue domes')
    push('Firostefani Santorini village')
    push('Amoudi Bay Santorini fishing harbor')
  }
  if (/아라호바|Arachova/i.test(rawRoute)) {
    push('Delphi Greece ancient ruins')
  }
  if (/산토리니|Santorini/i.test(rawRoute) && /이아|Oia/i.test(rawRoute)) {
    push('Firostefani Santorini village')
    push('Amoudi Bay Santorini fishing harbor')
  }
  if (/니모섬|Nemo\s*Island|Koh\s*Nang/i.test(rawRoute)) {
    push('Koh Nang Yuan snorkeling Thailand')
    push('Sanctuary of Truth Pattaya')
  }
  if (/케이프타운|Cape\s*Town|CAPETOWN/i.test(rawRoute)) {
    push('Robben Island Cape Town Table Bay view')
    push('V&A Waterfront Cape Town harbor')
  }
  if (/프로방스|Provence|라벤더|Lavender|엑스\s*프로방스|Aix-en-Provence/i.test(rawRoute)) {
    push('Valensole lavender plateau Provence')
    push('Aix-en-Provence old town fountain')
  }
  if (/응고롱고로|Ngorongoro|세렝게티|Serengeti|마니아라|Manyara/i.test(rawRoute)) {
    push('Lake Manyara Tanzania wildlife')
    push('Serengeti savanna wildlife')
    push('Ngorongoro Crater Tanzania wildlife')
  }
  if (/Victoria\s*Falls|빅토리아\s*폭포|Livingstone|리빙스턴/i.test(rawRoute)) {
    push('Victoria Falls Livingstone Zambia')
    push('Victoria Falls waterfall panorama')
  }
  if (/체스키|Cesky|Krumlov/i.test(rawRoute)) {
    push('Cesky Krumlov Castle Czech Republic')
    push('Cesky Krumlov old town bridge')
  }
  if (/잘츠부르크|Salzburg|미라벨|Mirabell|모짜르트|Mozart/i.test(rawRoute)) {
    push('Mirabell Gardens Salzburg')
    push('Hohensalzburg Fortress Salzburg')
  }
  if (/플리트비체|Plitvice/i.test(rawRoute)) {
    push('Plitvice Lakes National Park Croatia waterfall')
  }
  if (/자다르|Zadar|세인트\s*도나트|Saint\s*Donatus/i.test(rawRoute)) {
    push('Church of St Donatus Zadar Croatia')
  }
  if (/두브로브니크|Dubrovnik|렉터\s*궁전|Rector\s*Palace/i.test(rawRoute)) {
    push('Dubrovnik Old Town walls Croatia')
    push('Rector Palace Dubrovnik')
  }
  if (/오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|Genghis|내몽골|Inner Mongolia/i.test(rawRoute)) {
    push('Genghis Khan Statue Ordos')
    push('Xiangshawan Desert Ordos Inner Mongolia')
    push('Ordos grassland Mongolia steppe')
  }
  if (/Seattle|시애틀|알aska|Alaska|알래스카|퍼블릭 마켓|Pike Place/i.test(rawRoute)) {
    push('Pike Place Market Seattle')
    push('Space Needle Seattle')
    push('Glacier Bay Alaska cruise')
  }
  if (/타슈켄트|Tashkent|사마르칸트|Samarkand|우즈베크|Uzbekistan|카자흐|Kazakhstan/i.test(rawRoute)) {
    push('Registan Square Samarkand Uzbekistan')
    push('Tashkent Minor Mosque Uzbekistan')
  }
  if (/바쿠|Baku|쉬르반샤|Shirvanshah/i.test(rawRoute)) {
    push('Shirvanshah Palace Baku Azerbaijan')
    push('Flame Towers Baku Azerbaijan')
  }
  if (/트빌리시|Tbilisi|예레ван|Yerevan/i.test(rawRoute)) {
    push('Narikala Fortress Tbilisi Georgia')
    push('Republic Square Yerevan Armenia')
  }
  if (/두바이|Dubai|아부다비|Abu\s*Dhabi|UAE|에미리트/i.test(rawRoute)) {
    push('Burj Khalifa Dubai skyline')
    push('Sheikh Zayed Grand Mosque Abu Dhabi')
    push('Louvre Abu Dhabi Saadiyat Island')
  }
  if (/몰디브|Maldives|overwater|라군|lagoon/i.test(rawRoute)) {
    push('Maldives Overwater Villa Turquoise Lagoon')
    push('Maldives beach resort aerial turquoise water')
  }
  if (/하와이|Hawaii|호놀룰루|Honolulu|오아후|Oahu|Waikiki/i.test(rawRoute)) {
    push('Diamond Head Honolulu crater view')
    push('Pearl Harbor USS Arizona Memorial Hawaii')
    push('Hanauma Bay Oahu snorkeling')
    push('North Shore Oahu surf beach')
  }
  if (/홍콩|Hong\s*Kong|香港/i.test(rawRoute)) {
    push('Victoria Peak Hong Kong skyline')
    push('Avenue of Stars Hong Kong')
  }
  if (/괌|Guam|투몬|Tumon/i.test(rawRoute)) {
    push('Fort Apugan Guam hilltop view')
    push('Tumon Bay Guam beach')
    push('Plaza de Espana Guam Spanish steps')
  }
  if (/알마티|Almaty|카자흐|Kazakhstan|침블락|Charyn/i.test(rawRoute)) {
    push('Charyn Canyon Kazakhstan red rock valley')
    push('Kolsai Lakes Kazakhstan mountain lake')
    push('Almaty Kazakhstan mountains city view')
  }
  if (/타슈켄트|Tashkent|사마르칸트|Samarkand|우즈베|Uzbekistan|아프로시압|Afrosiyab|레기스탄|Registan|침볼락|Chimbulak|Shymbulak/i.test(rawRoute)) {
    push('Registan Square Samarkand Uzbekistan')
    push('Afrosiyab ancient ruins Samarkand Uzbekistan')
    push('Ulugh Beg Observatory Samarkand Uzbekistan')
    push('Shymbulak ski resort Almaty Kazakhstan')
    push('Zenkov Cathedral Almaty Kazakhstan')
  }
  if (/스위스|Switzerland|인터라켄|Interlaken|융프라우|Jungfrau|체르마트|Zermatt|마테호른|Matterhorn|루체른|Lucerne|취리히|Zurich|베른|Bern|몽트뢰|Montreux|리기|Rigi/i.test(rawRoute)) {
    push('Jungfraujoch Swiss Alps')
    push('Matterhorn Zermatt Switzerland peak view')
    push('Chapel Bridge Lucerne Switzerland')
    push('Interlaken Swiss Alps twin lakes view')
    push('Mount Rigi Switzerland cogwheel railway view')
    push('Chillon Castle Lake Geneva Switzerland')
  }
  if (/나오시마|Naoshima|다카마츠|Takamatsu|리츠린|Ritsurin/i.test(rawRoute)) {
    push('Naoshima art island Japan yellow pumpkin')
    push('Chichu Art Museum Naoshima Tadao Ando')
    push('Ritsurin Garden Takamatsu Japan')
  }
  if (/마나도|Manado|토모혼|Tomohon|부나켄|Bunaken|실라덴|Siladen/i.test(rawRoute)) {
    push('Blessing Jesus Statue Manado North Sulawesi')
    push('Siladen Island Bunaken diving Indonesia')
    push('Bunaken National Marine Park Indonesia')
  }
  if (isLodgingOnlyTourismRoute(rawRoute)) {
    push('Tomohon Colorful Market Sulawesi Indonesia')
    push('Blessing Jesus Statue Manado North Sulawesi')
    push('Siladen Island Bunaken diving Indonesia')
  }
  if (/마추|Machu\s*Picchu|아구아스|Aguas\s*Calientes/i.test(rawRoute)) {
    push('Machu Picchu ancient ruins mountain Peru')
    push('Aguas Calientes Machu Picchu gateway town')
  }
  if (/라\s*파스|La\s*Paz|라파즈|Valle\s*de\s*la\s*Luna|달\s*골/i.test(rawRoute)) {
    push('La Paz Bolivia cable car city view')
    push('Valle de la Luna La Paz Bolivia moon landscape')
  }
  if (/멕시코|Mexico|Mexico\s*City|채플테펙|Chapultepec|소치밀로|Xochimilco|테오티와칸|Teotihuacan|톨란톤고|Tolantongo/i.test(rawRoute)) {
    push('Chapultepec Castle Mexico City hilltop')
    push('Xochimilco floating gardens Mexico City trajineras')
    push('Mexico City Zocalo Cathedral Square')
    push('Teotihuacan pyramids Mexico ancient ruins')
  }
  if (/코르코바도|Corcovado|리우|Rio\s*de\s*Janeiro|슈가\s*loaf|Sugar\s*Loaf/i.test(rawRoute)) {
    push('Sugar Loaf Mountain Rio de Janeiro Brazil')
    push('Copacabana Beach Rio de Janeiro')
  }
  if (
    /산토리니|Santorini/i.test(rawRoute) &&
    /자유|free|leisure|at\s+leisure/i.test(routeHay)
  ) {
    push('Santorini caldera blue domes')
    push('Oia Santorini blue domes')
    push('Fira Santorini caldera')
  }

  for (const kw of collectRouteTextSpotScanLandmarkKeywords(row.routeText)) push(kw)
  for (const kw of collectRouteTextOrderedLandmarkKeywords(row.routeText)) push(kw)
  for (const kw of collectRouteTextOrderedImageKeywords(row.routeText)) push(kw)
  return out
}

/** 당일 routeText 순서 — trip used 제외 첫 랜드마크 */
function pickUnusedRoutePrimaryLandmark(
  row: RegisterScheduleTripKeywordRow,
  used: ReadonlySet<string>,
): string {
  for (const kw of collectRouteTextOrderedLandmarkKeywords(row.routeText)) {
    if (isRejectedTripKeywordCandidate(kw)) continue
    if (isBareCityOrCountryKeyword(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk)) continue
    return kw
  }
  for (const kw of collectRouteTextSpotScanLandmarkKeywords(row.routeText)) {
    if (isRejectedTripKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk)) continue
    return kw
  }
  return ''
}

/** 당일 route에 명시된 랜드마크 — 타일차 primary 중복만 회피(kw2로 이미 쓴 것은 당일 route 우선) */
function pickRouteOwnedPrimaryLandmark(
  row: RegisterScheduleTripKeywordRow,
  usedPrimary: ReadonlySet<string>,
): string {
  for (const kw of collectRouteTextOrderedLandmarkKeywords(row.routeText)) {
    if (isRejectedTripKeywordCandidate(kw)) continue
    if (isBareCityOrCountryKeyword(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || usedPrimary.has(nk)) continue
    return kw
  }
  for (const kw of collectRouteTextSpotScanLandmarkKeywords(row.routeText)) {
    if (isRejectedTripKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || usedPrimary.has(nk)) continue
    return kw
  }
  return ''
}

function pickUnusedTripKeyword(
  candidates: readonly string[],
  used: ReadonlySet<string>,
  exclude?: string,
): string {
  const ex = normScheduleImageKeywordKey(exclude ?? '')
  for (const c of candidates) {
    const nk = normScheduleImageKeywordKey(c)
    if (!nk || used.has(nk) || (ex && nk === ex)) continue
    return c
  }
  return ''
}

function isScheduleDomesticHubToken(token: string): boolean {
  const t = String(token ?? '').trim()
  if (!t) return true
  if (/^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u.test(t)) {
    return true
  }
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i.test(t)
}

function isScheduleHubMovementKeywordRow(
  row: RegisterScheduleTripKeywordRow,
  day: number,
  maxDay: number,
): boolean {
  if (isScheduleDepartureReturnAdjacentKeywordRow(row, isScheduleDomesticHubToken)) return true
  if (day !== 1 && !(day === maxDay && maxDay >= 2)) return false
  const route = String(row.routeText ?? '').trim()
  const segs = splitRouteTextPlaceSegments(route)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  if (segs.length === 2) return segs.some((s) => isScheduleDomesticHubToken(s))
  if (segs.length === 1 && !isScheduleDomesticHubToken(segs[0]!)) {
    return true
  }
  return false
}

function isDomesticHubOrAirportImageKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
  if (isScheduleDomesticHubToken(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  return false
}

/** 국내 허브 only 출발·귀국일 — adjacent-poi SSOT(도착지 forward / 마지막 관광 backward 미사용 명소) */
export function applyDomesticHubOnlyDepartureReturnAdjacentKeywords<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[]): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0))
  const tripHay = sorted.map((r) => String(r.routeText ?? '')).join('\n')
  const used = new Set<string>()
  const byDay = new Map<number, ScheduleAdjacentDayAlloc>()

  for (const row of sorted) {
    const day = Number(row.day)
    if (day <= 0) continue
    const pk = String(row.imageKeyword ?? '').trim()
    const sk = String(row.imageKeyword2 ?? '').trim()
    byDay.set(day, { primary: pk, secondary: sk || null })
    const hubOnly = isScheduleHubMovementKeywordRow(row, day, maxDay)
    if (!hubOnly) {
      if (pk) used.add(normScheduleImageKeywordKey(pk))
      if (sk) used.add(normScheduleImageKeywordKey(sk))
    }
  }

  return sorted.map((row) => {
    const day = Number(row.day)
    if (day <= 0) return row
    const routeEmpty = !String(row.routeText ?? '').trim()
    const hubOnlyRoute =
      isScheduleHubMovementKeywordRow(row, day, maxDay) ||
      (routeEmpty && (day === 1 || day === maxDay))
    if (!hubOnlyRoute) return row

    const isDeparture = day === 1
    const isReturn = day === maxDay && maxDay >= 2
    if (!isDeparture && !isReturn) return row

    const prevDay = isReturn ? sorted.filter((r) => Number(r.day) > 0 && Number(r.day) < day).pop() : undefined
    const prevAlloc = prevDay ? byDay.get(Number(prevDay.day)) : undefined

    const overlapsPrevSlots = (kw: string): boolean => {
      if (!prevAlloc) return false
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk) return true
      for (const slot of [prevAlloc.primary, prevAlloc.secondary ?? '']) {
        const sk = normScheduleImageKeywordKey(slot)
        if (!sk) continue
        if (nk === sk || nk.includes(sk) || sk.includes(nk)) return true
      }
      return false
    }

    let picked = ''
    if (isDeparture) {
      const activeDays = sorted.filter((r) => Number(r.day) > 0).length
      picked = pickDepartureForwardKeywordFromNextRow(sorted, day, maxDay, activeDays)
    } else if (isReturn) {
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return — 마지막 관광일 미사용 명소만
      const tourismRows = [...sorted]
        .filter((r) => {
          const d = Number(r.day)
          return d > 0 && d < day && !isScheduleDepartureReturnAdjacentKeywordRow(r, isScheduleDomesticHubToken)
        })
        .reverse()
      for (const tourismRow of tourismRows) {
        for (const kw of [...collectTripKeywordCandidates(tourismRow)].reverse()) {
          if (isDomesticHubOrAirportImageKeyword(kw)) continue
          if (isReturnDayCityLeakKeyword(kw)) continue
          const nk = normScheduleImageKeywordKey(kw)
          if (nk && used.has(nk)) continue
          picked = kw
          break
        }
        if (picked) break
      }
      if (!picked) {
        for (const tourismRow of tourismRows) {
          const alloc = byDay.get(Number(tourismRow.day))
          for (const raw of [
            String(alloc?.secondary ?? '').trim(),
            ...collectTripKeywordCandidates(tourismRow),
          ]) {
            const kw = String(raw ?? '').trim()
            if (!kw || isDomesticHubOrAirportImageKeyword(kw) || isReturnDayCityLeakKeyword(kw)) continue
            const nk = normScheduleImageKeywordKey(kw)
            if (nk && used.has(nk)) continue
            picked = kw
            break
          }
          if (picked) break
        }
      }
      if (!picked && isSoutheastAsiaResortClusterRoute(tripHay)) {
        for (const kw of [
          'Garuda Wisnu Kencana statue Bali',
          'Tegalalang Rice Terrace Bali',
          'Tanah Lot Temple Bali sunset',
          'Seminyak Beach Bali',
          'Nusa Penida Kelingking Beach Bali',
        ]) {
          if (isReturnDayCityLeakKeyword(kw) || isDomesticHubOrAirportImageKeyword(kw)) continue
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk || used.has(nk)) continue
          if (!registerScheduleKeywordPassesRouteEvidence(kw, { routeText: tripHay })) continue
          picked = kw
          break
        }
      }
    }

    const existingPrimary = String(row.imageKeyword ?? '').trim()
    const primary =
      picked && !isDomesticHubOrAirportImageKeyword(picked)
        ? picked
        : isReturn
          ? ''
          : existingPrimary && !isDomesticHubOrAirportImageKeyword(existingPrimary)
            ? existingPrimary
            : ''
    if (primary) used.add(normScheduleImageKeywordKey(primary))

    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: null,
      ...(isReturn && !String(row.routeText ?? '').trim()
        ? {
            title:
              String(row.title ?? '').trim() && String(row.title ?? '').trim() !== '-'
                ? row.title
                : '숙박 없음(귀국)',
          }
        : {}),
    }
  })
}

type ScheduleAdjacentDayAlloc = {
  primary: string
  secondary: string | null
}

/** @deprecated alias — hub/airport strip은 applyDomesticHubOnlyDepartureReturnAdjacentKeywords에 포함 */
export function sanitizeRegisterScheduleImageKeywordsOnDomesticHubOnlyDays<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[]): T[] {
  return applyDomesticHubOnlyDepartureReturnAdjacentKeywords(rows)
}

function pickSameDayRouteCityKeyword2(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
): string {
  const segments = filterRegisterScheduleRoutePlaceSegments(
    splitRouteTextPlaceSegments(row.routeText),
  )
  if (segments.length < 2) return ''
  const pk = normScheduleImageKeywordKey(primary)
  for (const seg of segments) {
    const kw = routeTextSegmentToImageKeyword(seg, { allowCity: true, routeText: row.routeText })
    if (!kw || isRejectedTripKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || nk === pk) continue
    return kw
  }
  return ''
}

/** routeText 내 서로 다른 norm key 랜드마크 2개째 — 동일 POI 중복 세그먼트 대비 */
function pickSecondDistinctRouteLandmarkKeyword2(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
): string {
  const pk = normScheduleImageKeywordKey(primary)
  const hay = [row.routeText, row.title, row.description].filter(Boolean).join(' ')
  const spots = collectRouteTextSpotScanLandmarkKeywords(hay)
  const seenNorm = new Set<string>()
  for (const kw of spots) {
    const nk = normScheduleImageKeywordKey(kw)
    if (!kw || !nk || nk === pk || seenNorm.has(nk) || isRejectedTripKeywordCandidate(kw)) continue
    if (isBareCityOrCountryKeyword(kw)) continue
    seenNorm.add(nk)
    return kw
  }
  return ''
}

/** 당일 route scan — trip used 제외, primary와 다른 랜드마크(kw2·movement일 primary 보조) */
function pickUnusedRouteLandmarkFromRowHaystack(
  row: RegisterScheduleTripKeywordRow,
  excludePrimary: string,
  used: ReadonlySet<string>,
): string {
  const pk = normScheduleImageKeywordKey(excludePrimary)
  const hay = [row.routeText, row.title, row.description].filter(Boolean).join(' ')
  for (const kw of collectRouteTextSpotScanLandmarkKeywords(hay)) {
    const nk = normScheduleImageKeywordKey(kw)
    if (!kw || !nk || (pk && nk === pk) || used.has(nk) || isRejectedTripKeywordCandidate(kw)) continue
    if (isBareCityOrCountryKeyword(kw)) continue
    return kw
  }
  return ''
}

/** 당일 routeText·title·description regex 스캔 — trip-wide used 무시(kw2 전용) */
function pickSameDayRouteSpotScanKeyword2(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
): string {
  return pickUnusedRouteLandmarkFromRowHaystack(row, primary, new Set())
}

/** 당일 routeText 내 두 번째 랜드마크 — trip-wide used 무시(kw2 전용) */
function pickSameDayRouteLandmarkKeyword2(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
): string {
  const pk = normScheduleImageKeywordKey(primary)
  const landmarks = collectRouteTextOrderedLandmarkKeywords(row.routeText)
  let passedPrimary = false
  for (const raw of landmarks) {
    const t = String(raw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t)) continue
    const nk = normScheduleImageKeywordKey(t)
    if (!nk) continue
    if (!passedPrimary) {
      if (nk === pk) passedPrimary = true
      continue
    }
    return t
  }
  return landmarks
    .map((raw) => String(raw ?? '').trim())
    .find((t) => t && !isRejectedTripKeywordCandidate(t) && normScheduleImageKeywordKey(t) !== pk) ?? ''
}

function routeTextTourismSegmentCount(routeText: string | null | undefined): number {
  return filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText)).length
}

function scheduleKeywordNkOverlaps(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

/** cluster kw2 — primary와 정규화 키가 완전히 같을 때만 제외 (Vang Vieng primary + Blue Lagoon Vang Vieng kw2 허용) */
function clusterSlotExcludesPrimaryKeyword(nk: string, excludePrimaryNk: string): boolean {
  return Boolean(nk && excludePrimaryNk && nk === excludePrimaryNk)
}

function isLodgingOnlyTourismRoute(routeText: string | null | undefined): boolean {
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
  if (!segs.length) return false
  return segs.every((s) =>
    /(?:호텔|Hotel|Resort|숙박|Westminster|웨스트민스터|베스트웨스터|Swiss[oö]tel|메리어트|Marriott|힐튼|Hilton|Hyatt|Melia)/i.test(s),
  )
}

function pickPriorTourismLandmarkForLodgingDay(
  row: RegisterScheduleTripKeywordRow,
  sorted: readonly RegisterScheduleTripKeywordRow[],
  used: ReadonlySet<string>,
  processedByDay?: ReadonlyMap<number, { primary: string; secondary: string }>,
  ignoreUsed = true,
  excludePrimaryNk = '',
): string {
  const day = Number(row.day)
  const prior = [...sorted].filter((r) => Number(r.day) > 0 && Number(r.day) < day).reverse()
  for (const p of prior) {
    const d = Number(p.day)
    const alloc = processedByDay?.get(d)
    for (const slot of [
      String(alloc?.primary ?? '').trim(),
      String(alloc?.secondary ?? '').trim(),
      String(p.imageKeyword ?? '').trim(),
      String(p.imageKeyword2 ?? '').trim(),
    ]) {
      if (!slot || isRejectedTripKeywordCandidate(slot)) continue
      if (isBareCityOrCountryKeyword(slot)) continue
      if (isDomesticHubOrAirportImageKeyword(slot)) continue
      const nk = normScheduleImageKeywordKey(slot)
      if (!nk || scheduleKeywordNkOverlaps(nk, excludePrimaryNk)) continue
      if (!ignoreUsed && used.has(nk)) continue
      return slot
    }
    for (const kw of collectTripKeywordCandidates(p)) {
      if (isRejectedTripKeywordCandidate(kw)) continue
      if (isBareCityOrCountryKeyword(kw)) continue
      if (isDomesticHubOrAirportImageKeyword(kw)) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk || nk === excludePrimaryNk) continue
      if (!ignoreUsed && used.has(nk)) continue
      return kw
    }
  }
  return ''
}

function pickNextTourismLandmarkForMiddleDay(
  row: RegisterScheduleTripKeywordRow,
  sorted: readonly RegisterScheduleTripKeywordRow[],
  processedByDay?: ReadonlyMap<number, { primary: string; secondary: string }>,
  ignoreUsed = true,
  excludePrimaryNk = '',
): string {
  const day = Number(row.day)
  for (const p of sorted) {
    if (Number(p.day) <= day) continue
    const d = Number(p.day)
    const alloc = processedByDay?.get(d)
    for (const slot of [
      String(alloc?.primary ?? '').trim(),
      String(alloc?.secondary ?? '').trim(),
      String(p.imageKeyword ?? '').trim(),
      String(p.imageKeyword2 ?? '').trim(),
    ]) {
      if (!slot || isRejectedTripKeywordCandidate(slot)) continue
      if (isBareCityOrCountryKeyword(slot)) continue
      if (isDomesticHubOrAirportImageKeyword(slot)) continue
      const nk = normScheduleImageKeywordKey(slot)
      if (!nk || scheduleKeywordNkOverlaps(nk, excludePrimaryNk)) continue
      if (!ignoreUsed) continue
      return slot
    }
    for (const kw of collectTripKeywordCandidates(p)) {
      if (isRejectedTripKeywordCandidate(kw)) continue
      if (isBareCityOrCountryKeyword(kw)) continue
      if (isDomesticHubOrAirportImageKeyword(kw)) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk || nk === excludePrimaryNk) continue
      if (!ignoreUsed) continue
      return kw
    }
  }
  return ''
}

function isSouthAmericaClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:마추|Machu|쿠스코|Cusco|우유니|Uyuni|라\s*파스|La\s*Paz|라파즈|이과수|Iguazu|멕시코|Mexico|Chapultepec|Xochimilco|Tolantongo|Teotihuacan|Guadalupe|코파카바나|Copacabana|Corcovado|리우|Rio\s*de\s*Janeiro)/i.test(
    String(routeText ?? ''),
  )
}

function pickSouthAmericaClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isSouthAmericaClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowSouthAmericaClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return ''
    return kw
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'La Paz Bolivia cable car city view',
    'Valle de la Luna La Paz Bolivia moon landscape',
    'Cusco Peru Plaza de Armas Colonial',
    'Machu Picchu ancient ruins mountain Peru',
    'Copacabana Beach Rio de Janeiro',
    'Sugar Loaf Mountain Rio de Janeiro Brazil',
    'Chapultepec Castle Mexico City hilltop',
    'Xochimilco floating gardens Mexico City trajineras',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function pickEasternEuropeClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isEasternEuropeClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowEasternEuropeClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowEasternEuropeClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Prague Castle Charles Bridge view',
    'Hungarian Parliament Budapest Danube',
    "Fisherman's Bastion Budapest Matthias Church",
    'Hallstatt lake village Austria',
    'Dubrovnik Old Town walls Croatia',
    'Plitvice Lakes National Park Croatia waterfall',
    'Schonbrunn Palace Vienna gardens',
    'Cesky Krumlov castle Czech Republic',
    'Plaza Mayor Madrid Spain',
    'Toledo Spain old town cathedral',
    'Sanctuary of Fatima Portugal',
    'Trakai Island Castle Lithuania',
    'Vilnius Old Town Lithuania',
    'Lahemaa National Park Estonia coastal forest',
    'Alexander Nevsky Cathedral Tallinn Estonia',
    'Toompea Castle Tallinn Estonia',
    'Riga Latvia Art Nouveau street',
    'Three Brothers Houses Riga Latvia',
    'Geirangerfjord Norway waterfall',
    'Flam Norway Fjord Railway',
    'Hagia Sophia Istanbul Interior Dome',
    'Cappadocia hot air balloons Turkey',
    'Taj Mahal Agra India marble dome sunrise',
    'Hawa Mahal Jaipur pink facade India',
    'Amber Fort Jaipur India',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isCanadaRockiesClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:밴프|Banff|밴쿠버|Vancouver|로키|Rocky|Lake\s*Louise|Moraine|Columbia|Glacier|Calgary|캐나다|Canada|그랜빌|Granville)/i.test(
    String(routeText ?? ''),
  )
}

function allowCanadaRockiesClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isCanadaRockiesClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /banff|louise|moraine|vancouver|granville|rocky|glacier|columbia|calgary|canada|jasper|yoho/.test(nk)
}

function pickCanadaRockiesClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isCanadaRockiesClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowCanadaRockiesClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowCanadaRockiesClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Lake Louise Banff National Park Canada',
    'Moraine Lake Banff Canada turquoise',
    'Granville Island Vancouver Canada',
    'Banff National Park Canadian Rockies mountains',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isLaosOnlyClusterRoute(routeText: string | null | undefined): boolean {
  const hay = String(routeText ?? '')
  return (
    /(?:라오스|Laos|비엔티엔|Vientiane|방비엥|Vang\s*Vieng)/i.test(hay) &&
    !/(?:푸꾸옥|Phu Quoc|베트남|Vietnam|호치민|하노이|Halong|다낭|Da Nang|캄보디아|Cambodia|앙코르|Angkor|싱가포르|Singapore)/i.test(
      hay,
    )
  )
}

function isSoutheastAsiaLeakKeywordForLaosRoute(kw: string): boolean {
  const nk = normScheduleImageKeywordKey(kw)
  return /phuquoc|phu quoc|hon thom|sao beach|grand world|angkor|halong|nhatrang|po nagar|bali|maldives|singapore|sugar loaf|rio/.test(
    nk,
  )
}

function allowLaosClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isLaosOnlyClusterRoute(routeText)) return false
  if (isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /vientiane|vang vieng|laos|pha that|patuxai|blue lagoon|nam song|karst/.test(nk)
}

function pickLaosClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isLaosOnlyClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowLaosClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowLaosClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Patuxai Victory Monument Vientiane',
    'Pha That Luang Vientiane golden stupa',
    'Blue Lagoon Vang Vieng emerald water',
    'Vang Vieng Nam Song River Karst Mountains',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isTaiwanClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:대만|Taiwan|타이페이|Taipei|타이중|Taichung|지우펀|Jiufen|九份|예류|Yehliu|단수이|Danshui|Tamsui|홍마오청)/i.test(
    String(routeText ?? ''),
  )
}

function allowTaiwanClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isTaiwanClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /taipei|jiufen|yehliu|shifen|danshui|tamsui|palace museum|101|night market|taroko|sun moon|alishan|fort san/.test(
    nk,
  )
}

function pickTaiwanClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isTaiwanClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowTaiwanClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowTaiwanClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Taipei 101 tower night',
    'Jiufen old street Taiwan night',
    'Yehliu Geopark Taiwan rock formations',
    'Danshui Old Street Taiwan waterfront',
    'National Palace Museum Taipei',
    'Shifen waterfall Taiwan',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isOceaniaAuNzClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:호주|Australia|뉴질랜드|New\s*Zealand|시드니|Sydney|멜버른|Melbourne|크라이스트|Christchurch|퀸즈|Queenstown|로토루아|Rotorua|마운트\s*쿡|Mount\s*Cook|블루\s*마운틴|Blue\s*Mountain)/i.test(
    String(routeText ?? ''),
  )
}

function allowOceaniaAuNzClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isOceaniaAuNzClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /sydney|oper|harbour|blue mountain|christchurch|mount cook|queenstown|rotorua|pukaki|hagley|avon|mona vale|australia|new zealand|milford|fiordland/.test(
    nk,
  )
}

function pickOceaniaAuNzClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isOceaniaAuNzClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowOceaniaAuNzClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowOceaniaAuNzClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Sydney Opera House harbour',
    'Blue Mountains Australia scenic valley',
    'Christchurch Cathedral square',
    'Mount Cook New Zealand alpine peak',
    'Lake Pukaki Mount Cook view',
    'Hagley Park Christchurch',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function pickSoutheastAsiaResortClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isSoutheastAsiaResortClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (isLaosOnlyClusterRoute(routeText) && isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return ''
    if (!allowSoutheastAsiaResortClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowSoutheastAsiaResortClusterKw2Duplicate(kw, routeText)) {
      if (/(?:발리|Bali)/i.test(String(routeText ?? '')) && /bali|beach club|uluwatu|rice terrace|padang|melasti/.test(nk)) {
        return ''
      }
      return kw
    }
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Phu Quoc Sao Beach Vietnam',
    'Phu Quoc Hon Thom Cable Car',
    'Po Nagar Cham Towers Nha Trang',
    'Long Son Pagoda Nha Trang',
    'Angkor Wat Cambodia temple sunrise',
    'Bayon temple Angkor Cambodia stone faces',
    'Ta Prohm temple Angkor Cambodia jungle roots',
    'Tonle Sap lake floating village Cambodia',
    'Halong Bay Vietnam limestone karst',
    'Maldives house reef snorkeling turquoise water',
    'Maldives white sand beach palm trees aerial',
    'Hoi An Ancient Town lantern street',
    'Maldives Overwater Villa Turquoise Lagoon',
    'Maldives beach resort aerial turquoise water',
    'Vang Vieng Nam Song River Karst Mountains',
    'Pha That Luang Vientiane golden stupa',
    'Patuxai Victory Monument Vientiane',
    'Blue Lagoon Vang Vieng emerald water',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isHawaiiResortClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:하와이|Hawaii|호놀룰루|Honolulu|오아후|Oahu|Waikiki|마우이|Maui)/i.test(String(routeText ?? ''))
}

function allowHawaiiResortClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isHawaiiResortClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /honolulu|waikiki|diamond|pearl|harbor|hanauma|oahu|north shore|polynesian|hawaii|maui|kauai/.test(nk)
}

function pickHawaiiResortClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isHawaiiResortClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowHawaiiResortClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowHawaiiResortClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Diamond Head Honolulu crater view',
    'Pearl Harbor USS Arizona Memorial Hawaii',
    'Hanauma Bay Oahu snorkeling',
    'North Shore Oahu surf beach',
    'Polynesian Cultural Center Oahu Hawaii',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isUaeResortClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:두바이|Dubai|아부다비|Abu\s*Dhabi|UAE|에미리트|Emirates)/i.test(String(routeText ?? ''))
}

function allowUaeResortClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isUaeResortClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /dubai|burj|khalifa|mosque|zayed|louvre|abudhabi|abu dhabi|desert|safari|palm|jumeirah|fahidi|frame|marina|emirates|yas|ferrari/.test(
    nk,
  )
}

function pickUaeResortClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isUaeResortClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowUaeResortClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowUaeResortClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Burj Khalifa Dubai skyline',
    'Sheikh Zayed Grand Mosque Abu Dhabi',
    'Louvre Abu Dhabi Saadiyat Island',
    'Dubai desert safari dunes sunset',
    'Palm Jumeirah Dubai aerial',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isHongKongHubClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:홍콩|Hong\s*Kong|香港)/i.test(String(routeText ?? ''))
}

function allowHongKongHubClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isHongKongHubClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /hong kong|victoria|peak|harbour|harbor|avenue|stars|soho|hollywood|blue house|dim sum|kowloon|tsim/.test(
    nk,
  )
}

function pickHongKongHubClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isHongKongHubClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowHongKongHubClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowHongKongHubClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Victoria Peak Hong Kong skyline',
    'Avenue of Stars Hong Kong',
    'SoHo Hong Kong',
    'Hollywood Road Hong Kong',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isGuamResortClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:괌|Guam|투몬|Tumon|아푸간|Apugan|이파오|Ipan)/i.test(String(routeText ?? ''))
}

function allowGuamResortClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isGuamResortClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /guam|tumon|apugan|fort|spana|plaza|ipan|beach|micronesia|outlet|two lovers|fish eye/.test(nk)
}

function pickGuamResortClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isGuamResortClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowGuamResortClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowGuamResortClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Fort Apugan Guam hilltop view',
    'Tumon Bay Guam beach',
    'Plaza de Espana Guam Spanish steps',
    'Guam Tumon beach',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isCentralAsiaClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:알마티|Almaty|카자흐|Kazakhstan|침블락|Charyn|콜사이|Kolsai|타슈켄트|Tashkent|사마르칸트|Samarkand|우즈베|Uzbekistan|아프로시압|Afrosiyab|레기스탄|Registan|침볼락|Chimbulak|Shymbulak|젠코바|Zenkov)/i.test(
    String(routeText ?? ''),
  )
}

function allowCentralAsiaClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isCentralAsiaClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /almaty|charyn|canyon|kolsai|kazakhstan|tashkent|samarkand|registan|kok tobe|panfilov|cathedral|afrosiyab|ulug|gur|shah|zinda|bibi|chimbulak|shymbulak|zenkov|uzbekistan/.test(
    nk,
  )
}

function pickCentralAsiaClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isCentralAsiaClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowCentralAsiaClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowCentralAsiaClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Charyn Canyon Kazakhstan red rock valley',
    'Kolsai Lakes Kazakhstan mountain lake',
    'Almaty Kazakhstan mountains city view',
    'Registan Square Samarkand Uzbekistan',
    'Afrosiyab ancient ruins Samarkand Uzbekistan',
    'Ulugh Beg Observatory Samarkand Uzbekistan',
    'Shymbulak ski resort Almaty Kazakhstan',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isSwissAlpsClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:스위스|Switzerland|인터라켄|Interlaken|융프라우|Jungfrau|체르마트|Zermatt|마테호른|Matterhorn|루체른|Lucerne|취리히|Zurich|베른|Bern|몽트뢰|Montreux|리기|Rigi|로이커바트|Leukerbad|시옹성|Chillon|하이델베르크|Heidelberg)/i.test(
    String(routeText ?? ''),
  )
}

function allowSwissAlpsClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isSwissAlpsClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /swiss|switzerland|interlaken|jungfrau|zermatt|matterhorn|lucerne|chapel|lion|rigi|zurich|bern|montreux|chillon|heidelberg|alps|sphinx observatory/.test(
    nk,
  )
}

function pickSwissAlpsClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isSwissAlpsClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowSwissAlpsClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowSwissAlpsClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Jungfraujoch Swiss Alps',
    'Matterhorn Zermatt Switzerland peak view',
    'Chapel Bridge Lucerne Switzerland',
    'Interlaken Swiss Alps twin lakes view',
    'Mount Rigi Switzerland cogwheel railway view',
    'Chillon Castle Lake Geneva Switzerland',
    'Bern Switzerland Zytglogge clock tower',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function pickTripSpotGapFillFallback(
  tripSpots: readonly string[],
  usedPrimary: ReadonlySet<string>,
  excludeNk = '',
): string {
  for (const kw of tripSpots) {
    const t = String(kw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t) || isBareCityOrCountryKeyword(t)) continue
    const nk = normScheduleImageKeywordKey(t)
    if (!nk || nk === excludeNk) continue
    if (!excludeNk && usedPrimary.has(nk)) continue
    return t
  }
  return ''
}

function isJapanHubClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:도쿄|Tokyo|시즈오카|Shizuoka|하코네|Hakone|오사카|Osaka|교토|Kyoto|나리타|Narita|후지|Fuji|요나고|Yonago|돗토리|Tottori|이즈모|Izumo|마쯔에|Matsue|다마즈|Tamatsukuri|나고야|Nagoya|타카야마|Takayama|시라카와|Shirakawa|가미코치|Kamikochi|이누야마|Inuyama|아쓰타|Atsuta|후쿠오카|Fukuoka|벳푸|Beppu|유후인|Yufuin|아소|Aso|규슈|Kyushu|오이타|Oita|야나가와|Yanagawa|일본|Japan)/i.test(
    String(routeText ?? ''),
  )
}

function allowJapanHubClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isJapanHubClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /tokyo|shizuoka|hakone|fuji|osaka|kyoto|narita|shibuya|harajuku|ritsurin|naoshima|chichu|benesse|takamatsu|mount fuji|hot spring|daisen|yonago|tottori|sand|izumo|matsue|tamatsukuri|shrine|castle|onsen|nagoya|inuyama|atsuta|shirakawa|takayama|kamikochi|gassho|fukuoka|beppu|yufuin|aso|dazaifu|yuushien|yanagawa/.test(
    nk,
  )
}

function pickJapanHubClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isJapanHubClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowJapanHubClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowJapanHubClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Mount Fuji Shizuoka view',
    'Hakone hot spring Mount Fuji view',
    'Tokyo street night',
    'Ritsurin Garden Takamatsu Japan',
    'Naoshima art island Japan yellow pumpkin',
    'Tottori Sand Dunes',
    'Izumo Taisha shrine Japan',
    'Matsue Castle Japan',
    'Nagoya Castle Japan',
    'Inuyama Castle Japan',
    'Atsuta Shrine Nagoya Japan',
    'Shirakawa-go gassho farmhouses Japan',
    'Takayama old town Japan',
    'Dazaifu Tenmangu shrine Fukuoka',
    'Beppu hot springs steam Japan',
    'Mount Aso volcano caldera Japan',
    'Fukuoka city night',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isChinaHubClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:베이징|北京|Beijing|북경|천안문|Tiananmen|만리장성|Great\s*Wall|이화원|Summer\s*Palace|자금성|Forbidden|연길|Yanji|延吉|백두산|Changbai|장백|长白山|선양|Shenyang|중국|China|금강|Geumgang|장백폭포)/i.test(
    String(routeText ?? ''),
  )
}

function allowChinaHubClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isChinaHubClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /beijing|forbidden|tiananmen|great wall|summer palace|jingshan|temple|palace|798|wangfujing|hutong|changbai|yanji|baekdu|mount geumgang|geumgang|shenyang|changchun/.test(
    nk,
  )
}

function pickChinaHubClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isChinaHubClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowChinaHubClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowChinaHubClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Jingshan Park Beijing Forbidden City view',
    'Summer Palace Beijing',
    'Great Wall of China',
    'Tiananmen Square',
    'Forbidden City Beijing',
    'Changbai Mountain scenic view',
    'Mount Geumgang scenic North Korea border view',
    'Yanji Korean Quarter Winter',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function allowSafariClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (
    !/(?:응고롱고로|Ngorongoro|세렝게티|Serengeti|케이프타운|Cape\s*Town|CAPETOWN|Victoria\s*Falls|빅토리아\s*폭포|Livingstone|리빙스턴)/i.test(
      String(routeText ?? ''),
    )
  ) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /ngorongoro|serengeti|manyara|victoria|cape|table|robben|waterfront|livingstone|naivasha|arusha/.test(nk)
}

function allowProvenceClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!/(?:프로방스|Provence|라벤더|Lavender|엑스\s*프로방스|Aix-en-Provence|아비뇽|Avignon|루(?:베|르)(?:봉|손)|Roussillon|세네끄|Senanque|오랑주|Orange)/i.test(String(routeText ?? ''))) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /provence|lavender|valensole|aix|avignon|roussillon|senanque|orange|mirabeau|pont/.test(nk)
}

function allowSouthAmericaClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (
    !/(?:마추|Machu|쿠스코|Cusco|우유니|Uyuni|라\s*파스|La\s*Paz|라파즈|이과수|Iguazu|멕시코|Mexico|Chapultepec|Xochimilco|Valle\s*de\s*la\s*Luna|코파카바나|Copacabana|리우|Rio\s*de\s*Janeiro)/i.test(
      String(routeText ?? ''),
    )
  ) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /machu|cusco|maras|moray|ollant|uyuni|lapaz|valle|iguazu|rio|copacabana|selaron|mexico|chapultepec|xochimilco|zocalo|teotihuacan|salar|aguas|sacsay|coricancha|corcovado|christ|sugar|tolantongo|guadalupe/.test(nk)
}

function allowManadoClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!/(?:마나도|Manado|토모혼|Tomohon|부나켄|Bunaken|실라덴|Siladen|술라웨시|Sulawesi)/i.test(String(routeText ?? ''))) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /manado|tomohon|bunaken|siladen|sulawesi|blessing|jesus|mahawu|market/.test(nk)
}

function isEasternEuropeClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:프라하|Prague|체코|Czech|부다페스트|Budapest|헝가리|Hungary|비엔나|Vienna|Wien|Hallstatt|할슈타트|크룸로프|Krumlov|두브로브니크|Dubrovnik|플리트비체|Plitvice|자그레브|Zagreb|크로아티아|Croatia|슬로베니아|Slovenia|브라티슬라바|Bratislava|폴란드|Poland|Krakow|크라쿠프|리투|Lithuania|라트|Latvia|에스토|Estonia|빌니우스|Vilnius|리가|Riga|탈린|Tallinn|트라카이|Trakai|룬달레|Rundale|발트|Baltic|마드리드|Madrid|바르셀로나|Barcelona|톨레도|Toledo|세고비아|Segovia|스페인|Spain|포르투|Porto|리스본|Lisbon|파티마|Fatima|포르투갈|Portugal|이탈|Italy|로마|Rome|피렌|Florence|베니스|Venice|밀라노|Milan|콜로세|Colosseum|파리|Paris|스위스|Swiss|루체른|Lucerne|융프라|Jungfrau|노르웨|Norway|오슬로|Oslo|게이랑|Geiranger|플롬|Flam|베르겐|Bergen|스웨덴|Sweden|핀란|Finland|덴마크|Denmark|이스탄불|Istanbul|카파도키아|Cappadocia|튀르키|Turkey|파묵|Pamukkale|인도|India|자이푸르|Jaipur|아그라|Agra|뉴델리|Delhi|타지|Taj|쿠트브|Qutub)/i.test(
    String(routeText ?? ''),
  )
}

function allowEasternEuropeClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isEasternEuropeClusterRoute(routeText)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /prague|castle|charles|budapest|parliament|fisher|buda|vienna|schonbrunn|hallstatt|krumlov|dubrovnik|plitvice|zagreb|split|diocletian|wawel|krakow|bratislava|ljubljana|golden|swarovski|heroes|innsbruck|salzburg|mirabell|mozart|zadar|donatus|rector|bridge|barber|vilnius|trakai|rundale|riga|tallinn|baltic|lahemaa|alexander nevsky|toompea|madrid|barcelona|toledo|segovia|gran via|plaza mayor|fatima|lisbon|porto|portugal|spain|rome|florence|venice|milan|colosseum|paris|lucerne|jungfrau|oslo|geiranger|flam|bergen|norway|sweden|finland|denmark|istanbul|cappadocia|pamukkale|turkey|hagia|three brothers|art nouveau|blackheads|taj mahal|hawa mahal|amber fort|qutub|jaipur|agra|delhi|india gate|gurudwara/.test(
    nk,
  )
}

function isSoutheastAsiaResortClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:푸꾸옥|Phu\s*Quoc|푸꾹옥|나트랑|Nha\s*Trang|푸켓|Phuket|코\s*타\s*키나발루|Kota\s*Kinabalu|세부|Cebu|보라카이|Boracay|발리|Bali|다\s*낭|Da\s*Nang|호이\s*안|Hoi\s*An|하롱|Halong|하노이|Hanoi|캄보디아|Cambodia|앙코르|Angkor|씨엠립|시엠립|Siem\s*Reap|라오스|Laos|비엔티엔|Vientiane|방비엥|Vang\s*Vieng|치앙\s*마이|Chiang\s*Mai|푸꾸켓|몰디브|Maldives|overwater|싱가포르)/i.test(
    String(routeText ?? ''),
  )
}

function allowSoutheastAsiaResortClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isSoutheastAsiaResortClusterRoute(routeText)) return false
  if (isLaosOnlyClusterRoute(routeText) && isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /phuquoc|phu quoc|sao beach|hon thom|cable|nhatrang|po nagar|long son|phuket|patong|kota kinabalu|cebu|boracay|bali|uluwatu|tegalalang|danang|hoian|halong|angkor|bayon|prohm|baphuon|tonle|siem reap|elephant terrace|luang|chiang|sontra|marble|my khe|vientiane|vang vieng|laos|nam song|karst|pha that|patuxai|blue lagoon|maldives|overwater|lagoon|villa|house reef|white sand/.test(
    nk,
  )
}

function allowSteppeAlaskaClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (
    !/(?:오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|Genghis|내몽골|Inner Mongolia|Seattle|시애틀|Alaska|알aska|알래스카|Juneau|Skagway|Glacier|Pike Place|Space Needle|크루즈|cruise)/i.test(
      String(routeText ?? ''),
    )
  ) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /ordos|genghis|xiangshawan|desert|grassland|steppe|seattle|pike|space needle|gas works|alaska|glacier|juneau|skagway|cruise/.test(
    nk,
  )
}

function isSteppeAlaskaClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|Genghis|내몽골|Inner Mongolia|Seattle|시애틀|Alaska|알aska|알래스카|Juneau|Skagway|Glacier|Pike Place|Space Needle|크루즈|cruise)/i.test(
    String(routeText ?? ''),
  )
}

function pickSteppeAlaskaClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!isSteppeAlaskaClusterRoute(routeText)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowSteppeAlaskaClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    if (allowSteppeAlaskaClusterKw2Duplicate(kw, routeText)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  for (const raw of [
    'Glacier Bay Alaska cruise',
    'Pike Place Market Seattle',
    'Space Needle Seattle',
    'Gas Works Park Seattle',
  ]) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function allowKw2TripDuplicateKeyword(kw: string, routeText?: string | null): boolean {
  if (allowSafariClusterKw2Duplicate(kw, routeText)) return true
  if (allowProvenceClusterKw2Duplicate(kw, routeText)) return true
  if (allowSouthAmericaClusterKw2Duplicate(kw, routeText)) return true
  if (allowManadoClusterKw2Duplicate(kw, routeText)) return true
  if (allowEasternEuropeClusterKw2Duplicate(kw, routeText)) return true
  if (allowSoutheastAsiaResortClusterKw2Duplicate(kw, routeText)) return true
  if (allowSteppeAlaskaClusterKw2Duplicate(kw, routeText)) return true
  if (allowHawaiiResortClusterKw2Duplicate(kw, routeText)) return true
  if (allowUaeResortClusterKw2Duplicate(kw, routeText)) return true
  if (allowHongKongHubClusterKw2Duplicate(kw, routeText)) return true
  if (allowGuamResortClusterKw2Duplicate(kw, routeText)) return true
  if (allowCentralAsiaClusterKw2Duplicate(kw, routeText)) return true
  if (allowSwissAlpsClusterKw2Duplicate(kw, routeText)) return true
  if (allowJapanHubClusterKw2Duplicate(kw, routeText)) return true
  if (allowChinaHubClusterKw2Duplicate(kw, routeText)) return true
  if (allowCanadaRockiesClusterKw2Duplicate(kw, routeText)) return true
  if (allowLaosClusterKw2Duplicate(kw, routeText)) return true
  if (allowTaiwanClusterKw2Duplicate(kw, routeText)) return true
  if (allowOceaniaAuNzClusterKw2Duplicate(kw, routeText)) return true
  if (allowChinaHubClusterKw2Duplicate(kw, routeText)) return true
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!/산토리니|Santorini/i.test(String(routeText ?? ''))) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /santorini|oia|fira|imerovigli|firostefani|amoudi|akrotiri|caldera/.test(nk)
}

function isSafariClusterRoute(routeText: string | null | undefined): boolean {
  return /(?:응고롱고로|Ngorongoro|세렝게티|Serengeti|케이프타운|Cape\s*Town|CAPETOWN|Victoria\s*Falls|빅토리아\s*폭포|마니아라|Manyara|Arusha|Livingstone|리빙스턴)/i.test(
    String(routeText ?? ''),
  )
}

function pickSafariClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
): string {
  if (!isSafariClusterRoute(routeText)) return ''
  for (const raw of cands) {
    const kw = String(raw ?? '').trim()
    if (!kw || isRejectedTripKeywordCandidate(kw)) continue
    if (!allowSafariClusterKw2Duplicate(kw, routeText)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || !used.has(nk)) continue
    return kw
  }
  return ''
}

function pickManadoClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
): string {
  if (!/(?:마나도|Manado|토모혼|Tomohon|부나켄|Bunaken|실라덴|Siladen)/i.test(String(routeText ?? ''))) {
    return ''
  }
  for (const raw of cands) {
    const kw = String(raw ?? '').trim()
    if (!kw || isRejectedTripKeywordCandidate(kw)) continue
    if (!allowManadoClusterKw2Duplicate(kw, routeText)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || scheduleKeywordNkOverlaps(nk, excludePrimaryNk)) continue
    if (!used.has(nk)) continue
    return kw
  }
  return ''
}

function isSantoriniClusterRoute(routeText: string | null | undefined, rowHay?: string): boolean {
  const hay = `${String(routeText ?? '')} ${String(rowHay ?? '')}`
  return /산토리니|Santorini/i.test(hay)
}

function pickSantoriniClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
): string {
  if (!isSantoriniClusterRoute(routeText)) return ''
  for (const raw of cands) {
    const kw = String(raw ?? '').trim()
    if (!kw || isRejectedTripKeywordCandidate(kw)) continue
    if (!allowKw2TripDuplicateKeyword(kw, routeText)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || !used.has(nk)) continue
    return kw
  }
  return ''
}

function pickRouteOrderSecondKeyword(
  cands: readonly string[],
  primary: string,
  used?: ReadonlySet<string>,
  allowRouteDuplicateFallback = false,
  allowBareCity = false,
  routeText?: string | null,
): string {
  const pk = normScheduleImageKeywordKey(primary)
  if (!pk || !cands.length) return ''
  const usable = (kw: string, allowTripDuplicate: boolean): boolean => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return false
    if (isBareCityOrCountryKeyword(kw) && !allowBareCity) return false
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || nk === pk) return false
    if (used?.has(nk) && !allowTripDuplicate) return false
    return true
  }

  const primaryIdx = cands.findIndex((c) => normScheduleImageKeywordKey(c) === pk)
  if (primaryIdx > 0) {
    const lead = String(cands[0] ?? '').trim()
    if (usable(lead, false)) return lead
  }
  for (const raw of cands) {
    const kw = String(raw ?? '').trim()
    if (usable(kw, false)) return kw
  }
  if (!allowRouteDuplicateFallback) return ''
  if (primaryIdx > 0) {
    const lead = String(cands[0] ?? '').trim()
    if (usable(lead, true) && allowKw2TripDuplicateKeyword(lead, routeText)) return lead
  }
  for (const raw of cands) {
    const kw = String(raw ?? '').trim()
    if (usable(kw, true) && allowKw2TripDuplicateKeyword(kw, routeText)) return kw
  }
  return ''
}

function routeTextDedupeKey(routeText: string | null | undefined): string {
  return String(routeText ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** 2+ route 세그먼트일 당일 이동순 2번째 후보 — trip used·bare city 차단 예외(kw2) */
function isAllowableRouteOrderSecondKeyword2(
  kw: string,
  row: RegisterScheduleTripKeywordRow,
  primary: string,
  used: ReadonlySet<string>,
): boolean {
  if (routeTextTourismSegmentCount(row.routeText) < 2) return false
  const nk = normScheduleImageKeywordKey(kw)
  const pk = normScheduleImageKeywordKey(primary)
  if (!nk || !pk || nk === pk) return false
  const fromRoute = pickSecondSegmentKeywordFromRouteText(row.routeText, primary, new Set())
  if (!fromRoute || normScheduleImageKeywordKey(fromRoute) !== nk) return false
  if (!used.has(nk)) return true
  return !isLikelyTourismLandmarkKeyword(kw)
}

function lodgingClusterRouteContext(routeText: string | null | undefined): string {
  return `${String(routeText ?? '')} Manado Tomohon Bunaken Siladen Sulawesi Rio Corcovado Copacabana Mexico Tolantongo`
}

function allowClusterKw2ReuseDespiteUsed(kw: string, routeText?: string | null): boolean {
  if (allowResortClusterCrossSlotReuse(kw, routeText)) return true
  if (allowEasternEuropeClusterKw2Duplicate(kw, routeText)) return true
  if (allowSouthAmericaClusterKw2Duplicate(kw, routeText)) return true
  if (allowSafariClusterKw2Duplicate(kw, routeText)) return true
  if (allowProvenceClusterKw2Duplicate(kw, routeText)) return true
  if (allowSteppeAlaskaClusterKw2Duplicate(kw, routeText)) return true
  if (allowJapanHubClusterKw2Duplicate(kw, routeText)) return true
  if (allowChinaHubClusterKw2Duplicate(kw, routeText)) return true
  if (allowCanadaRockiesClusterKw2Duplicate(kw, routeText)) return true
  if (allowLaosClusterKw2Duplicate(kw, routeText)) return true
  if (allowTaiwanClusterKw2Duplicate(kw, routeText)) return true
  if (allowOceaniaAuNzClusterKw2Duplicate(kw, routeText)) return true
  if (allowSoutheastAsiaResortClusterKw2Duplicate(kw, routeText)) {
    const nk = normScheduleImageKeywordKey(kw)
    const hay = String(routeText ?? '')
    if (/bali|uluwatu|tegalalang|beach club|rice terrace|padang padang|melasti beach/.test(nk)) {
      return false
    }
    if (isLaosOnlyClusterRoute(hay) && isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return false
    if (/maldives|overwater|house reef|white sand/.test(nk)) return true
    if (!/(?:발리|Bali)/i.test(hay)) {
      if (/phuquoc|phu quoc|hon thom|sao beach|grand world|sunset|kiss bridge|cable|vientiane|vang vieng|angkor|halong|laos|pha that|patuxai|nam song/.test(nk)) {
        return true
      }
    }
    return false
  }
  return false
}

function shouldRejectMiddleDayKeyword2(
  secondary: string,
  row: RegisterScheduleTripKeywordRow,
  primary: string,
  used: ReadonlySet<string>,
): boolean {
  if (isAllowableRouteOrderSecondKeyword2(secondary, row, primary, used)) return false
  const routeCtx = isLodgingOnlyTourismRoute(row.routeText)
    ? lodgingClusterRouteContext(row.routeText)
    : String(row.routeText ?? '')
  if (allowKw2TripDuplicateKeyword(secondary, routeCtx)) {
    const nk2 = normScheduleImageKeywordKey(secondary)
    if (nk2 && used.has(nk2) && !allowClusterKw2ReuseDespiteUsed(secondary, routeCtx)) return true
    return false
  }
  const nk2 = normScheduleImageKeywordKey(secondary)
  const pk = normScheduleImageKeywordKey(primary)
  if (isBareCityOrCountryKeyword(secondary)) return true
  if (nk2 === pk) return true
  if (isLodgingOnlyTourismRoute(row.routeText)) {
    if (
      nk2 &&
      pk &&
      isLikelyTourismLandmarkKeyword(secondary) &&
      !isDomesticHubOrAirportImageKeyword(secondary)
    ) {
      return false
    }
  }
  if (used.has(nk2)) return true
  return false
}

function fillMiddleDayKeyword2InDedupe(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
  cands: readonly string[],
  used: ReadonlySet<string>,
  multiSegRoute: boolean,
): string {
  const sameDayOnly = new Set<string>()
  let secondary =
    pickUnusedRouteLandmarkFromRowHaystack(row, primary, used) ||
    pickSecondSegmentKeywordFromRouteText(row.routeText, primary, sameDayOnly) ||
    pickSameDayRouteLandmarkKeyword2(row, primary) ||
    pickSecondDistinctRouteLandmarkKeyword2(row, primary) ||
    pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText)
  if (secondary && shouldRejectMiddleDayKeyword2(secondary, row, primary, used)) {
    const routeOnly = pickSecondSegmentKeywordFromRouteText(row.routeText, primary, new Set())
    secondary =
      routeOnly && !shouldRejectMiddleDayKeyword2(routeOnly, row, primary, used) ? routeOnly : ''
  }
  void multiSegRoute
  return secondary
}

/** 이미 쓴 키워드는 당일 route·본문 후보만으로 교체 — 타 일차 landmark 금지, 없으면 빈 슬롯 */
export function enforceRegisterScheduleTripUniqueImageKeywords<T extends RegisterScheduleTripKeywordRow>(
  rows: T[],
): T[] {
  const used = new Set<string>()
  const usedPrimary = new Set<string>()
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const activeDays = sorted.filter((r) => Number(r.day) > 0).length
  const maxDay = activeDays ? Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0)) : 0
  const tripHay = sorted
    .map(
      (r) =>
        `${String(r.routeText ?? '')} ${String(r.title ?? '')} ${String(r.description ?? '')}`,
    )
    .join('\n')
  const processedByDay = new Map<number, { primary: string; secondary: string }>()
  return sorted.map((row) => {
    const day = Number(row.day)
    const slot = day > 0 ? resolveScheduleKeywordSlotKind(day, maxDay, activeDays) : 'middle'
    const isMiddleDay = slot === 'middle'
    const hubOnlyDay = isScheduleHubMovementKeywordRow(row, day, maxDay)
    const cands = collectTripKeywordCandidates(row)
    const multiSegRoute = routeTextTourismSegmentCount(row.routeText) >= 2
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()
    if (primary && isRejectedTripKeywordCandidate(primary)) primary = ''
    if (secondary && isRejectedTripKeywordCandidate(secondary)) secondary = ''

    if (slot === 'departure' && isAirlineOnlyMovementRouteText(row.routeText)) {
      return { ...row, imageKeyword: '', imageKeyword2: null }
    }

    if (hubOnlyDay) {
      return { ...row, imageKeyword: '', imageKeyword2: null }
    }

    if (isMiddleDay && !primary && secondary) {
      primary = secondary
      secondary = ''
    }

    if (primary && used.has(normScheduleImageKeywordKey(primary))) {
      const pk = normScheduleImageKeywordKey(primary)
      const replacement = pickUnusedTripKeyword(cands, used)
      if (replacement) {
        primary = replacement
      } else {
        const routeOwned = pickUnusedRoutePrimaryLandmark(row, used)
        primary =
          routeOwned && normScheduleImageKeywordKey(routeOwned) !== pk
            ? routeOwned
            : pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
              pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
              pickManadoClusterKeywordForUsedSlot(cands, used, row.routeText) ||
              ''
      }
    }
    if (!primary) {
      const landmarkCands = cands.filter((c) => !isBareCityOrCountryKeyword(c))
      primary =
        pickRouteOwnedPrimaryLandmark(row, usedPrimary) ||
        pickUnusedTripKeyword(landmarkCands.length ? landmarkCands : cands, used) ||
        pickUnusedRoutePrimaryLandmark(row, used) ||
        pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        pickManadoClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        ''
    }

    if (secondary && shouldRejectRouteLeakKeyword2(secondary, row.routeText, tripHay)) {
      secondary = ''
    }

    if (secondary) {
      const nk2 = normScheduleImageKeywordKey(secondary)
      const routeCityKw2 =
        !isLikelyTourismLandmarkKeyword(secondary) && routeTextTourismSegmentCount(row.routeText) >= 2
      if (
        !routeCityKw2 &&
        (used.has(nk2) || nk2 === normScheduleImageKeywordKey(primary))
      ) {
        secondary =
          pickRouteOrderSecondKeyword(cands, primary, used, isMiddleDay, true, row.routeText) ||
          pickRouteOrderSecondKeyword(cands, primary, used, isMiddleDay, multiSegRoute, row.routeText) ||
          ''
      }
    }

    if (isMiddleDay && !primary) {
      primary =
        pickUnusedRouteLandmarkFromRowHaystack(row, '', used) ||
        pickUnusedRoutePrimaryLandmark(row, used) ||
        pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        (isLodgingOnlyTourismRoute(row.routeText)
          ? pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay)
          : '') ||
        primary
    }

    if (primary) {
      const pk = normScheduleImageKeywordKey(primary)
      if (used.has(pk)) {
        const landmarkCands = cands.filter((c) => !isBareCityOrCountryKeyword(c))
        primary =
          pickUnusedTripKeyword(landmarkCands.length ? landmarkCands : cands, used) ||
          pickUnusedRoutePrimaryLandmark(row, used) ||
          pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
          pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
          ''
      }
    }

    if (secondary && normScheduleImageKeywordKey(secondary) === normScheduleImageKeywordKey(primary)) {
      secondary = ''
    }

    if (isMiddleDay && primary && !secondary) {
      secondary = fillMiddleDayKeyword2InDedupe(row, primary, cands, used, multiSegRoute)
    }

    if (isMiddleDay && primary && !secondary && isSantoriniClusterRoute(row.routeText, `${row.title ?? ''} ${row.description ?? ''}`)) {
      secondary =
        pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
        pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        secondary
    }

    if (isMiddleDay && primary && !secondary && isSafariClusterRoute(row.routeText)) {
      secondary =
        pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
        pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        secondary
    }

    if (isMiddleDay && primary && !secondary && isSouthAmericaClusterRoute(row.routeText)) {
      secondary =
        pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
        pickSouthAmericaClusterKeywordForUsedSlot(
          cands,
          used,
          row.routeText,
          normScheduleImageKeywordKey(primary),
        ) ||
        secondary
    }

    if (
      isMiddleDay &&
      primary &&
      !secondary &&
      isBareCityOrCountryKeyword(primary) &&
      isSouthAmericaClusterRoute(row.routeText)
    ) {
      for (const raw of cands) {
        const kw = String(raw ?? '').trim()
        if (!kw || isRejectedTripKeywordCandidate(kw)) continue
        if (isBareCityOrCountryKeyword(kw)) continue
        const nk = normScheduleImageKeywordKey(kw)
        const pk = normScheduleImageKeywordKey(primary)
        if (!nk || nk === pk || used.has(nk)) continue
        if (!shouldRejectMiddleDayKeyword2(kw, row, primary, used)) {
          secondary = kw
          break
        }
      }
    }

    if (isMiddleDay && isLodgingOnlyTourismRoute(row.routeText) && !primary) {
      primary = pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay) || primary
    }

    if (isMiddleDay && isLodgingOnlyTourismRoute(row.routeText) && primary && !secondary) {
      secondary =
        pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
        pickPriorTourismLandmarkForLodgingDay(
          row,
          sorted,
          used,
          processedByDay,
          true,
          normScheduleImageKeywordKey(primary),
        ) ||
        pickManadoClusterKeywordForUsedSlot(
          cands,
          used,
          row.routeText,
          normScheduleImageKeywordKey(primary),
        ) ||
        pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        secondary
    }

    if (
      isMiddleDay &&
      !primary &&
      /(?:마나도|Manado|축복.*예수|Blessing.*Jesus)/i.test(String(row.routeText ?? ''))
    ) {
      primary =
        pickRouteOwnedPrimaryLandmark(row, usedPrimary) ||
        pickUnusedRoutePrimaryLandmark(row, used) ||
        pickManadoClusterKeywordForUsedSlot(cands, used, row.routeText) ||
        pickUnusedRouteLandmarkFromRowHaystack(row, '', used) ||
        primary
    }

    if (isMiddleDay && !primary && secondary) {
      primary = secondary
      secondary = ''
    }

    if (isMiddleDay && primary && !secondary) {
      secondary = fillMiddleDayKeyword2InDedupe(row, primary, cands, used, multiSegRoute)
      if (!secondary && isSantoriniClusterRoute(row.routeText, `${row.title ?? ''} ${row.description ?? ''}`)) {
        secondary =
          pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
          pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
          secondary
      }
      if (!secondary && isSafariClusterRoute(row.routeText)) {
        secondary =
          pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
          pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
          secondary
      }
      if (
        !secondary &&
        /(?:마나도|Manado|토모혼|Tomohon|부나켄|Bunaken)/i.test(String(row.routeText ?? ''))
      ) {
        secondary =
          pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
          pickManadoClusterKeywordForUsedSlot(
            cands,
            used,
            row.routeText,
            normScheduleImageKeywordKey(primary),
          ) ||
          secondary
      }
      if (!secondary && isSouthAmericaClusterRoute(row.routeText)) {
        secondary =
          pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText) ||
          pickSouthAmericaClusterKeywordForUsedSlot(
            cands,
            used,
            row.routeText,
            normScheduleImageKeywordKey(primary),
          ) ||
          secondary
      }
      if (!secondary && isEasternEuropeClusterRoute(tripHay)) {
        secondary =
          pickEasternEuropeClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isLaosOnlyClusterRoute(tripHay)) {
        secondary =
          pickLaosClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isTaiwanClusterRoute(tripHay)) {
        secondary =
          pickTaiwanClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isOceaniaAuNzClusterRoute(tripHay)) {
        secondary =
          pickOceaniaAuNzClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isJapanHubClusterRoute(tripHay)) {
        secondary =
          pickJapanHubClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isChinaHubClusterRoute(tripHay)) {
        secondary =
          pickChinaHubClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isSoutheastAsiaResortClusterRoute(tripHay)) {
        secondary =
          pickSoutheastAsiaResortClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isHawaiiResortClusterRoute(tripHay)) {
        secondary =
          pickHawaiiResortClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isUaeResortClusterRoute(tripHay)) {
        secondary =
          pickUaeResortClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isHongKongHubClusterRoute(tripHay)) {
        secondary =
          pickHongKongHubClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
      if (!secondary && isGuamResortClusterRoute(tripHay)) {
        secondary =
          pickGuamResortClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
          ) || secondary
      }
    }

    if (isMiddleDay && primary && !secondary && activeDays >= 4) {
      const pk = normScheduleImageKeywordKey(primary)
      secondary =
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false, pk) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false, pk) ||
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickChinaHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        secondary
    }

    if (secondary && shouldRejectMiddleDayKeyword2(secondary, row, primary, used)) {
      secondary = ''
    }
    if (secondary && shouldRejectRouteLeakKeyword2(secondary, row.routeText, tripHay)) {
      secondary = ''
    }

    if (primary) used.add(normScheduleImageKeywordKey(primary))
    if (primary) usedPrimary.add(normScheduleImageKeywordKey(primary))
    if (secondary) used.add(normScheduleImageKeywordKey(secondary))

    processedByDay.set(day, { primary, secondary })

    return { ...row, imageKeyword: primary, imageKeyword2: secondary || null }
  })
}

/** 4일+ 중간일 kw/kw2 빈 슬롯 — trip route evidence 범위 내에서 최종 보충 (apply 후처리) */
function rowEvidenceHaystack(row: RegisterScheduleTripKeywordRow): string {
  return [row.routeText, row.title, row.description]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

function collectOrderedLandmarkKeywordsFromHaystack(haystack: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const hit of findAllScheduleSpotMatchesInText(haystack)) {
    let kw = String(hit.en ?? '').trim()
    if (!kw) continue
    try {
      kw = finalizeScheduleImageKeyword(kw)
    } catch {
      /* keep raw */
    }
    if (!kw || isRejectedTripKeywordCandidate(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || seen.has(nk)) continue
    seen.add(nk)
    out.push(kw)
  }
  return out
}

function collectDayOrderedLandmarkKeywords(row: RegisterScheduleTripKeywordRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const kw = String(raw ?? '').trim()
    if (!kw || isRejectedTripKeywordCandidate(kw)) return
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || seen.has(nk)) return
    seen.add(nk)
    out.push(kw)
  }
  for (const kw of [
    ...collectRouteTextOrderedLandmarkKeywords(row.routeText),
    ...collectRouteTextSpotScanLandmarkKeywords(row.routeText),
    ...collectOrderedLandmarkKeywordsFromHaystack(rowEvidenceHaystack(row)),
  ]) {
    push(kw)
  }
  return out
}

function collectTripOrderedLandmarkKeywords(rows: readonly RegisterScheduleTripKeywordRow[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const kw of collectDayOrderedLandmarkKeywords(row)) {
      const nk = normScheduleImageKeywordKey(kw)
      if (!nk || seen.has(nk)) continue
      seen.add(nk)
      out.push(kw)
    }
  }
  return out
}

function keywordUsedAsTripPrimary(
  kw: string,
  processedByDay: ReadonlyMap<number, { primary: string; secondary: string }>,
): boolean {
  const nk = normScheduleImageKeywordKey(kw)
  if (!nk) return false
  for (const slot of processedByDay.values()) {
    if (normScheduleImageKeywordKey(slot.primary) === nk) return true
  }
  return false
}

function allowResortClusterCrossSlotReuse(kw: string, routeText?: string | null): boolean {
  return (
    allowGuamResortClusterKw2Duplicate(kw, routeText) ||
    allowHawaiiResortClusterKw2Duplicate(kw, routeText) ||
    allowUaeResortClusterKw2Duplicate(kw, routeText) ||
    allowHongKongHubClusterKw2Duplicate(kw, routeText) ||
    allowCentralAsiaClusterKw2Duplicate(kw, routeText) ||
    allowSwissAlpsClusterKw2Duplicate(kw, routeText) ||
    allowManadoClusterKw2Duplicate(kw, routeText) ||
    allowJapanHubClusterKw2Duplicate(kw, routeText) ||
    allowChinaHubClusterKw2Duplicate(kw, routeText) ||
    allowEasternEuropeClusterKw2Duplicate(kw, routeText) ||
    allowSouthAmericaClusterKw2Duplicate(kw, routeText) ||
    allowSafariClusterKw2Duplicate(kw, routeText) ||
    allowSteppeAlaskaClusterKw2Duplicate(kw, routeText) ||
    allowProvenceClusterKw2Duplicate(kw, routeText) ||
    allowLaosClusterKw2Duplicate(kw, routeText) ||
    allowTaiwanClusterKw2Duplicate(kw, routeText) ||
    allowOceaniaAuNzClusterKw2Duplicate(kw, routeText) ||
    allowCanadaRockiesClusterKw2Duplicate(kw, routeText)
  )
}

function shouldRejectRouteLeakKeyword2(
  secondary: string,
  routeText: string | null | undefined,
  tripHay?: string,
): boolean {
  const hay = `${String(routeText ?? '')} ${String(tripHay ?? '')}`
  if (isLaosOnlyClusterRoute(hay) && isSoutheastAsiaLeakKeywordForLaosRoute(secondary)) return true
  if (isOceaniaAuNzClusterRoute(hay) && /sugar loaf|rio de janeiro|brazil/.test(normScheduleImageKeywordKey(secondary))) {
    return true
  }
  return false
}

function pickGapFillKeyword<T extends RegisterScheduleTripKeywordRow>(
  ordered: readonly string[],
  excludeNk: string,
  row: T,
  acceptKw: (kw: string, row: T) => boolean,
  allowTripReuse: boolean,
  used: ReadonlySet<string>,
  preferLandmark = false,
  routeCtx?: string | null,
  processedByDay?: ReadonlyMap<number, { primary: string; secondary: string }>,
): string {
  const tryList = preferLandmark
    ? [
        ...ordered.filter((kw) => !isBareCityOrCountryKeyword(kw)),
        ...ordered.filter((kw) => isBareCityOrCountryKeyword(kw)),
      ]
    : ordered
  for (const kw of tryList) {
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || nk === excludeNk) continue
    if (!acceptKw(kw, row)) continue
    if (used.has(nk)) {
      if (!allowTripReuse) continue
      if (isBareCityOrCountryKeyword(kw)) continue
      if (
        processedByDay &&
        keywordUsedAsTripPrimary(kw, processedByDay) &&
        !allowResortClusterCrossSlotReuse(kw, routeCtx ?? row.routeText)
      ) {
        continue
      }
      if (!allowKw2TripDuplicateKeyword(kw, routeCtx ?? row.routeText)) continue
    }
    return kw
  }
  return ''
}

export function fillRegisterScheduleMiddleDayImageKeywordGaps<T extends RegisterScheduleTripKeywordRow>(
  rows: T[],
): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const activeDays = sorted.filter((r) => Number(r.day) > 0).length
  if (activeDays < 3) return rows
  const fillKw2 = activeDays >= 4
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0))
  const tripCtx = buildRegisterScheduleTripRouteKeywordContext(sorted)
  const tripSpots = collectTripOrderedLandmarkKeywords(sorted)
  const tripHay = sorted
    .map(
      (r) =>
        `${String(r.routeText ?? '')} ${String(r.title ?? '')} ${String(r.description ?? '')}`,
    )
    .join('\n')
  const processedByDay = new Map<number, { primary: string; secondary: string }>()
  const used = new Set<string>()
  const usedPrimary = new Set<string>()
  for (const row of sorted) {
    for (const kw of [row.imageKeyword, row.imageKeyword2]) {
      const nk = normScheduleImageKeywordKey(String(kw ?? '').trim())
      if (nk) used.add(nk)
    }
    const pk = normScheduleImageKeywordKey(String(row.imageKeyword ?? '').trim())
    if (pk) usedPrimary.add(pk)
    processedByDay.set(Number(row.day), {
      primary: String(row.imageKeyword ?? '').trim(),
      secondary: String(row.imageKeyword2 ?? '').trim(),
    })
  }

  const acceptKw = (kw: string, row: T): boolean => {
    const t = String(kw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t)) return false
    if (!registerScheduleKeywordPassesTripRouteTextSsot(t, tripCtx, row)) return false
    if (registerScheduleKeywordPassesRouteEvidence(t, row)) return true
    return registerScheduleKeywordPassesRouteEvidence(t, {
      ...row,
      routeText: tripHay,
      title: '',
      description: '',
    })
  }

  return sorted.map((row) => {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'middle') return row
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()
    if (primary && isRejectedTripKeywordCandidate(primary)) primary = ''
    if (secondary && isRejectedTripKeywordCandidate(secondary)) secondary = ''
    if (!primary && secondary) {
      primary = secondary
      secondary = ''
    }
    if (
      primary &&
      secondary &&
      normScheduleImageKeywordKey(primary) === normScheduleImageKeywordKey(secondary)
    ) {
      secondary = ''
    }
    const cands = collectTripKeywordCandidates(row)
    const daySpots = collectDayOrderedLandmarkKeywords(row)
    const multiSegRoute = routeTextTourismSegmentCount(row.routeText) >= 2

    if (!primary) {
      let candidate =
        pickRouteOwnedPrimaryLandmark(row, usedPrimary) ||
        pickGapFillKeyword(daySpots, '', row, acceptKw, false, used) ||
        pickGapFillKeyword(tripSpots, '', row, acceptKw, false, used) ||
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickSwissAlpsClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickSteppeAlaskaClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickUnusedRoutePrimaryLandmark(row, used) ||
        pickUnusedRouteLandmarkFromRowHaystack(row, '', used) ||
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false) ||
        pickTripSpotGapFillFallback(tripSpots, usedPrimary, '') ||
        ''
      if (candidate) primary = candidate
    }

    if (primary && !secondary && fillKw2) {
      const pk = normScheduleImageKeywordKey(primary)
      let candidate =
        pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickCanadaRockiesClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickChinaHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickCentralAsiaClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSwissAlpsClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSteppeAlaskaClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickGapFillKeyword(daySpots, pk, row, acceptKw, false, used, true) ||
        pickGapFillKeyword(tripSpots, pk, row, acceptKw, true, used, true, tripHay, processedByDay) ||
        fillMiddleDayKeyword2InDedupe(row, primary, cands, used, multiSegRoute) ||
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false, pk) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false, pk) ||
        pickSouthAmericaClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickTripSpotGapFillFallback(tripSpots, usedPrimary, pk) ||
        ''
      if (candidate && normScheduleImageKeywordKey(candidate) === pk) candidate = ''
      if (
        candidate &&
        shouldRejectMiddleDayKeyword2(candidate, { ...row, routeText: tripHay }, primary, used)
      ) {
        candidate = ''
      }
      if (candidate) secondary = candidate
    }

    if (!primary) {
      primary =
        pickTripSpotGapFillFallback(daySpots, usedPrimary, '') ||
        pickTripSpotGapFillFallback(tripSpots, usedPrimary, '') ||
        primary
    }

    if (primary && !secondary && fillKw2) {
      const pk = normScheduleImageKeywordKey(primary)
      for (const list of [daySpots, tripSpots, cands]) {
        for (const raw of list) {
          const kw = String(raw ?? '').trim()
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk || nk === pk || isRejectedTripKeywordCandidate(kw) || isBareCityOrCountryKeyword(kw)) {
            continue
          }
          if (
            !registerScheduleKeywordPassesRouteEvidence(kw, {
              ...row,
              routeText: tripHay,
              title: '',
              description: '',
            })
          ) {
            continue
          }
          if (used.has(nk) && !allowClusterKw2ReuseDespiteUsed(kw, tripHay)) continue
          secondary = kw
          break
        }
        if (secondary) break
      }
      if (secondary && normScheduleImageKeywordKey(secondary) === normScheduleImageKeywordKey(primary)) {
        secondary = ''
      }
    }

    if (!primary) {
      primary =
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false) ||
        primary
    }

    if (primary && !secondary && fillKw2) {
      const pk = normScheduleImageKeywordKey(primary)
      secondary =
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false, pk) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false, pk) ||
        secondary
      if (!secondary && isBareCityOrCountryKeyword(primary) && isLaosOnlyClusterRoute(tripHay)) {
        secondary = pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isTaiwanClusterRoute(tripHay)) {
        secondary = pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isOceaniaAuNzClusterRoute(tripHay)) {
        secondary = pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isSoutheastAsiaResortClusterRoute(tripHay)) {
        secondary =
          pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isJapanHubClusterRoute(tripHay)) {
        secondary = pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isEasternEuropeClusterRoute(tripHay)) {
        secondary =
          pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isCanadaRockiesClusterRoute(tripHay)) {
        secondary =
          pickCanadaRockiesClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (
        secondary &&
        shouldRejectMiddleDayKeyword2(secondary, { ...row, routeText: tripHay }, primary, used)
      ) {
        secondary = ''
      }
      if (secondary && shouldRejectRouteLeakKeyword2(secondary, row.routeText, tripHay)) {
        secondary = ''
      }
      if (secondary && normScheduleImageKeywordKey(secondary) === pk) secondary = ''
    }

    if (primary) used.add(normScheduleImageKeywordKey(primary))
    if (primary) usedPrimary.add(normScheduleImageKeywordKey(primary))
    if (secondary) used.add(normScheduleImageKeywordKey(secondary))
    if (
      primary &&
      secondary &&
      normScheduleImageKeywordKey(primary) === normScheduleImageKeywordKey(secondary)
    ) {
      secondary = ''
    }
    if (primary && !secondary && fillKw2) {
      const pkEnd = normScheduleImageKeywordKey(primary)
      for (const list of [daySpots, tripSpots]) {
        for (const raw of list) {
          const kw = String(raw ?? '').trim()
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk || nk === pkEnd || isRejectedTripKeywordCandidate(kw)) continue
          if (isBareCityOrCountryKeyword(kw)) continue
          if (used.has(nk) && !allowClusterKw2ReuseDespiteUsed(kw, tripHay)) continue
          if (
            keywordUsedAsTripPrimary(kw, processedByDay) &&
            !allowClusterKw2ReuseDespiteUsed(kw, tripHay)
          ) {
            continue
          }
          secondary = kw
          break
        }
        if (secondary) break
      }
    }
    processedByDay.set(day, { primary, secondary })
    return { ...row, imageKeyword: primary, imageKeyword2: secondary || null }
  })
}
