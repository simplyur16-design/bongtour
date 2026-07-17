/**
 * 등록 schedule — trip 전체 imageKeyword·imageKeyword2 중복 제거 (6공급사 공통 후처리).
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: manifest
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: routeText 후보만 — manifest
 * REGRESSION-FREEZE[register-schedule-route-text-image-keyword-ssot]: kw2 — primary 확정 후 route 이동순 2번째·랜드마크 dedupe — manifest
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]: domestic-hub-only — applyDomesticHubOnlyDepartureReturnAdjacentKeywords — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: ensureDepartureReturnVisitCityKeywords — 1·마지막일 방문도시 — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 일자 간 중복 시 route 미사용 명소 차순위 — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 해외 패키지·2030 테마 gap-fill 후 reconcile — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
 * REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: pickMongoliaTerelClusterKeywordForUsedSlot — return dedupe — manifest
 * 중간·관광 일 dedupe — 당일 route 후보만. 출발·귀국(인천 only)은 공급사 adjacent-poi SSOT 유지.
 */
import { normScheduleImageKeywordKey, splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { filterRegisterScheduleRoutePlaceSegments, isRegisterScheduleRoutePlaceNoise } from '@/lib/register-schedule-route-place-noise'
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
  isScheduleAirportRouteSegmentText,
  isScheduleDepartureReturnAdjacentKeywordRow,
  isScheduleDepartureReturnAdjacentRouteText,
  resolveScheduleKeywordSlotKind,
} from '@/lib/schedule-image-keyword-adjacent-poi'
import { isAirlineCarrierImageKeyword, isBareCityOrCountryKeyword, isLikelyTourismLandmarkKeyword, isNonLandmarkRouteTextSegment, finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'
import { mapDestination } from '@/lib/pexels-keyword'
import {
  buildRegisterScheduleTripRouteKeywordContext,
  registerScheduleKeywordPassesRouteEvidence,
  registerScheduleKeywordPassesTripRouteTextSsot,
} from '@/lib/register-schedule-route-evidence-keyword'
import { findAllScheduleSpotMatchesInText, firstMatchingScheduleCityEn } from '@/lib/schedule-poi-regex-ssot'
import { hasRioDeJaneiroContext } from '@/lib/schedule-rio-de-janeiro-context'
// REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우→Sugar Loaf 금지 — manifest

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

export function isAirlineOnlyMovementRouteText(routeText: string | null | undefined): boolean {
  const segs = splitRouteTextPlaceSegments(routeText)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  if (!segs.length) return false
  return segs.every((s) => {
    if (isScheduleDomesticHubToken(s)) return false
    if (/[\uAC00-\uD7AF]/.test(s) && !/(?:항공|에어)/u.test(s)) return false
    return (
      isAirlineCarrierImageKeyword(s) ||
      /(?:항공|airline|air(?:line)?\b)/i.test(s)
    )
  })
}

/** 귀국일 — 면세·해외공항·해산만 있으면 중간일 미사용 명소(아라시야마 등) bleed 금지.
 * 국내 허브 only(인천 등)는 false — Long Son 등 인접 미사용 명소 유지. */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return airport/duty-free no unused landmark bleed — manifest
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: domestic hub return keep unused landmark not bare city — manifest
export function isReturnAirportOrShoppingOnlyRouteText(routeText: string | null | undefined): boolean {
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  // sanitize로 비운 해외 면세·공항 귀국 — bleed 가드 유지
  if (!segs.length) return !String(routeText ?? '').trim() ? true : false
  // 인천·김포 only — 국내 허브 귀국은 미사용 명소(Long Son) 허용
  if (segs.every((s) => isScheduleDomesticHubToken(s))) return false
  return segs.every(
    (s) =>
      isRegisterScheduleRoutePlaceNoise(s) ||
      isScheduleAirportRouteSegmentText(s) ||
      /면세|공항|airport|해산|귀국|터미널/i.test(s),
  )
}

function findNextTourismRowForDepartureFill<T extends RegisterScheduleTripKeywordRow>(
  sorted: readonly T[],
  day: number,
  maxDay: number,
  activeDays: number,
): T | undefined {
  const hasMiddleAfter = sorted.some((row) => {
    const nd = Number(row.day)
    return (
      nd > day &&
      nd < maxDay &&
      resolveScheduleKeywordSlotKind(nd, maxDay, activeDays) === 'middle'
    )
  })
  return sorted.find((row) => {
    const nd = Number(row.day)
    if (nd <= day) return false
    const slot = resolveScheduleKeywordSlotKind(nd, maxDay, activeDays)
    if (slot === 'middle') return true
    if (slot === 'return' && nd === maxDay && !hasMiddleAfter) return true
    return false
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
      /(?:출발|인천|김포|Incheon|Gimpo|기내박)/i.test(
        `${String(depRow?.description ?? '')} ${String(depRow?.title ?? '')} ${depRoute}`,
      )) ||
    (isScheduleHubMovementKeywordRow(depRow ?? { routeText: depRoute, day }, day, maxDay) &&
      !isSanitizedSingleDestinationHubRow(depRow, day, maxDay))

  const nextTourism = findNextTourismRowForDepartureFill(sorted, day, maxDay, activeDays)
  if (!nextTourism) return ''

  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hub departure soft-dup visit city not next primary — manifest
  // 기내박·허브 only 출발일이 다음날 1순위(Echo Point 등)를 soft-dup하면 reconcile이 D2를 Sydney로 밀어 키워드 반복·누수
  // 단 visit city가 없거나 국가명뿐이면 NZ 남섬처럼 다음날 primary landmark soft-dup 허용
  if (depHubOnly) {
    const visitCity = pickForeignVisitCityFromRouteText(nextTourism.routeText, false)
    if (
      visitCity &&
      isBareCityOrCountryKeyword(visitCity) &&
      !isCountryLevelScheduleKeyword(visitCity)
    ) {
      return visitCity
    }
  }

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
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hub departure soft-dup next primary when no city — manifest
  const routeLandmarks = collectRouteTextOrderedLandmarkKeywords(nextTourism.routeText)
  const tourismLandmarks = routeLandmarks.filter((kw) => isLikelyTourismLandmarkKeyword(kw))
  const arrivalPrimary = tourismLandmarks[0] ?? routeLandmarks[0] ?? ''
  return arrivalPrimary && isLikelyTourismLandmarkKeyword(arrivalPrimary) ? arrivalPrimary : ''
}

function isReturnDayCityLeakKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (/\bnha trang\b/i.test(t) && !/\bpo nagar\b/i.test(t)) return true
  return isBareCityOrCountryKeyword(t)
}

/** 출발·귀국 soft-dup — Vietnam/New Zealand 등 국가명은 도시로 쓰지 않음 */
function isCountryLevelScheduleKeyword(kw: string): boolean {
  return /^(?:New\s*Zealand|Australia|Vietnam|Thailand|Japan|Korea|South\s*Korea|China|Indonesia|Malaysia|Cambodia|Laos|Philippines|Singapore|United\s*States|USA|Canada|France|Italy|Spain|Germany|United\s*Kingdom|UK|Brazil|Mexico|India|Taiwan|Hong\s*Kong)$/i.test(
    String(kw ?? '').trim(),
  )
}

/** 귀국일 — trip route 미사용 랜드마크 (bare city 제외) */
function pickUnusedTripLandmarkForReturnFill(
  rows: readonly RegisterScheduleTripKeywordRow[],
  used: ReadonlySet<string>,
): string {
  const isUsedish = (kw: string): boolean => {
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk) return true
    if (used.has(nk)) return true
    for (const u of used) {
      if (!u) continue
      if (nk.includes(u) || u.includes(nk)) return true
    }
    return false
  }
  for (const kw of collectTripOrderedLandmarkKeywords(rows)) {
    const t = String(kw ?? '').trim()
    if (!t || isRejectedTripKeywordCandidate(t)) continue
    if (isBareCityOrCountryKeyword(t)) continue
    if (!isLikelyTourismLandmarkKeyword(t) && t.split(/\s+/).length < 2) continue
    if (isUsedish(t)) continue
    return t
  }
  for (const row of [...rows].sort((a, b) => Number(b.day) - Number(a.day))) {
    for (const cand of collectTripKeywordCandidates(row)) {
      const t = String(cand ?? '').trim()
      if (!t || isRejectedTripKeywordCandidate(t) || isBareCityOrCountryKeyword(t)) continue
      if (isUsedish(t)) continue
      if (isLikelyTourismLandmarkKeyword(t)) return t
    }
  }
  return ''
}

function isRejectedTripKeywordCandidate(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBlockedScheduleImageKeyword(t)) return true
  if (isScheduleAirportLikeImageKeyword(t)) return true
  if (isAirlineCarrierImageKeyword(t)) return true
  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: bare continent keyword 금지 — manifest
  if (/^(?:Europe|Asia|Africa|Americas?|Oceania|유럽|아시아|아프리카|중남미|북미|오세아니아)$/i.test(t)) {
    return true
  }
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
      !hasRioDeJaneiroContext(routeHay)
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
  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 치토세 공항·후라노 라벤더 — Provence 환각 금지 — manifest
  if (
    /프로방스|Provence|엑스\s*프로방스|Aix-en-Provence|Valensole|라벤더\s*밭/i.test(rawRoute) &&
    !/(?:후라노|비에이|홋카이도|Hokkaido|Furano|Biei|Farm\s*Tomita|라벤더\s*소프트)/i.test(rawRoute)
  ) {
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
  if (
    /테렐지|Terelj|아리야발|Ariyabal|자이승|Zaisan|수흐바타르|Sukhbaatar|울란바토르|Ulaanbaatar|몽골|Mongolia|거북\s*바위|Turtle\s*Rock/i.test(
      rawRoute,
    )
  ) {
    push('Ariyabal Temple')
    push('Terelj National Park')
    push('Turtle Rock Terelj')
    push('Genghis Khan Statue Complex')
    push('Zaisan Memorial Ulaanbaatar')
    push('Sukhbaatar Square Ulaanbaatar')
    push('Gandantegchinlen Monastery Ulaanbaatar')
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
  if (hasRioDeJaneiroContext(rawRoute)) {
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

export function isScheduleHubMovementKeywordRow(
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
  // 단일 세그먼트가 해외 방문도시(싱가포르 등)면 hub-only로 비우지 않음
  if (segs.length === 1) {
    const only = segs[0]!
    if (isScheduleDomesticHubToken(only) || isScheduleAirportLikeImageKeyword(only)) return true
    return false
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

/** 출발·귀국일 — routeText·인접일·destination에서 해외 방문 도시 정식 영문명 */
function pickForeignVisitCityFromRouteText(
  routeText: string | null | undefined,
  pickLast: boolean,
): string {
  const raw = String(routeText ?? '').trim()
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !isScheduleDomesticHubToken(s))
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
  // 다구간(퀸스타운→오클랜드 공항)에서 공항 구문을 먼저 매칭하면 Auckland가 D7을 먹고 D10 soft-dup이 D7을 지움
  if (segs.length > 0) {
    const ordered = pickLast ? [...segs].reverse() : segs
    for (const seg of ordered) {
      if (isRegisterScheduleRoutePlaceNoise(seg)) continue
      if (segs.length > 1 && isScheduleAirportRouteSegmentText(seg)) continue
      const fromMap = mapDestination(seg)
      if (
        fromMap &&
        fromMap !== seg &&
        !/[\uAC00-\uD7AF]/.test(fromMap) &&
        !isDomesticHubOrAirportImageKeyword(fromMap) &&
        !isRejectedTripKeywordCandidate(fromMap) &&
        !isCountryLevelScheduleKeyword(fromMap)
      ) {
        return fromMap
      }
      const kw = routeTextSegmentToImageKeyword(seg, { allowCity: true, routeText })
      if (
        kw &&
        !isDomesticHubOrAirportImageKeyword(kw) &&
        !isRejectedTripKeywordCandidate(kw) &&
        !isCountryLevelScheduleKeyword(kw) &&
        !isScheduleCityLevelSoftLandmarkKeyword(kw)
      ) {
        return kw
      }
      if (kw && isScheduleCityLevelSoftLandmarkKeyword(kw)) {
        if (/^Queenstown\b/i.test(kw)) return 'Queenstown'
        if (/^Christchurch\b/i.test(kw)) return 'Christchurch'
        if (/^Rotorua\b/i.test(kw)) return 'Rotorua'
        if (/^Auckland\b/i.test(kw)) return 'Auckland'
        if (/^Sydney\b/i.test(kw)) return 'Sydney'
      }
    }
  }
  // 공항-only·단일 구간 — `기상 후 오클랜드 국제 공항` soft-dup
  if (segs.length <= 1) {
    const airportCity = raw.match(
      /([가-힣A-Za-z][가-힣A-Za-z\s]{1,24}?)\s*(?:국제\s*)?공항/u,
    )?.[1]
    if (airportCity) {
      const cleaned = airportCity.replace(/기상\s*후|도착|출발|경유/gu, '').trim()
      if (cleaned.length >= 2 && !isRegisterScheduleRoutePlaceNoise(cleaned)) {
        const fromMap = mapDestination(cleaned)
        if (
          fromMap &&
          !isDomesticHubOrAirportImageKeyword(fromMap) &&
          !isRejectedTripKeywordCandidate(fromMap) &&
          !isCountryLevelScheduleKeyword(fromMap)
        ) {
          return fromMap
        }
        const en = firstMatchingScheduleCityEn(cleaned)
        if (en && !isDomesticHubOrAirportImageKeyword(en) && !isCountryLevelScheduleKeyword(en)) {
          if (/^Queenstown\b/i.test(en)) return 'Queenstown'
          if (/^Christchurch\b/i.test(en)) return 'Christchurch'
          if (/^Rotorua\b/i.test(en)) return 'Rotorua'
          if (/^Auckland\b/i.test(en)) return 'Auckland'
          if (/^Sydney\b/i.test(en)) return 'Sydney'
          return en
        }
      }
    }
  }
  const hay = (segs.length ? (pickLast ? [...segs].reverse() : segs) : []).join(' ') || raw
  const cityEn = firstMatchingScheduleCityEn(hay)
  if (
    cityEn &&
    !isDomesticHubOrAirportImageKeyword(cityEn) &&
    !isRejectedTripKeywordCandidate(cityEn) &&
    !isCountryLevelScheduleKeyword(cityEn)
  ) {
    if (/^Queenstown\b/i.test(cityEn)) return 'Queenstown'
    if (/^Christchurch\b/i.test(cityEn)) return 'Christchurch'
    if (/^Rotorua\b/i.test(cityEn)) return 'Rotorua'
    if (/^Auckland\b/i.test(cityEn)) return 'Auckland'
    if (/^Sydney\b/i.test(cityEn)) return 'Sydney'
    return cityEn
  }
  return ''
}

function pickDepartureVisitCityKeyword<T extends RegisterScheduleTripKeywordRow>(
  sorted: readonly T[],
  day: number,
  maxDay: number,
  activeDays: number,
  productDestination?: string | null,
): string {
  const depRow = sorted.find((r) => Number(r.day) === day)
  const fromOwn = pickForeignVisitCityFromRouteText(depRow?.routeText, false)
  if (fromOwn) return fromOwn
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hub departure soft-dup visit city not next primary — manifest
  // 방문도시(Sydney)를 landmark forward보다 먼저 — Echo Point 등 D2 primary 탈취 방지
  // New Zealand 등 국가명은 visit city로 인정하지 않음
  const nextTourism = findNextTourismRowForDepartureFill(sorted, day, maxDay, activeDays)
  if (nextTourism) {
    const fromNext = pickForeignVisitCityFromRouteText(nextTourism.routeText, false)
    if (
      fromNext &&
      isBareCityOrCountryKeyword(fromNext) &&
      !isCountryLevelScheduleKeyword(fromNext)
    ) {
      return fromNext
    }
  }
  const fromForward = pickDepartureForwardKeywordFromNextRow(sorted, day, maxDay, activeDays)
  if (fromForward) return fromForward
  const dest = String(productDestination ?? '').trim()
  if (dest) {
    const fromDest = mapDestination(dest)
    if (
      fromDest &&
      !isDomesticHubOrAirportImageKeyword(fromDest) &&
      !isRejectedTripKeywordCandidate(fromDest) &&
      !isCountryLevelScheduleKeyword(fromDest)
    ) {
      return fromDest
    }
  }
  return ''
}

function pickReturnVisitCityKeyword<T extends RegisterScheduleTripKeywordRow>(
  sorted: readonly T[],
  day: number,
  productDestination?: string | null,
  used?: ReadonlySet<string>,
): string {
  const retRow = sorted.find((r) => Number(r.day) === day)
  const fromOwn = pickForeignVisitCityFromRouteText(retRow?.routeText, true)
  if (fromOwn) {
    const nk = normScheduleImageKeywordKey(fromOwn)
    if (!nk || !used?.has(nk)) return fromOwn
  }
  const tourismRows = [...sorted]
    .filter((r) => {
      const d = Number(r.day)
      return d > 0 && d < day && !isScheduleDepartureReturnAdjacentKeywordRow(r, isScheduleDomesticHubToken)
    })
    .reverse()
  for (const tourismRow of tourismRows) {
    for (const kw of [...collectTripKeywordCandidates(tourismRow)].reverse()) {
      if (isDomesticHubOrAirportImageKeyword(kw) || isReturnDayCityLeakKeyword(kw)) continue
      const nk = normScheduleImageKeywordKey(kw)
      if (nk && used?.has(nk)) continue
      return kw
    }
    const fromPrior = pickForeignVisitCityFromRouteText(tourismRow.routeText, true)
    if (fromPrior) {
      const nk = normScheduleImageKeywordKey(fromPrior)
      if (!nk || !used?.has(nk)) return fromPrior
    }
  }
  const dest = String(productDestination ?? '').trim()
  if (dest) {
    const fromDest = mapDestination(dest)
    if (
      fromDest &&
      !isDomesticHubOrAirportImageKeyword(fromDest) &&
      !isRejectedTripKeywordCandidate(fromDest)
    ) {
      const nk = normScheduleImageKeywordKey(fromDest)
      if (!nk || !used?.has(nk)) return fromDest
    }
  }
  return ''
}

/** 1일·마지막 일차 imageKeyword 빈 슬롯 — 방문 도시 영문명 최종 보충 */
export function ensureDepartureReturnVisitCityKeywords<T extends RegisterScheduleTripKeywordRow>(
  rows: T[],
  productDestination?: string | null,
): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0))
  const activeDays = sorted.filter((r) => Number(r.day) > 0).length
  const out = new Map<number, T>()
  for (const row of sorted) out.set(Number(row.day), row)

  const middleUsed = new Set<string>()
  const tripReserved = new Set<string>()
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return fill excludes departure+middle used — manifest
  const allUsedExcept = (exceptDay: number) => {
    const s = new Set<string>([...middleUsed, ...tripReserved])
    for (const row of sorted) {
      const d = Number(row.day)
      if (d === exceptDay) continue
      const cur = out.get(d) ?? row
      ingestSlots(cur, s)
    }
    return s
  }
  const ingestSlots = (row: RegisterScheduleTripKeywordRow, into: Set<string>) => {
    for (const slot of [row.imageKeyword, row.imageKeyword2]) {
      const nk = normScheduleImageKeywordKey(String(slot ?? '').trim())
      if (nk) into.add(nk)
    }
  }

  for (const row of sorted) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot === 'departure' || slot === 'return') continue
    ingestSlots(row, middleUsed)
  }

  for (const row of sorted) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'departure' && slot !== 'return') continue
    if (slot === 'departure' && isAirlineOnlyMovementRouteText(row.routeText)) {
      out.set(day, { ...row, imageKeyword: '', imageKeyword2: null })
      continue
    }
    const kw = String(row.imageKeyword ?? '').trim()
    // 출발일 bare 방문도시(Phu Quoc 등)는 정상.
    // 귀국: bare city여도 당일 route 방문도시(Auckland 공항 귀국)면 유지 —
    // 미사용 명소 승격이 Rotorua/Hamilton Gardens 등 다른 날 누수로 키워드 반복처럼 보임.
    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return hub soft-dup visit city before unused landmark — manifest
    const ownReturnCity =
      slot === 'return' ? pickForeignVisitCityFromRouteText(row.routeText, true) : ''
    const returnBareMatchesOwnCity =
      Boolean(ownReturnCity) &&
      Boolean(kw) &&
      normScheduleImageKeywordKey(ownReturnCity) === normScheduleImageKeywordKey(kw)
    const needsFill =
      !kw ||
      (slot === 'return' && isBareCityOrCountryKeyword(kw) && !returnBareMatchesOwnCity) ||
      (slot === 'departure' && isDomesticHubOrAirportImageKeyword(kw))
    if (!needsFill) {
      const kept = { ...row, imageKeyword2: null }
      out.set(day, kept)
      const keptKw = String(kept.imageKeyword ?? '').trim()
      const keptNk = normScheduleImageKeywordKey(keptKw)
      if (keptNk && isBareCityOrCountryKeyword(keptKw)) tripReserved.add(keptNk)
      continue
    }
    const usedForEdge = allUsedExcept(day)
    const filled =
      slot === 'departure'
        ? pickDepartureVisitCityKeyword(sorted, day, maxDay, activeDays, productDestination)
        : (() => {
            // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return hub soft-dup visit city before unused landmark — manifest
            if (
              ownReturnCity &&
              isBareCityOrCountryKeyword(ownReturnCity) &&
              !isCountryLevelScheduleKeyword(ownReturnCity) &&
              !isDomesticHubOrAirportImageKeyword(ownReturnCity)
            ) {
              return ownReturnCity
            }
            // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return airport/duty-free no unused landmark bleed — manifest
            if (isReturnAirportOrShoppingOnlyRouteText(row.routeText)) {
              const fromDest = mapDestination(String(productDestination ?? '').trim())
              if (
                fromDest &&
                !isDomesticHubOrAirportImageKeyword(fromDest) &&
                !isRejectedTripKeywordCandidate(fromDest) &&
                !isCountryLevelScheduleKeyword(fromDest)
              ) {
                return fromDest
              }
              for (const tourismRow of [...sorted].reverse()) {
                const d = Number(tourismRow.day)
                if (d <= 0 || d >= day) continue
                const city = pickForeignVisitCityFromRouteText(tourismRow.routeText, false)
                if (
                  city &&
                  isBareCityOrCountryKeyword(city) &&
                  !isDomesticHubOrAirportImageKeyword(city) &&
                  !isCountryLevelScheduleKeyword(city)
                ) {
                  return city
                }
              }
              return ''
            }
            return (
              pickReturnVisitCityKeyword(sorted, day, productDestination, usedForEdge) ||
              // 귀국일 route에 해외 장소가 없으면 중간일 미사용 명소 bleed 금지 (AVP024 Day5 Stilt House)
              // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return empty no unused landmark bleed — manifest
              (ownReturnCity
                ? pickUnusedTripLandmarkForReturnFill(sorted, usedForEdge) ||
                  pickMongoliaTerelClusterKeywordForUsedSlot(
                    usedForEdge,
                    sorted.map((r) => String(r.routeText ?? '')).join('\n'),
                  )
                : '')
            )
          })()
    if (!filled) {
      const keepKw = String(row.imageKeyword ?? '').trim()
      // 귀국 빈 슬롯 — 미사용 명소 없으면 방문도시 soft-dup (빈칸·환각 랜드마크보다 우선)
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return soft-dup visit city — manifest
      if (slot === 'return' && !keepKw) {
        // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return empty no unused landmark bleed — manifest
        if (!ownReturnCity) {
          out.set(day, { ...row, imageKeyword: '', imageKeyword2: null })
          continue
        }
        const softCity =
          pickReturnVisitCityKeyword(sorted, day, productDestination, undefined) ||
          mapDestination(String(productDestination ?? '').trim()) ||
          ''
        if (
          softCity &&
          !isDomesticHubOrAirportImageKeyword(softCity) &&
          !isRejectedTripKeywordCandidate(softCity)
        ) {
          out.set(day, { ...row, imageKeyword: softCity, imageKeyword2: null })
          continue
        }
      }
      out.set(day, {
        ...row,
        imageKeyword: keepKw,
        imageKeyword2: null,
      })
      if (slot === 'departure' && keepKw) {
        const keepNk = normScheduleImageKeywordKey(keepKw)
        if (keepNk && isBareCityOrCountryKeyword(keepKw)) tripReserved.add(keepNk)
      }
      continue
    }
    const nk = normScheduleImageKeywordKey(filled)
    if (slot === 'return' && nk && usedForEdge.has(nk)) {
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return hub soft-dup visit city before unused landmark — manifest
      // Soft-dup 방문도시(Auckland)를 미사용 명소(Rotorua)로 바꾸지 않음
      const softPrefer =
        (ownReturnCity && isBareCityOrCountryKeyword(ownReturnCity) ? ownReturnCity : '') ||
        (filled && isBareCityOrCountryKeyword(filled) && !isCountryLevelScheduleKeyword(filled)
          ? filled
          : '')
      if (softPrefer) {
        out.set(day, { ...row, imageKeyword: softPrefer, imageKeyword2: null })
        continue
      }
      const alt =
        (ownReturnCity ? pickUnusedTripLandmarkForReturnFill(sorted, usedForEdge) : '') ||
        pickReturnVisitCityKeyword(sorted, day, productDestination, usedForEdge)
      const altNk = alt ? normScheduleImageKeywordKey(alt) : ''
      if (alt && altNk && !usedForEdge.has(altNk)) {
        out.set(day, { ...row, imageKeyword: alt, imageKeyword2: null })
        if (isBareCityOrCountryKeyword(alt)) tripReserved.add(altNk)
        continue
      }
      const softCity = pickReturnVisitCityKeyword(sorted, day, productDestination, undefined)
      if (softCity) {
        out.set(day, { ...row, imageKeyword: softCity, imageKeyword2: null })
        continue
      }
      out.set(day, { ...row, imageKeyword: '', imageKeyword2: null })
      continue
    }
    const next = { ...row, imageKeyword: filled, imageKeyword2: null }
    out.set(day, next)
    if (nk && isBareCityOrCountryKeyword(filled)) tripReserved.add(nk)
  }

  for (const row of sorted) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'middle') continue
    const current = out.get(day) ?? row
    let primary = String(current.imageKeyword ?? '').trim()
    let secondary = String(current.imageKeyword2 ?? '').trim()
    const pk = normScheduleImageKeywordKey(primary)
    const sk = normScheduleImageKeywordKey(secondary)
    if (sk && tripReserved.has(sk)) secondary = ''
    if (pk && tripReserved.has(pk) && isBareCityOrCountryKeyword(primary)) primary = ''
    out.set(day, {
      ...current,
      imageKeyword: primary,
      imageKeyword2: secondary || null,
    })
  }

  return sorted.map((row) => out.get(Number(row.day)) ?? row)
}

/** 국내 허브 only 출발·귀국일 — adjacent-poi SSOT(도착지 forward / 마지막 관광 backward 미사용 명소) */
export function applyDomesticHubOnlyDepartureReturnAdjacentKeywords<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[], opts?: { productDestination?: string | null }): T[] {
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
      picked = pickDepartureVisitCityKeyword(sorted, day, maxDay, activeDays, opts?.productDestination)
      if (!picked) {
        picked = pickDepartureForwardKeywordFromNextRow(sorted, day, maxDay, activeDays)
      }
    } else if (isReturn) {
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return hub soft-dup visit city before unused landmark — manifest
      // 공항-only 귀국이 Hamilton Gardens 등 미방문일 명소를 가져가면 키워드 반복처럼 보임
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return airport/duty-free no unused landmark bleed — manifest
      const airportDutyFreeOnly = isReturnAirportOrShoppingOnlyRouteText(row.routeText)
      {
        const ownCity = pickForeignVisitCityFromRouteText(row.routeText, true)
        if (ownCity && isBareCityOrCountryKeyword(ownCity) && !isDomesticHubOrAirportImageKeyword(ownCity)) {
          picked = ownCity
        }
        if (!picked) {
          const softCity = pickReturnVisitCityKeyword(sorted, day, opts?.productDestination, used)
          if (softCity && isBareCityOrCountryKeyword(softCity)) picked = softCity
        }
        if (!picked && airportDutyFreeOnly) {
          const fromDest = mapDestination(String(opts?.productDestination ?? '').trim())
          if (
            fromDest &&
            !isDomesticHubOrAirportImageKeyword(fromDest) &&
            !isCountryLevelScheduleKeyword(fromDest)
          ) {
            picked = fromDest
          }
        }
      }
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return — 마지막 관광일 미사용 명소만
      const tourismRows = [...sorted]
        .filter((r) => {
          const d = Number(r.day)
          return d > 0 && d < day && !isScheduleDepartureReturnAdjacentKeywordRow(r, isScheduleDomesticHubToken)
        })
        .reverse()
      if (!picked && !airportDutyFreeOnly) {
      for (const tourismRow of tourismRows) {
        for (const kw of [...collectTripKeywordCandidates(tourismRow)].reverse()) {
          if (isDomesticHubOrAirportImageKeyword(kw)) continue
          if (isReturnDayCityLeakKeyword(kw)) continue
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk) continue
          if (used.has(nk)) continue
          let fuzzyHit = false
          for (const u of used) {
            if (nk.includes(u) || u.includes(nk)) {
              fuzzyHit = true
              break
            }
          }
          if (fuzzyHit) continue
          picked = kw
          break
        }
        if (picked) break
      }
      }
      if (!picked && !airportDutyFreeOnly) {
        for (const tourismRow of tourismRows) {
          const alloc = byDay.get(Number(tourismRow.day))
          for (const raw of [
            String(alloc?.secondary ?? '').trim(),
            ...collectTripKeywordCandidates(tourismRow),
          ]) {
            const kw = String(raw ?? '').trim()
            if (!kw || isDomesticHubOrAirportImageKeyword(kw) || isReturnDayCityLeakKeyword(kw)) continue
            const nk = normScheduleImageKeywordKey(kw)
            if (!nk || used.has(nk)) continue
            let fuzzyHit = false
            for (const u of used) {
              if (nk.includes(u) || u.includes(nk)) {
                fuzzyHit = true
                break
              }
            }
            if (fuzzyHit) continue
            picked = kw
            break
          }
          if (picked) break
        }
      }
      if (!picked) {
        picked = pickReturnVisitCityKeyword(sorted, day, opts?.productDestination, undefined)
        if (airportDutyFreeOnly && picked && !isBareCityOrCountryKeyword(picked)) {
          picked =
            mapDestination(String(opts?.productDestination ?? '').trim()) ||
            ''
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
          // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: return SEA Bali only with day/trip Bali evidence — manifest
          if (!southeastAsiaHardcodedPoolHasDayRouteEvidence(kw, tripHay)) continue
          if (isReturnDayCityLeakKeyword(kw) || isDomesticHubOrAirportImageKeyword(kw)) continue
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk || used.has(nk)) continue
          if (!registerScheduleKeywordPassesRouteEvidence(kw, { routeText: tripHay })) continue
          picked = kw
          break
        }
      }
      if (!picked && isMongoliaTerelClusterRoute(tripHay)) {
        picked = pickMongoliaTerelClusterKeywordForUsedSlot(used, tripHay)
      }
      if (!picked) {
        picked = pickReturnVisitCityKeyword(sorted, day, opts?.productDestination, used)
      }
    }

    const existingPrimary = String(row.imageKeyword ?? '').trim()
    const existingNk = normScheduleImageKeywordKey(existingPrimary)
    const primary =
      picked && !isDomesticHubOrAirportImageKeyword(picked)
        ? picked
        : existingPrimary &&
            !isDomesticHubOrAirportImageKeyword(existingPrimary) &&
            (!existingNk || !used.has(existingNk))
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

/** 공항 이동·시내 허브만 — landmark 없으면 trip gap-fill로 전일 명소(Milford 등) 끌어오지 않음 */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
/** 도시 SSOT soft alias — Queenstown Lake Wakatipu 등. true landmark로 세면 공항이동일이 Milford bleed */
function isScheduleCityLevelSoftLandmarkKeyword(kw: string): boolean {
  const t = String(kw ?? '').trim()
  if (!t) return true
  if (isBareCityOrCountryKeyword(t)) return true
  return /^(?:Queenstown(?:\s+Lake\s+Wakatipu)?|Christchurch(?:\s+Cathedral\s+square)?|Rotorua(?:\s+geothermal\s+valley)?|Auckland(?:\s+Sky\s+Tower\s+harbour)?|Sydney|Melbourne|Cairns|Hobart|Gold\s+Coast)$/i.test(
    t,
  )
}

export function isAirportTransferOrCityHubOnlyMiddleRoute(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  if (!/(?:공항|Airport|체크인|호텔)/i.test(t)) return false
  const landmarks = collectRouteTextOrderedLandmarkKeywords(t).filter(
    (kw) => isLikelyTourismLandmarkKeyword(kw) && !isScheduleCityLevelSoftLandmarkKeyword(kw),
  )
  return landmarks.length === 0
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
  const t = String(routeText ?? '')
  if (hasRioDeJaneiroContext(t)) return true
  return /(?:마추|Machu|쿠스코|Cusco|우유니|Uyuni|라\s*파스|La\s*Paz|라파즈|이과수|Iguazu|멕시코|Mexico|Chapultepec|Xochimilco|Tolantongo|Teotihuacan|Guadalupe|코파카바나|Copacabana)/i.test(
    t,
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

/** 동유럽·유럽 mega-pool 하드코딩 키워드 — 당일 route에 지명 증거가 있을 때만 */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: easternEuropeHardcodedPool day-route evidence — manifest
function easternEuropeHardcodedPoolHasDayRouteEvidence(kw: string, dayRoute: string): boolean {
  const rt = String(dayRoute ?? '')
  if (!rt.trim()) return false
  const nk = normScheduleImageKeywordKey(kw)
  if (/prague|charles|krumlov|czech/.test(nk)) {
    return /프라하|Prague|체코|Czech|크룸로프|Krumlov|체스키/i.test(rt)
  }
  if (/budapest|parliament|fisher|matthias|heroes|buda/.test(nk)) {
    return /부다페스트|Budapest|헝가리|Hungary|어부|마챠시|마차시|영웅|국회/i.test(rt)
  }
  if (/hallstatt/.test(nk)) return /할슈타트|Hallstatt/i.test(rt)
  if (/vienna|schonbrunn|belvedere/.test(nk)) {
    return /비엔나|Vienna|Wien|빈\b|쉔부른|벨베데레|슈테판/i.test(rt)
  }
  if (/dubrovnik|rector/.test(nk)) return /두브로브니크|Dubrovnik/i.test(rt)
  if (/plitvice/.test(nk)) return /플리트비체|Plitvice/i.test(rt)
  if (/zagreb|split|diocletian|zadar|donatus/.test(nk)) {
    return /자그레브|Zagreb|스플리트|Split|자다르|Zadar|디오클레|트로기르/i.test(rt)
  }
  if (/madrid|toledo|segovia|plaza mayor|spain/.test(nk)) {
    return /마드리드|Madrid|바르셀로나|Barcelona|톨레도|Toledo|세고비아|Segovia/i.test(rt)
  }
  if (/fatima|lisbon|porto|portugal/.test(nk)) {
    return /파티마|Fatima|리스본|Lisbon|포르투|Porto|포르투갈|Portugal/i.test(rt)
  }
  if (/vilnius|trakai|lithuania/.test(nk)) return /빌니우스|Vilnius|트라카이|Trakai|리투/i.test(rt)
  if (/riga|latvia|rundale|three brothers|art nouveau/.test(nk)) {
    return /리가|Riga|라트|Latvia|룬달레|Rundale/i.test(rt)
  }
  if (/tallinn|estonia|lahemaa|toompea|nevsky/.test(nk)) {
    return /탈린|Tallinn|에스토|Estonia|라헤마|Toompea/i.test(rt)
  }
  if (/geiranger|flam|bergen|oslo|norway/.test(nk)) {
    return /게이랑|Geiranger|플롬|Flam|베르겐|Bergen|오슬로|Oslo|노르웨|Norway/i.test(rt)
  }
  if (/istanbul|cappadocia|pamukkale|hagia|turkey/.test(nk)) {
    return /이스탄불|Istanbul|카파도키아|Cappadocia|파묵|Pamukkale|성소피아|Hagia|튀르키|Turkey/i.test(rt)
  }
  if (/taj|hawa|amber|jaipur|agra|delhi|qutub|india/.test(nk)) {
    return /타지|Taj|자이푸르|Jaipur|아그라|Agra|델리|Delhi|인도|India/i.test(rt)
  }
  return false
}

function pickEasternEuropeClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
  /** 당일 route — 하드코딩 pool은 tripHay가 아닌 여기 증거만 사용 */
  dayRouteText?: string | null,
): string {
  if (isGuamResortClusterRoute(routeText) || isGuamResortClusterRoute(dayRouteText)) return ''
  if (!isEasternEuropeClusterRoute(routeText) && !isEasternEuropeClusterRoute(dayRouteText)) return ''
  const clusterHay = String(routeText ?? dayRouteText ?? '')
  const evidenceHay = String(dayRouteText ?? routeText ?? '')
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowEasternEuropeClusterKw2Duplicate(kw, clusterHay)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
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
    'Hagia Sophia Istanbul',
    'Cappadocia Fairy Chimneys',
    'Taj Mahal Agra India',
    'Hawa Mahal Jaipur',
    'Amber Fort Jaipur India',
  ]) {
    if (!easternEuropeHardcodedPoolHasDayRouteEvidence(raw, evidenceHay)) continue
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

/** Oceania/AU-NZ 하드코딩 풀 — 당일 route에 해당 지역·POI 증거가 있을 때만 (Blue Mountains→Christchurch 블리드 방지) */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: oceaniaAuNzHardcodedPool day-route evidence — manifest
function oceaniaAuNzHardcodedPoolHasDayRouteEvidence(kw: string, dayRoute: string): boolean {
  const rt = String(dayRoute ?? '')
  if (!rt.trim()) return false
  const nk = normScheduleImageKeywordKey(kw)
  if (/blue mountain|echo point|three sisters|katoomba|leura/.test(nk)) {
    return /블루\s*마운틴|Blue\s*Mountain|에코\s*포인트|Echo\s*Point|세\s*자매|카툼바|루라|Leura|Katoomba/i.test(
      rt,
    )
  }
  if (/opera|harbour bridge|taronga|botanic.*sydney|sydney/.test(nk)) {
    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Oceania Opera House not on AU→NZ transit day — manifest
    // Opera House — 시드니 하버/오페라/크루즈만. 「크라이스트처치 시내 명소」의 시내 명소만으로는 불가
    if (/opera|harbour/.test(nk) && !/bridge|taronga|botanic/.test(nk)) {
      return /(?:오페라|Opera)|(?:시드니|Sydney).{0,32}(?:하버|Harbour).{0,20}(?:크루즈|티|Tea)|(?:하버|Harbour).{0,20}(?:크루즈|티|Tea)/i.test(
        rt,
      )
    }
    return /시드니|Sydney|오페라|Opera|하버\s*브리지|Harbour\s*Bridge|동물원|Taronga/i.test(rt)
  }
  if (/christchurch|hagley|cathedral square|avon|mona vale/.test(nk)) {
    return /크라이스트|Christchurch|해글리|Hagley|보타닉|Cathedral|모나\s*베일/i.test(rt)
  }
  if (/mount cook|pukaki|tekapo|twizel/.test(nk)) {
    return /마운트\s*쿡|Mount\s*Cook|푸카키|Pukaki|테카포|Tekapo|트와이젤|Twizel/i.test(rt)
  }
  if (/milford|te anau|fiordland|bowen|sterling|lion mountain/.test(nk)) {
    return /밀포드|Milford|테아나우|Te\s*Anau|피오르|Fiordland|보웬|스털링|라이언/i.test(rt)
  }
  if (/queenstown/.test(nk)) return /퀸스\s*타운|Queenstown/i.test(rt)
  if (/rotorua|redwood|whakarewarewa|agrodome/.test(nk)) {
    return /로토루아|Rotorua|레드우드|Redwood|와까레|Whakare|아그로돔|Agrodome/i.test(rt)
  }
  if (/auckland|sky tower|savage|hamilton garden/.test(nk)) {
    return /오클랜드|Auckland|스카이\s*타워|Sky\s*Tower|세비지|Savage|해밀턴|Hamilton/i.test(rt)
  }
  return isOceaniaAuNzClusterRoute(rt)
}

function pickOceaniaAuNzClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
  dayRoute?: string | null,
): string {
  const evidenceRoute = String(dayRoute ?? '').trim() || String(routeText ?? '')
  if (!isOceaniaAuNzClusterRoute(routeText) && !isOceaniaAuNzClusterRoute(evidenceRoute)) return ''
  const tryPick = (kw: string, requireDayEvidence: boolean): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowOceaniaAuNzClusterKw2Duplicate(kw, evidenceRoute)) return ''
    if (requireDayEvidence && !oceaniaAuNzHardcodedPoolHasDayRouteEvidence(kw, evidenceRoute)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim(), true)
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
    const hit = tryPick(raw, true)
    if (hit) return hit
  }
  return ''
}

/** 동남아 mega-pool 하드코딩 — 당일 route에 해당 목적지 증거가 있을 때만 (싱가포르→푸꾸옥 블리드 방지) */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: southeastAsiaHardcodedPool day-route evidence — manifest
function southeastAsiaHardcodedPoolHasDayRouteEvidence(kw: string, dayRoute: string): boolean {
  const rt = String(dayRoute ?? '')
  if (!rt.trim()) return false
  const nk = normScheduleImageKeywordKey(kw)
  // POI-specific — bare 푸꾸옥만으로 Sao Beach / Hon Thom 주입 금지
  if (/sao beach/.test(nk)) {
    return /사오\s*비치|Sao\s*Beach/i.test(rt)
  }
  if (/hon thom/.test(nk)) {
    return /혼똠|혼똔|Hon\s*Thom|썬월드|세계\s*최장\s*케이블카/i.test(rt)
  }
  if (/phu quoc|phuquoc/.test(nk)) {
    return /푸꾸옥|푸꾹옥|Phu\s*Quoc/i.test(rt)
  }
  if (/nha trang|po nagar|long son/.test(nk)) {
    return /나트랑|Nha\s*Trang|포나가|롱손/i.test(rt)
  }
  if (/angkor|bayon|prohm|tonle|siem reap|baphuon|elephant terrace/.test(nk)) {
    return /앙코르|Angkor|씨엠립|시엠립|Siem\s*Reap|캄보디아|Cambodia|톤레|Tonle/i.test(rt)
  }
  if (/halong/.test(nk)) return /하롱|Halong|Ha\s*Long/i.test(rt)
  if (/hoi an|hoian/.test(nk)) return /호이\s*안|Hoi\s*An/i.test(rt)
  if (/danang|da nang|marble|sontra|my khe/.test(nk)) {
    return /다\s*낭|Da\s*Nang|선짜|마블|미케/i.test(rt)
  }
  if (/maldives|overwater|house reef|lagoon|villa|white sand/.test(nk)) {
    return /몰디브|Maldives|overwater/i.test(rt)
  }
  if (/vang vieng|nam song|blue lagoon|vientiane|pha that|patuxai|laos/.test(nk)) {
    return /방비엥|Vang\s*Vieng|비엔티엔|Vientiane|라오스|Laos|파탓|Patuxai/i.test(rt)
  }
  if (/chiang|phuket|patong|kota kinabalu|cebu|boracay|bali|uluwatu|tegalalang/.test(nk)) {
    return /치앙|Chiang|푸켓|Phuket|파통|코타|Kinabalu|세부|Cebu|보라카이|Boracay|발리|Bali/i.test(
      rt,
    )
  }
  if (/merlion|gardens by the bay|universal studios singapore|sentosa|marina bay|singapore/.test(nk)) {
    return /싱가포르|Singapore|머라이언|Merlion|센토사|Sentosa|마리나|유니버셜|Universal|가든스|Gardens/i.test(
      rt,
    )
  }
  return false
}

function pickSoutheastAsiaResortClusterKeywordForUsedSlot(
  cands: readonly string[],
  used: ReadonlySet<string>,
  routeText: string | null | undefined,
  excludePrimaryNk = '',
  /** 당일 route — 하드코딩 pool은 tripHay가 아닌 여기 증거만 사용 */
  dayRouteText?: string | null,
): string {
  if (
    !isSoutheastAsiaResortClusterRoute(routeText) &&
    !isSoutheastAsiaResortClusterRoute(dayRouteText)
  ) {
    return ''
  }
  const clusterHay = String(routeText ?? dayRouteText ?? '')
  const evidenceHay = String(dayRouteText ?? routeText ?? '')
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (isLaosOnlyClusterRoute(clusterHay) && isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return ''
    if (!allowSoutheastAsiaResortClusterKw2Duplicate(kw, clusterHay)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
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
    'Halong Bay Vietnam',
    'Maldives house reef snorkeling turquoise water',
    'Maldives white sand beach palm trees aerial',
    'Hoi An Ancient Town lantern street',
    'Maldives Overwater Villa Turquoise Lagoon',
    'Maldives beach resort aerial turquoise water',
    'Vang Vieng Nam Song River Karst Mountains',
    'Pha That Luang Vientiane golden stupa',
    'Patuxai Victory Monument Vientiane',
    'Blue Lagoon Vang Vieng emerald water',
    'Merlion Park Singapore',
    'Gardens by the Bay Singapore',
    'Universal Studios Singapore',
    'Sentosa Island Singapore',
    'Marina Bay Sands Singapore',
  ]) {
    if (!southeastAsiaHardcodedPoolHasDayRouteEvidence(raw, evidenceHay)) continue
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
  dayRoute?: string | null,
): string {
  const evidenceRoute = String(dayRoute ?? '').trim() || String(routeText ?? '')
  if (!isHawaiiResortClusterRoute(routeText) && !isHawaiiResortClusterRoute(evidenceRoute)) return ''
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hawaiiHardcodedPool day-route evidence — manifest
  const tryPick = (kw: string, requireDayEvidence: boolean): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowHawaiiResortClusterKw2Duplicate(kw, evidenceRoute)) return ''
    if (requireDayEvidence && !hawaiiHardcodedPoolHasDayRouteEvidence(kw, evidenceRoute)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim(), true)
    if (hit) return hit
  }
  for (const raw of [
    'Diamond Head Honolulu crater view',
    'Pearl Harbor USS Arizona Memorial Hawaii',
    'Hanauma Bay Oahu snorkeling',
    'North Shore Oahu surf beach',
    'Polynesian Cultural Center Oahu Hawaii',
  ]) {
    const hit = tryPick(raw, true)
    if (hit) return hit
  }
  return ''
}

/** Hawaii hardcoded pool — day-route POI evidence only (bare Oahu/TIP must not steal North Shore) */
// REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: hawaiiHardcodedPool day-route evidence — manifest
function hawaiiHardcodedPoolHasDayRouteEvidence(kw: string, dayRoute: string): boolean {
  const rt = String(dayRoute ?? '')
  if (!rt.trim()) return false
  const nk = normScheduleImageKeywordKey(kw)
  if (/diamond head/.test(nk)) return /다이아몬드|Diamond\s*Head/i.test(rt)
  if (/pearl harbor|arizona/.test(nk)) return /진주만|Pearl\s*Harbor|아리조나|Arizona/i.test(rt)
  if (/hanauma/.test(nk)) return /하나우마|Hanauma/i.test(rt)
  if (/north shore/.test(nk)) return /노스\s*쇼어|North\s*Shore/i.test(rt)
  if (/polynesian/.test(nk)) return /폴리네시안|Polynesian/i.test(rt)
  if (/waikiki/.test(nk)) return /와이키키|Waikiki/i.test(rt)
  return false
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
  dayRouteText?: string | null,
): string {
  // tripHay에 vibe「홍콩」문장이 섞여도 당일 route에 홍콩 증거가 없으면 주입 금지
  const evidence = dayRouteText != null ? String(dayRouteText) : String(routeText ?? '')
  if (!isHongKongHubClusterRoute(evidence)) return ''
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (!allowHongKongHubClusterKw2Duplicate(kw, evidence)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
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
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Ipan must not substring-match Saipan — manifest
  return /(?:괌|Guam|투몬|Tumon|아푸간|Apugan|이파오|\bIpan\b)/i.test(String(routeText ?? ''))
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
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Japan hub city/POI only — no bare 일본 (Hamilton Gardens theme list) — manifest
  // bare 「일본|Japan」금지 — AU/NZ 해밀턴 가든 「중국, 영국, 일본…전형적 정원」이 tripHay Japan hub로 오인되어 Mount Fuji 갭필됨
  return /(?:도쿄|Tokyo|시즈오카|Shizuoka|하코네|Hakone|오사카|Osaka|교토|Kyoto|나리타|Narita|후지|Fuji|요나고|Yonago|돗토리|Tottori|이즈모|Izumo|마쯔에|Matsue|다마즈|Tamatsukuri|나고야|Nagoya|타카야마|Takayama|시라카와|Shirakawa|가미코치|Kamikochi|이누야마|Inuyama|아쓰타|Atsuta|후쿠오카|Fukuoka|벳푸|Beppu|유후인|Yufuin|아소|Aso|규슈|Kyushu|오이타|Oita|야나가와|Yanagawa)/i.test(
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
  const hay = String(routeText ?? '')
  // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: 서일본·규슈·간사이에 Fuji 갭필 금지 — manifest
  const westOrKyushuOnly =
    /돗토리|Tottori|요나고|Yonago|시마네|Shimane|이즈모|Izumo|마쯔에|Matsue|다마즈쿠리|Tamatsukuri|쿠라요시|Kurayoshi|벳푸|Beppu|유후인|Yufuin|오이타|Oita|후쿠오카|Fukuoka|규슈|Kyushu|아소|Aso|다자이후|Dazaifu/i.test(
      hay,
    ) &&
    !/후지|Fuji|시즈오카|Shizuoka|하코네|Hakone|도쿄|Tokyo|요코하마|Yokohama|나고야|Nagoya/i.test(hay)
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 교토·오사카·비와호 Kansai — Fuji 갭필 금지 — manifest
  const kansaiWithoutFujiCorridor =
    /교토|Kyoto|오사카|Osaka|나라|Nara|고베|Kobe|비와|Biwa|아라시야마|Arashiyama|기요미즈|Kiyomizu|도톤보리|Dotonbori|우메코지|Umekoji|오미하치만|Omihachiman/i.test(
      hay,
    ) &&
    !/후지|Fuji|시즈오카|Shizuoka|하코네|Hakone|도쿄|Tokyo|요코하마|Yokohama|나고야|Nagoya|가마쿠라|Kamakura/i.test(
      hay,
    )
  const banFujiGapFill = westOrKyushuOnly || kansaiWithoutFujiCorridor
  const tryPick = (kw: string): string => {
    if (!kw || isRejectedTripKeywordCandidate(kw)) return ''
    if (banFujiGapFill && /\bMount\s*Fuji\b|Fuji\s*Shizuoka|Hakone.*Fuji/i.test(kw)) return ''
    if (!allowJapanHubClusterKw2Duplicate(kw, routeText)) return ''
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || clusterSlotExcludesPrimaryKeyword(nk, excludePrimaryNk)) return ''
    if (!used.has(nk)) return kw
    return ''
  }
  for (const raw of cands) {
    const hit = tryPick(String(raw ?? '').trim())
    if (hit) return hit
  }
  const defaults = banFujiGapFill
    ? westOrKyushuOnly
      ? [
          'Tottori Sand Dunes',
          'Izumo Taisha shrine Japan',
          'Matsue Castle Japan',
          'Mount Daisen Yonago',
          'Tamatsukuri Onsen',
          'Beppu hot springs steam Japan',
          'Dazaifu Tenmangu shrine Fukuoka',
          'Mount Aso volcano caldera Japan',
          'Fukuoka city night',
        ]
      : [
          'Kiyomizu-dera Kyoto',
          'Arashiyama bamboo grove Kyoto',
          'Togetsukyo Bridge Arashiyama Kyoto',
          'Fushimi Inari shrine Kyoto',
          'Dotonbori Osaka night',
          'Osaka Castle Japan',
          'Lake Biwa Japan',
          'Nara Todai-ji deer park',
        ]
    : [
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
      ]
  for (const raw of defaults) {
    const hit = tryPick(raw)
    if (hit) return hit
  }
  return ''
}

function isChinaHubClusterRoute(routeText: string | null | undefined): boolean {
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: Japan hub city/POI only — no bare 일본 (Hamilton Gardens theme list) — manifest
  // bare 「중국|China」금지 — 테마정원 국가나열(중국,영국,일본…)이 China hub 환각으로 흐르지 않게
  return /(?:베이징|北京|Beijing|북경|천안문|Tiananmen|만리장성|Great\s*Wall|이화원|Summer\s*Palace|자금성|Forbidden|연길|Yanji|延吉|백두산|Changbai|장백|长白山|선양|Shenyang|금강|Geumgang|장백폭포)/i.test(
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
  const route = String(routeText ?? '')
  if (/(?:후라노|비에이|홋카이도|Hokkaido|Furano|Biei|Farm\s*Tomita|라벤더\s*소프트)/i.test(route)) {
    return false
  }
  if (!/(?:프로방스|Provence|라벤더\s*밭|엑스\s*프로방스|Aix-en-Provence|아비뇽|Avignon|루(?:베|르)(?:봉|손)|Roussillon|세네끄|Senanque|오랑주|Orange)/i.test(route)) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  return /provence|lavender|valensole|aix|avignon|roussillon|senanque|orange|mirabeau|pont/.test(nk)
}

function allowSouthAmericaClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  const t = String(routeText ?? '')
  if (
    !hasRioDeJaneiroContext(t) &&
    !/(?:마추|Machu|쿠스코|Cusco|우유니|Uyuni|라\s*파스|La\s*Paz|라파즈|이과수|Iguazu|멕시코|Mexico|Chapultepec|Xochimilco|Valle\s*de\s*la\s*Luna|코파카바나|Copacabana)/i.test(
      t,
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
  const t = String(routeText ?? '')
  // 괌 스페인광장 등 — 괌은 동유럽/유럽 mega-cluster 금지
  if (isGuamResortClusterRoute(t)) return false
  // 「이탈」단독 금지 — 이탈리아 테마정원 국가나열이 Europe mega-cluster로 오인되지 않게 (`이탈리아|Italy`만)
  return /(?:프라하|Prague|체코|Czech|부다페스트|Budapest|헝가리|Hungary|비엔나|Vienna|Wien|Hallstatt|할슈타트|크룸로프|Krumlov|두브로브니크|Dubrovnik|플리트비체|Plitvice|자그레브|Zagreb|크로아티아|Croatia|슬로베니아|Slovenia|브라티슬라바|Bratislava|폴란드|Poland|Krakow|크라쿠프|리투|Lithuania|라트|Latvia|에스토|Estonia|빌니우스|Vilnius|리가|Riga|탈린|Tallinn|트라카이|Trakai|룬달레|Rundale|발트|Baltic|마드리드|Madrid|바르셀로나|Barcelona|톨레도|Toledo|세고비아|Segovia|포르투|Porto|리스본|Lisbon|파티마|Fatima|포르투갈|Portugal|이탈리아|Italia|\bItaly\b|로마|Rome|피렌|Florence|베니스|Venice|밀라노|Milan|콜로세|Colosseum|파리|Paris|스위스|Swiss|루체른|Lucerne|융프라|Jungfrau|노르웨|Norway|오슬로|Oslo|게이랑|Geiranger|플롬|Flam|베르겐|Bergen|스웨덴|Sweden|핀란|Finland|덴마크|Denmark|이스탄불|Istanbul|카파도키아|Cappadocia|튀르키|Turkey|파묵|Pamukkale|인도|India|자이푸르|Jaipur|아그라|Agra|뉴델리|Delhi|타지|Taj|쿠트브|Qutub)/i.test(
    t,
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
  // 싱가포르만으로 Vietnam/캄보디아 mega-pool을 켜지 않음 — 당일 증거 + Singapore pool로 처리
  return /(?:푸꾸옥|Phu\s*Quoc|푸꾹옥|나트랑|Nha\s*Trang|푸켓|Phuket|코\s*타\s*키나발루|Kota\s*Kinabalu|세부|Cebu|보라카이|Boracay|발리|Bali|다\s*낭|Da\s*Nang|호이\s*안|Hoi\s*An|하롱|Halong|하노이|Hanoi|캄보디아|Cambodia|앙코르|Angkor|씨엠립|시엠립|Siem\s*Reap|라오스|Laos|비엔티엔|Vientiane|방비엥|Vang\s*Vieng|치앙\s*마이|Chiang\s*Mai|푸꾸켓|몰디브|Maldives|overwater|싱가포르|Singapore|머라이언|Merlion|센토사|Sentosa)/i.test(
    String(routeText ?? ''),
  )
}

function allowSoutheastAsiaResortClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  if (!isSoutheastAsiaResortClusterRoute(routeText)) return false
  if (isLaosOnlyClusterRoute(routeText) && isSoutheastAsiaLeakKeywordForLaosRoute(kw)) return false
  const nk = normScheduleImageKeywordKey(kw)
  return /phuquoc|phu quoc|sao beach|hon thom|cable|nhatrang|po nagar|long son|phuket|patong|kota kinabalu|cebu|boracay|bali|uluwatu|tegalalang|danang|hoian|halong|angkor|bayon|prohm|baphuon|tonle|siem reap|elephant terrace|luang|chiang|sontra|marble|my khe|vientiane|vang vieng|laos|nam song|karst|pha that|patuxai|blue lagoon|maldives|overwater|lagoon|villa|house reef|white sand|merlion|gardens by the bay|universal studios singapore|sentosa|marina bay|singapore/.test(
    nk,
  )
}

function allowSteppeAlaskaClusterKw2Duplicate(kw: string, routeText?: string | null): boolean {
  if (isBareCityOrCountryKeyword(kw)) return false
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 발리「비치 클럽 크루즈」만으로 Alaska/Seattle 클러스터 금지 — Seattle·Alaska·내몽골 증거 필요
  // 단독 Glacier/빙하 제외 — 노르웨이 피요르드 빙하박물관이 Glacier Bay를 끌어오지 않게
  const hay = String(routeText ?? '')
  if (
    !/(?:오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|Genghis|내몽골|Inner Mongolia|후룬베이얼|Hulunbuir|만주리|Manzhouli|Seattle|시애틀|Alaska|알래스카|Juneau|Skagway|Glacier\s*Bay|글래시어|Pike Place|Space Needle)/i.test(
      hay,
    )
  ) {
    return false
  }
  const nk = normScheduleImageKeywordKey(kw)
  // REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: 후룬베이얼만 → Ordos·울란바토르 금지 — manifest
  if (isInnerMongoliaChinaRoute(hay) && !/(?:오르도스|Ordos|인컨타라|Xiangshawan)/i.test(hay)) {
    if (/ordos|xiangshawan|ulaanbaatar|gandantegchinlen|terelj|zaisan|sukhbaatar/.test(nk)) return false
  }
  return /ordos|genghis|xiangshawan|desert|grassland|hulunbuir|manzhouli|matryoshka|hailar|steppe|seattle|pike|space needle|gas works|alaska|glacier|juneau|skagway|cruise/.test(
    nk,
  )
}

function isSteppeAlaskaClusterRoute(routeText: string | null | undefined): boolean {
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 단독 크루즈/cruise 토큰 제외 — SEA 비치클럽 크루즈가 Glacier Bay를 끌어오지 않게
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 단독 Glacier/빙하 제외 — 노르웨이 피요르드 — manifest
  return /(?:오르도스|Ordos|인컨타라|Xiangshawan|칭기즈|Genghis|내몽골|Inner Mongolia|후룬베이얼|Hulunbuir|만주리|Manzhouli|Seattle|시애틀|Alaska|알래스카|Juneau|Skagway|Glacier\s*Bay|글래시어|Pike Place|Space Needle)/i.test(
    String(routeText ?? ''),
  )
}

function isInnerMongoliaChinaRoute(routeText: string | null | undefined): boolean {
  // REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: 내몽골·후룬 ≠ 몽골(테렐지/울란바토르) — manifest
  return /(?:내몽골|Inner\s*Mongolia|후룬베이얼|Hulunbuir|呼伦贝尔|만주리|Manzhouli|하이라얼|Hailar|마트료시카|Matryoshka)/i.test(
    String(routeText ?? ''),
  )
}

function isMongoliaTerelClusterRoute(routeText: string | null | undefined): boolean {
  const s = String(routeText ?? '')
  if (isInnerMongoliaChinaRoute(s)) return false
  return /(?:테렐지|Terelj|아리야발|Ariyabal|자이승|Zaisan|수흐바타르|Sukhbaatar|울란바토르|Ulaanbaatar|몽골|Mongolia|거북\s*바위|Turtle\s*Rock)/i.test(
    s,
  )
}

function pickMongoliaTerelClusterKeywordForUsedSlot(
  used: ReadonlySet<string>,
  tripHay: string,
): string {
  if (!isMongoliaTerelClusterRoute(tripHay)) return ''
  for (const kw of [
    'Gandantegchinlen Monastery Ulaanbaatar',
    'Turtle Rock Terelj',
    'Genghis Khan Statue Complex',
    'Ariyabal Temple',
    'Terelj National Park',
    'Zaisan Memorial Ulaanbaatar',
    'Sukhbaatar Square Ulaanbaatar',
  ]) {
    if (isRejectedTripKeywordCandidate(kw) || isDomesticHubOrAirportImageKeyword(kw)) continue
    const nk = normScheduleImageKeywordKey(kw)
    if (!nk || used.has(nk)) continue
    if (!registerScheduleKeywordPassesRouteEvidence(kw, { routeText: tripHay })) continue
    return kw
  }
  return ''
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
  // 일자 간 used 재사용 금지 — 당일 route 2번째도 unused만
  return !used.has(nk)
}

function lodgingClusterRouteContext(routeText: string | null | undefined): string {
  return `${String(routeText ?? '')} Manado Tomohon Bunaken Siladen Sulawesi Rio Corcovado Copacabana Mexico Tolantongo`
}

function allowClusterKw2ReuseDespiteUsed(kw: string, routeText?: string | null): boolean {
  // Trip-wide unique — 일자 간 used norm key 재사용 금지 (클러스터·리조트 예외 폐지).
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: trip-unique no cluster kw reuse — manifest
  void kw
  void routeText
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
  const nk2 = normScheduleImageKeywordKey(secondary)
  const pk = normScheduleImageKeywordKey(primary)
  // 숙박-only 중간일 — prior tourism landmark kw2 허용 (일자 복사 의도)
  if (isLodgingOnlyTourismRoute(row.routeText)) {
    if (
      nk2 &&
      pk &&
      nk2 !== pk &&
      isLikelyTourismLandmarkKeyword(secondary) &&
      !isDomesticHubOrAirportImageKeyword(secondary)
    ) {
      return false
    }
  }
  if (allowKw2TripDuplicateKeyword(secondary, routeCtx)) {
    if (nk2 && used.has(nk2) && !allowClusterKw2ReuseDespiteUsed(secondary, routeCtx)) return true
    return false
  }
  if (isBareCityOrCountryKeyword(secondary)) return true
  if (nk2 === pk) return true
  if (used.has(nk2)) return true
  return false
}

function softDupForeignVisitCityForMiddleRoute(routeText: string | null | undefined): string {
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
  // 랜드마크(Palace/Bird Island)가 아니라 bare 방문도시만 — used 명소 soft-dup 재주입 금지
  const segs = filterRegisterScheduleRoutePlaceSegments(splitRouteTextPlaceSegments(routeText))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && !isScheduleDomesticHubToken(s))
  for (const seg of segs) {
    if (isRegisterScheduleRoutePlaceNoise(seg)) continue
    if (segs.length > 1 && isScheduleAirportRouteSegmentText(seg)) continue
    const fromMap = mapDestination(seg)
    if (
      fromMap &&
      isBareCityOrCountryKeyword(fromMap) &&
      !isCountryLevelScheduleKeyword(fromMap) &&
      !isDomesticHubOrAirportImageKeyword(fromMap) &&
      !isRejectedTripKeywordCandidate(fromMap)
    ) {
      return fromMap
    }
  }
  const hay = String(routeText ?? '')
  for (const ko of [
    '로스앤젤레스',
    '로스엔젤레스',
    '시애틀',
    '사이판',
    '샌프란시스코',
    '라스베이거스',
    '라스베가스',
  ]) {
    if (!hay.includes(ko)) continue
    const m = mapDestination(ko)
    if (
      m &&
      isBareCityOrCountryKeyword(m) &&
      !isCountryLevelScheduleKeyword(m) &&
      !isDomesticHubOrAirportImageKeyword(m) &&
      !isRejectedTripKeywordCandidate(m)
    ) {
      return m
    }
  }
  const city = pickForeignVisitCityFromRouteText(routeText, false)
  if (
    city &&
    isBareCityOrCountryKeyword(city) &&
    !isCountryLevelScheduleKeyword(city) &&
    !isDomesticHubOrAirportImageKeyword(city)
  ) {
    return city
  }
  return ''
}

function pickReplacementPrimaryTripKeyword(
  row: RegisterScheduleTripKeywordRow,
  cands: readonly string[],
  used: ReadonlySet<string>,
): string {
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
  if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
    return softDupForeignVisitCityForMiddleRoute(row.routeText)
  }
  for (const kw of collectRouteTextOrderedLandmarkKeywords(row.routeText)) {
    const raw = String(kw ?? '').trim()
    if (!raw || isRejectedTripKeywordCandidate(raw)) continue
    const nk = normScheduleImageKeywordKey(raw)
    if (!nk || used.has(nk)) continue
    return raw
  }
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
  // 명소가 trip-unique로 소진돼도 used city soft-dup 허용 (Palace/Saipan 반복일)
  const cityKw = softDupForeignVisitCityForMiddleRoute(row.routeText)
  if (cityKw) return cityKw
  const landmarkCands = cands.filter((c) => !isBareCityOrCountryKeyword(c))
  return (
    pickUnusedTripKeyword(landmarkCands.length ? landmarkCands : cands, used) ||
    pickUnusedRoutePrimaryLandmark(row, used) ||
    ''
  )
}

function pickReplacementSecondaryTripKeyword(
  row: RegisterScheduleTripKeywordRow,
  primary: string,
  cands: readonly string[],
  used: ReadonlySet<string>,
  multiSegRoute: boolean,
): string {
  const pk = normScheduleImageKeywordKey(primary)
  const tries = [
    () => pickRouteOrderSecondKeyword(cands, primary, used, true, true, row.routeText),
    () => pickRouteOrderSecondKeyword(cands, primary, used, true, multiSegRoute, row.routeText),
    () =>
      pickUnusedTripKeyword(
        cands.filter((c) => !primary || normScheduleImageKeywordKey(c) !== pk),
        used,
      ),
    () => pickUnusedRoutePrimaryLandmark(row, used),
  ]
  for (const tryFn of tries) {
    const raw = String(tryFn() ?? '').trim()
    if (!raw || isRejectedTripKeywordCandidate(raw)) continue
    const nk = normScheduleImageKeywordKey(raw)
    if (!nk || used.has(nk) || nk === pk) continue
    return raw
  }
  return ''
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
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
      // Queenstown→Auckland 공항일: D6 Queenstown Lake soft-dup과 겹쳐도 Milford로 바꾸지 않음
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
      const softCity = softDupForeignVisitCityForMiddleRoute(row.routeText)
      if (softCity && normScheduleImageKeywordKey(softCity) === pk) {
        // 방문도시 soft-dup — used여도 유지
      } else if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
        primary = softCity
      } else {
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
                softCity ||
                ''
        }
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
        softDupForeignVisitCityForMiddleRoute(row.routeText) ||
        ''
    }

    if (primary && shouldRejectRouteLeakKeyword2(primary, row.routeText, tripHay)) {
      primary = ''
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
        const softCity = softDupForeignVisitCityForMiddleRoute(row.routeText)
        if (softCity && normScheduleImageKeywordKey(softCity) === pk) {
          // keep visit-city soft-dup
        } else {
          const landmarkCands = cands.filter((c) => !isBareCityOrCountryKeyword(c))
          primary =
            pickUnusedTripKeyword(landmarkCands.length ? landmarkCands : cands, used) ||
            pickUnusedRoutePrimaryLandmark(row, used) ||
            pickSafariClusterKeywordForUsedSlot(cands, used, row.routeText) ||
            pickSantoriniClusterKeywordForUsedSlot(cands, used, row.routeText) ||
            softCity ||
            ''
        }
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
            row.routeText,
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
            row.routeText,
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
            row.routeText,
          ) || secondary
      }
      if (!secondary && isHawaiiResortClusterRoute(tripHay)) {
        secondary =
          pickHawaiiResortClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
            row.routeText,
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
      if (!secondary && isHongKongHubClusterRoute(row.routeText)) {
        secondary =
          pickHongKongHubClusterKeywordForUsedSlot(
            cands,
            used,
            tripHay,
            normScheduleImageKeywordKey(primary),
            row.routeText,
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
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickChinaHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        secondary
    }

    if (secondary && shouldRejectMiddleDayKeyword2(secondary, row, primary, used)) {
      secondary = ''
    }
    if (primary && shouldRejectRouteLeakKeyword2(primary, row.routeText, tripHay)) {
      primary = ''
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

/** gap-fill 후 중간일 trip-wide 중복 제거 — 출발·귀국 visit city 슬롯 유지, 차순위 없으면 슬롯 비움 */
export function reconcileRegisterScheduleTripUniqueImageKeywordsAfterGapFill<
  T extends RegisterScheduleTripKeywordRow,
>(rows: T[]): T[] {
  if (!rows.length) return rows
  const sorted = [...rows].sort((a, b) => Number(a.day) - Number(b.day))
  const activeDays = sorted.filter((r) => Number(r.day) > 0).length
  const maxDay = Math.max(...sorted.map((r) => Number(r.day)).filter((d) => d > 0))
  const used = new Set<string>()
  const out = new Map<number, T>()

  for (const row of sorted) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)

    if (slot === 'departure' || slot === 'return') {
      const primary = String(row.imageKeyword ?? '').trim()
      const pk = normScheduleImageKeywordKey(primary)
      if (pk) used.add(pk)
      out.set(day, { ...row, imageKeyword: primary, imageKeyword2: null })
      continue
    }

    const cands = collectTripKeywordCandidates(row)
    const multiSegRoute = routeTextTourismSegmentCount(row.routeText) >= 2
    let primary = String(row.imageKeyword ?? '').trim()
    let secondary = String(row.imageKeyword2 ?? '').trim()

    if (primary && used.has(normScheduleImageKeywordKey(primary))) {
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
      if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
        primary = softDupForeignVisitCityForMiddleRoute(row.routeText)
      } else {
        primary = pickReplacementPrimaryTripKeyword(row, cands, used)
      }
    }
    if (!primary) {
      primary = softDupForeignVisitCityForMiddleRoute(row.routeText)
    }
    if (secondary) {
      const nk2 = normScheduleImageKeywordKey(secondary)
      if (used.has(nk2) || nk2 === normScheduleImageKeywordKey(primary)) {
        secondary = pickReplacementSecondaryTripKeyword(row, primary, cands, used, multiSegRoute)
      }
    }

    if (primary) used.add(normScheduleImageKeywordKey(primary))
    if (secondary) used.add(normScheduleImageKeywordKey(secondary))
    out.set(day, { ...row, imageKeyword: primary, imageKeyword2: secondary || null })
  }

  return sorted.map((row) => out.get(Number(row.day)) ?? row)
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
  // REGRESSION-FREEZE[schedule-segment-poi-us-west]: Yosemite family must not leak onto non-Yosemite US West days - manifest
  const nk = normScheduleImageKeywordKey(secondary)
  const dayRt = String(routeText ?? '')
  if (/yosemite|el capitan|half dome|bridalveil|inspiration point/.test(nk)) {
    if (!/요세미티|Yosemite|엘카피탄|El\s*Capitan|하프돔|Half\s*Dome|브라이드|Bridalveil|인스피레이션/i.test(dayRt)) {
      return true
    }
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
    // 당일 관광 세그먼트가 있으면 tripHay 증거로 타일 랜드마크 주입 금지 (푸꾸옥 Hon Thom/Sao Beach bleed)
    if (routeTextTourismSegmentCount(row.routeText) >= 1) return false
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
      // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
      if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
        const city = pickForeignVisitCityFromRouteText(row.routeText, false)
        // 방문도시 soft-dup 허용 — Queenstown→Auckland 공항일에 Milford/Christchurch 끌어오지 말고
        // used에 있어도 빈칸보다 당일 city 유지 (AU/NZ D7)
        primary =
          (city && !isCountryLevelScheduleKeyword(city) && !isDomesticHubOrAirportImageKeyword(city)
            ? city
            : '') ||
          pickRouteOwnedPrimaryLandmark(row, usedPrimary) ||
          ''
      } else {
      let candidate =
        pickRouteOwnedPrimaryLandmark(row, usedPrimary) ||
        pickGapFillKeyword(daySpots, '', row, acceptKw, false, used) ||
        (routeTextTourismSegmentCount(row.routeText) < 1
          ? pickGapFillKeyword(tripSpots, '', row, acceptKw, false, used)
          : '') ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, '', row.routeText) ||
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, '', row.routeText) ||
        pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, '', row.routeText) ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, '', row.routeText) ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, '', row.routeText) ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        pickSwissAlpsClusterKeywordForUsedSlot(cands, used, tripHay, '') ||
        // 당일 route에 Seattle/Alaska 증거가 있을 때만 — 크루즈·대극장일이 Gas Works를 끌어오지 않음
        pickSteppeAlaskaClusterKeywordForUsedSlot(cands, used, row.routeText, '') ||
        pickUnusedRoutePrimaryLandmark(row, used) ||
        pickUnusedRouteLandmarkFromRowHaystack(row, '', used) ||
        (routeTextTourismSegmentCount(row.routeText) < 1
          ? pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false)
          : '') ||
        (routeTextTourismSegmentCount(row.routeText) < 1
          ? pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false)
          : '') ||
        (routeTextTourismSegmentCount(row.routeText) < 1
          ? pickTripSpotGapFillFallback(tripSpots, usedPrimary, '')
          : '') ||
        ''
      if (candidate) primary = candidate
      }
    }

    if (primary && !secondary && fillKw2) {
      const pk = normScheduleImageKeywordKey(primary)
      const dayHasTourism = routeTextTourismSegmentCount(row.routeText) >= 1
      const airportTransfer = isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)
      let candidate = airportTransfer
        ? ''
        : pickLaosClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickTaiwanClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickGuamResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickCanadaRockiesClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHawaiiResortClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickUaeResortClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickHongKongHubClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
        pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickChinaHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickCentralAsiaClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSwissAlpsClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        pickSteppeAlaskaClusterKeywordForUsedSlot(cands, used, row.routeText, pk) ||
        pickGapFillKeyword(daySpots, pk, row, acceptKw, false, used, true) ||
        (!dayHasTourism
          ? pickGapFillKeyword(tripSpots, pk, row, acceptKw, true, used, true, tripHay, processedByDay)
          : '') ||
        fillMiddleDayKeyword2InDedupe(row, primary, cands, used, multiSegRoute) ||
        (!dayHasTourism
          ? pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false, pk)
          : '') ||
        (!dayHasTourism ? pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false, pk) : '') ||
        pickSouthAmericaClusterKeywordForUsedSlot(cands, used, tripHay, pk) ||
        (!dayHasTourism ? pickTripSpotGapFillFallback(tripSpots, usedPrimary, pk) : '') ||
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
      if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
        primary = pickForeignVisitCityFromRouteText(row.routeText, false) || primary
        if (primary && isCountryLevelScheduleKeyword(primary)) primary = ''
      } else {
      primary =
        pickTripSpotGapFillFallback(daySpots, usedPrimary, '') ||
        (routeTextTourismSegmentCount(row.routeText) < 1
          ? pickTripSpotGapFillFallback(tripSpots, usedPrimary, '')
          : '') ||
        primary
      }
    }

    if (primary && !secondary && fillKw2 && !isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
      const pk = normScheduleImageKeywordKey(primary)
      const lists =
        routeTextTourismSegmentCount(row.routeText) >= 1 ? [daySpots, cands] : [daySpots, tripSpots, cands]
      for (const list of lists) {
        for (const raw of list) {
          const kw = String(raw ?? '').trim()
          const nk = normScheduleImageKeywordKey(kw)
          if (!nk || nk === pk || isRejectedTripKeywordCandidate(kw) || isBareCityOrCountryKeyword(kw)) {
            continue
          }
          if (!registerScheduleKeywordPassesRouteEvidence(kw, row)) {
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

    if (!primary && !isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
      primary =
        pickPriorTourismLandmarkForLodgingDay(row, sorted, used, processedByDay, false) ||
        pickNextTourismLandmarkForMiddleDay(row, sorted, processedByDay, false) ||
        primary
    }

    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: middle empty → visit-city soft-dup — manifest
    // 당일 명소가 trip unique로 소진돼도 빈칸보다 방문도시 유지 (Palace/Seattle D9 등)
    if (!primary) {
      const city = pickForeignVisitCityFromRouteText(row.routeText, false)
      if (
        city &&
        !isCountryLevelScheduleKeyword(city) &&
        !isDomesticHubOrAirportImageKeyword(city)
      ) {
        primary = city
      }
    }

    if (primary && !secondary && fillKw2 && !isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
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
        secondary =
          pickOceaniaAuNzClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isSoutheastAsiaResortClusterRoute(tripHay)) {
        secondary =
          pickSoutheastAsiaResortClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
          secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isJapanHubClusterRoute(tripHay)) {
        secondary = pickJapanHubClusterKeywordForUsedSlot(cands, used, tripHay, pk) || secondary
      }
      if (!secondary && isBareCityOrCountryKeyword(primary) && isEasternEuropeClusterRoute(tripHay)) {
        secondary =
          pickEasternEuropeClusterKeywordForUsedSlot(cands, used, tripHay, pk, row.routeText) ||
          secondary
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
      if (primary && shouldRejectRouteLeakKeyword2(primary, row.routeText, tripHay)) {
        primary = ''
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
    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: airport-transfer middle no trip landmark bleed — manifest
    // gap-fill·cluster가 Milford 등을 심어도 공항이동일은 당일 방문도시로 고정
    if (isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
      const city = pickForeignVisitCityFromRouteText(row.routeText, false)
      if (
        city &&
        !isCountryLevelScheduleKeyword(city) &&
        !isDomesticHubOrAirportImageKeyword(city)
      ) {
        primary = city
        secondary = ''
      } else if (
        primary &&
        isLikelyTourismLandmarkKeyword(primary) &&
        !isScheduleCityLevelSoftLandmarkKeyword(primary)
      ) {
        primary = ''
        secondary = ''
      }
    }
    if (primary && !secondary && fillKw2 && !isAirportTransferOrCityHubOnlyMiddleRoute(row.routeText)) {
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
