/**
 * 등록 사진 수급 전 — 깨진 키워드를 비우고 등록 SSOT로 다시 채운다. 사진 생성 없음.
 * 그래도 검증 실패면 등록대기에 올리지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-self-heal]: 파라도르·식사 키워드 제거, 사진 생성 없음 — manifest
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 패키지·테마만 랜드마크 재적용, 자유여행은 패키지 파이프 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: 셀프힐이 SSOT로 재채움, 통과만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-empty-middle-is-free-day]: 제목 자유일정만 추천일정 — FIT·환승 제외 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 유효 랜드마크는 덮어쓰지 않음 — manifest
 * REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: apply 방문도시·kw2 승격은 힐이 지우지 않음 — manifest
 * REGRESSION-FREEZE[register-hk-gogung-not-taipei-npm]: 나라 틀린 키워드는 비우고 SSOT 재적용 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-heal-off-trip-keyword]: FIT drop + 당일 route 재채움 — manifest
 * REGRESSION-FREEZE[register-pre-photo-verify-identity-country-landmark]: FIT 요약·같은 날 나라 혼선 — manifest
 * REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 트립 템플릿 closer 재합성 — manifest
 * REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: 당일 route 밖 키워드는 지우고 그날 동선으로 채움 — manifest
 * REGRESSION-FREEZE[register-keyword-city-qualified-landmark]: 첫날 관광 키워드·범용 모스크 힐 — manifest
 * REGRESSION-FREEZE[register-pre-photo-la-vallee-not-los-angeles]: 환각 키워드는 route 오탐이어도 제거 — manifest
 * REGRESSION-FREEZE[register-pending-quality-keyword-desc-departure]: keep-filled 후에도 trip dedupe — manifest
 * REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
 */
import { composeRegisterScheduleDaySummary } from '@/lib/register-schedule-description-characteristic-ssot'
import { scrubPoisonedScheduleDayTitlesForCountryKey } from '@/lib/register-pre-photo-country-schedule-self-heal'
import {
  englishFromScheduleKoreanSegment,
  normScheduleImageKeywordKey,
  splitRouteTextPlaceSegments,
} from '@/lib/register-schedule-llm-image-keyword-fallback'
import { isBareCityOrCountryKeyword, isHotelLodgingImageKeyword, isAirlineCarrierImageKeyword } from '@/lib/pexels-place-name-keyword'
import { hayHasCebuPlaceToken } from '@/lib/register-schedule-cebu-place-token'
import { tryPersistScheduleImageKeyword } from '@/lib/schedule-image-keyword-persist'
import {
  firstMatchingScheduleCityEn,
  firstMatchingScheduleSpotEn,
} from '@/lib/schedule-poi-regex-ssot'
import {
  collectRouteTextOrderedImageKeywords,
  collectRouteTextOrderedLandmarkKeywords,
} from '@/lib/register-schedule-route-text-image-keyword-ssot'
import { resolveScheduleKeywordSlotKind } from '@/lib/schedule-image-keyword-adjacent-poi'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import {
  isRegisterScheduleFreeTimeOrResortLeisureText,
  isRegisterScheduleHotelOnlyRouteText,
} from '@/lib/register-schedule-route-text-backfill'
import {
  ensureDepartureReturnVisitCityKeywords,
  scrubAirlineTransitHubKeywordsOffTrip,
  scrubCrossCountrySeaKeywordsOffTrip,
  scrubSameDayDuplicateImageKeyword2,
  shouldRejectAirlineTransitHubKeywordForTrip,
  softDupForeignVisitCityForMiddleRoute,
  allowRouteRevisitBareVisitCitySoftDup,
  enforceRegisterScheduleTripUniqueImageKeywords,
} from '@/lib/register-schedule-trip-image-keyword-dedupe'
import {
  ensureAuroraPrimaryImageKeyword,
  imageKeywordMentionsAurora,
  isAuroraHuntingProductTitle,
} from '@/lib/register-aurora-primary-image-keyword'
import {
  scrubOceanCruiseAtSeaScheduleRow,
} from '@/lib/register-ocean-cruise-at-sea-description'
import { isOceanCruiseAtSeaRoute } from '@/lib/register-ocean-cruise-product'
import type { RegisterAdminLane } from '@/lib/register-admin-lane'
import {
  hasRegisterFreeDayRecommendedItinerary,
  isRegisterPendingFreeItineraryDay,
  ownRouteHasKeyword,
  registerScheduleDayRequiresPrimaryImageKeyword,
  registerScheduleKeywordMatchesOwnDayRoute,
  registerScheduleLodgingAllowsDestLandmark,
  registerScheduleLodgingOnlyAllowsSoftDupVisitCity,
} from '@/lib/register-pre-photo-verify'
import {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  isBrokenRegisterFitScheduleDescription,
  tripDaysSharingTemplateCloser,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'
import {
  isRegisterScheduleCrossContinentHallucinationKeyword,
  isRegisterScheduleSameDayKeywordCountryClash,
  registerPrePhotoPlaceDestHay,
} from '@/lib/register-schedule-cross-continent-keyword-guard'
import {
  collectRegisterScheduleCitySoftAltKeywords,
  pickUnusedRegisterScheduleCitySoftAltKeyword,
} from '@/lib/register-schedule-city-soft-alts'

export { REGISTER_PRE_PHOTO_INGEST_PER_GEO, REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER } from '@/lib/register-pre-photo-ingest-geo-slots'
export {
  isBrokenRegisterLandmarkKeyword,
  isBrokenRegisterScheduleDescription,
  type RegisterPrePhotoHealRow,
} from '@/lib/register-pre-photo-guards'

export const REGISTER_PRE_PHOTO_OPERATOR_SUPPLIERS = [
  'hanatour',
  'modetour',
  'verygoodtour',
  'ybtour',
] as const

export type RegisterPrePhotoHealOpts = {
  supplierKey: string
  productDestination?: string | null
  productTitle?: string | null
  /** 등록화면 레인. 자유여행은 패키지 POI·요약 재작성 금지. 기본 패키지. */
  lane?: RegisterAdminLane
  /** 전일해상 선상 액티비티 추출용 — included/rawMeta/일정 본문 */
  productHaystack?: string | null
  /** day-title hub poison scrub (두바이 귀국 등) */
  countryKey?: string | null
}

export type RegisterPrePhotoHealNote = {
  day: number
  field: 'imageKeyword' | 'imageKeyword2' | 'description' | 'imageUrl' | 'title'
  reason: string
}

export type RegisterPrePhotoHealResult<T extends RegisterPrePhotoHealRow> = {
  rows: T[]
  notes: RegisterPrePhotoHealNote[]
  reappliedKeywords: boolean
}

function sanitizeLandmarkKeyword(
  raw: string | null | undefined,
  allowHotelLodging = false,
): string {
  const t = String(raw ?? '').trim()
  if (!t || isBrokenRegisterLandmarkKeyword(t, { allowHotelLodging })) return ''
  if (allowHotelLodging && isHotelLodgingImageKeyword(t)) return t
  const persist = tryPersistScheduleImageKeyword(t)
  return persist.ok ? persist.value : ''
}

function refillFitKeywordFromDayRoute(
  row: RegisterPrePhotoHealRow,
  destHay: string,
  trip: readonly RegisterPrePhotoHealRow[],
): string {
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: FIT 채움은 당일 route만 — 제목 명소 가로채기 금지 — manifest
  const routeHay = String(row.routeText ?? '').trim()
  const candidates = [
    firstMatchingScheduleSpotEn(routeHay),
    firstMatchingScheduleCityEn(routeHay),
    ...splitRouteTextPlaceSegments(routeHay).map(
      (seg) => englishFromScheduleKoreanSegment(seg) || firstMatchingScheduleSpotEn(seg) || seg,
    ),
    softDupForeignVisitCityForMiddleRoute(routeHay),
    softDupForeignVisitCityForMiddleRoute(destHay),
  ].filter((v): v is string => Boolean(v && String(v).trim()))
  for (const en of candidates) {
    const persist = tryPersistScheduleImageKeyword(en)
    if (!persist.ok) continue
    const v = persist.value
    if (!v || isBrokenRegisterLandmarkKeyword(v, { allowHotelLodging: true })) continue
    if (destHay && isRegisterScheduleCrossContinentHallucinationKeyword(v, destHay, trip)) continue
    // 제목이 아닌 route 기준 — 채운 값이 당일 동선과 안 맞으면 스킵
    if (routeHay && !registerScheduleKeywordMatchesOwnDayRoute(routeHay, v)) continue
    return v
  }
  return ''
}

function scheduleHasBrokenKeywords(
  rows: readonly RegisterPrePhotoHealRow[],
  opts?: {
    allowHotelLodging?: boolean
    productTitle?: string | null
    destHay?: string
    requireFreeDayRecommended?: boolean
  },
): boolean {
  const allowHotelLodging = opts?.allowHotelLodging ?? false
  const destHay = String(opts?.destHay ?? '').trim()
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return false
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  for (const row of days) {
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword, { allowHotelLodging })) return true
    if (isBrokenRegisterLandmarkKeyword(row.imageKeyword2, { allowHotelLodging })) return true
    if (
      destHay &&
      isRegisterScheduleCrossContinentHallucinationKeyword(row.imageKeyword, destHay, rows)
    ) {
      return true
    }
    if (
      destHay &&
      isRegisterScheduleCrossContinentHallucinationKeyword(row.imageKeyword2, destHay, rows)
    ) {
      return true
    }
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot === 'middle' && !String(row.imageKeyword ?? '').trim()) {
      return true
    }
    if (
      slot === 'middle' &&
      String(row.imageKeyword ?? '').trim() &&
      !registerScheduleKeywordMatchesOwnDayRoute(row.routeText, row.imageKeyword)
    ) {
      return true
    }
    if (
      opts?.requireFreeDayRecommended &&
      slot === 'middle' &&
      isRegisterPendingFreeItineraryDay(row, { productTitle: opts.productTitle }) &&
      !hasRegisterFreeDayRecommendedItinerary(row)
    ) {
      return true
    }
    const a = String(row.imageKeyword ?? '').trim().toLowerCase()
    const b = String(row.imageKeyword2 ?? '').trim().toLowerCase()
    if (a && b && a === b) return true
  }
  // 중간일끼리 같은 명소 반복(호텔일에 Grand World 복사)은 재적용 대상
  const seenMiddle = new Set<string>()
  for (const row of days) {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') continue
    const kw = String(row.imageKeyword ?? '').trim()
    const key = kw.toLowerCase()
    if (!key || isBareCityOrCountryKeyword(kw)) continue
    if (seenMiddle.has(key)) return true
    seenMiddle.add(key)
  }
  return false
}

function refillEmptyMiddleRouteFromDest<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay: string,
): T[] {
  const softDest =
    softDupForeignVisitCityForMiddleRoute(destHay) ||
    firstMatchingScheduleCityEn(destHay) ||
    ''
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 빈 middle route는 dest soft-dup으로 채움 — manifest
  // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 빈 route+자유휴양 title은 당일 도시(후르가다)≠dest Cairo — manifest
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    if (String(row.routeText ?? '').trim()) return row
    const titleHay = String(row.title ?? '').trim()
    const fromTitle =
      softDupForeignVisitCityForMiddleRoute(titleHay) ||
      (isRegisterScheduleFreeTimeOrResortLeisureText(titleHay)
        ? firstMatchingScheduleCityEn(titleHay) || ''
        : '')
    const fill =
      (fromTitle && isBareCityOrCountryKeyword(fromTitle) ? fromTitle : '') ||
      (softDest && isBareCityOrCountryKeyword(softDest) ? softDest : '')
    if (!fill) return row
    // 자유휴양 title은 원문 유지(도시 증거) — bare dest만 넣으면 이후 own-route가 dest로 오염
    if (fromTitle && isRegisterScheduleFreeTimeOrResortLeisureText(titleHay)) {
      return { ...row, routeText: titleHay.slice(0, 500) }
    }
    return { ...row, routeText: fill }
  })
}

function bareVisitCityLandmarkPack(routeHay: string): string[] {
  const soft = softDupForeignVisitCityForMiddleRoute(routeHay)
  const hay = String(routeHay ?? '')
  // REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: soft-alt pack → heal refill — manifest
  const softAlts = collectRegisterScheduleCitySoftAltKeywords(hay).filter(
    (k) => !isBareCityOrCountryKeyword(k),
  )
  // REGRESSION-FREEZE[naeiltour-mykonos-kw-no-repeat]: 미코노스 bare 중간일 — windmills 재주입 대신 pool — manifest
  if (/미코노스|Mykonos/i.test(hay) || /^Mykonos$/i.test(String(soft ?? ''))) {
    return [
      'Mykonos windmills',
      'Mykonos Chora white houses',
      'Paradise Beach Mykonos',
      'Delos Island Greece',
      ...softAlts,
    ]
  }
  if (softAlts.length) return softAlts
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: bare 발리 동선은 SEA 명소 팩으로 채움 — manifest
  if (/^Bali$/i.test(String(soft ?? '')) || /^발리$/u.test(hay.trim()) || /발리|Bali/i.test(hay)) {
    return [
      // city-first — persist 후 own-route 유지
      'Bali Garuda Wisnu Kencana statue',
      'Bali Tegalalang Rice Terrace',
      'Bali Tanah Lot Temple sunset',
      'Bali Seminyak Beach',
      'Bali Nusa Penida Kelingking Beach',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 푸꾸옥 숙소일 landmark pack — manifest
  if (/푸꾸옥|Phu\s*Quoc|그랜드월드|Grand\s*World|소나씨|Sonasea|혼똔|Hon\s*Thom|모벤픽|Movenpick/i.test(hay)) {
    return [
      // city-first — 숙소(모벤픽)일 dest own-route; Grand World는 관광일 후순위(숙소 bleed 방지)
      'Phu Quoc Sao Beach',
      'Phu Quoc Night Market',
      'Phu Quoc Dinh Cau Temple',
      'Phu Quoc Vinpearl Safari',
      'Phu Quoc Hon Thom Cable Car',
      'Phu Quoc Grand World',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 이스터섬·파타고니아·도호쿠 팩 — manifest
  if (/이스터섬|Easter\s*Island|라노\s*라라쿠|모아이|Moai/i.test(hay)) {
    return [
      'Rano Raraku Easter Island',
      'Ahu Tongariki Moai Easter Island',
      'Anakena Beach Easter Island',
      'Orongo Easter Island crater',
      'Easter Island Moai statues',
    ]
  }
  if (/칼라파테|Calafate|페리토\s*모레노|Perito\s*Moreno/i.test(hay)) {
    return [
      'Perito Moreno Glacier',
      'Los Glaciares National Park Calafate',
      'Calafate Argentina Patagonia',
    ]
  }
  if (/아오모리|아키타|히로사키|와랏세|Aomori|Akita|Hirosaki/i.test(hay)) {
    return [
      'Hirosaki Castle apple park',
      'Aomori Nebuta Museum',
      'Akita Japan castle town',
      'Warasse Nebuta Festival Aomori',
    ]
  }
  if (/연태|Yantai|옌타이/i.test(hay)) {
    return [
      'Yantai Mountain park lighthouse',
      'Yantai coastal promenade China',
      'Penglai Pavilion Yantai',
    ]
  }
  if (/리펄스|스탠리|초이홍|익청|Repulse|Stanley|Choi\s*Hung/i.test(hay)) {
    return [
      'Repulse Bay Hong Kong beach',
      'Stanley Market Hong Kong',
      'Choi Hung Estate rainbow Hong Kong',
      'Monster Building Hong Kong',
    ]
  }
  if (/카멜리아|산방산|송악산|Camellia|Sanbang|Songak/i.test(hay)) {
    return [
      'Camellia Hill Jeju garden',
      'Sanbangsan Mountain Jeju',
      'Songaksan Coastal Trail Jeju',
    ]
  }
  if (/콜로나다|디아나|베헤로브카|Karlovy|Colonnade/i.test(hay)) {
    return [
      'Mill Colonnade Karlovy Vary',
      'Diana Lookout Karlovy Vary',
      'Becherovka Museum Karlovy Vary',
    ]
  }
  if (/뷔르츠|마리엔베르크|자일|Wurzburg|Würzburg|Marienberg/i.test(hay)) {
    return [
      'Wurzburg Residence palace',
      'Marienberg Fortress Wurzburg',
      'Wurzburg old town Germany',
    ]
  }
  if (/달랏|Da\s*Lat|린푸옥|쑤언흐엉|혼총/i.test(hay)) {
    return [
      'Da Lat Vietnam highland city',
      'Xuan Huong Lake Da Lat',
      'Linh Phuoc Pagoda Da Lat',
      'Hon Chong Cape Da Lat',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 미서부·런던·라스베가스·일본 온천 팩 — manifest
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 일본 단박 맨도시 → 명소 팩 (US 유니버설 catch-all 전) — manifest
  if (/오사카|Osaka|도톤보리|유니버설\s*스튜디오\s*재팬|유니버셜\s*스튜디오\s*재팬|USJ\b/i.test(hay)) {
    return [
      'Universal Studios Japan Osaka',
      'Dotonbori Osaka night',
      'Osaka Castle',
      'Shinsaibashi Osaka',
    ]
  }
  if (/후쿠오카|Fukuoka|다자이후|카나자와|유후인|Yuushien|유슈엔/i.test(hay)) {
    return [
      'Dazaifu Tenmangu shrine Fukuoka',
      'Ohori Park Fukuoka',
      'Canal City Fukuoka',
      'Fukuoka Tower',
    ]
  }
  if (/도쿄|동경|Tokyo|디즈니|아사쿠사|시부야/i.test(hay)) {
    return [
      'Senso-ji Temple Tokyo',
      'Shibuya Crossing Tokyo',
      'Tokyo Skytree',
      'Tokyo Disneyland',
    ]
  }
  if (/오키나와|Okinawa|츄라우미|미하마|미국촌|나하|Naha|마라톤/i.test(hay)) {
    return [
      'Okinawa Churaumi Aquarium',
      'American Village Okinawa',
      'Shuri Castle Okinawa',
      'Okinawa Beach Coast',
      'Naha Kokusai Dori street',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 방콕·보홀·세부 bare → 명소 팩 — manifest
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 보홀·세부·오슬로 명소 route SSOT — manifest
  if (/방콕|Bangkok|왓\s*아룬|짜뚜짝|카오산/i.test(hay)) {
    return [
      'Wat Arun Temple Bangkok',
      'Grand Palace Bangkok',
      'Chatuchak Weekend Market Bangkok',
      'Wat Pho Temple Bangkok',
      'Chao Phraya River Bangkok',
    ]
  }
  if (/보홀|Bohol|초콜릿\s*힐|Chocolate\s*Hills|발리카삭|Balicasag|로복/i.test(hay)) {
    return [
      // city-first — persist 후 own-route 유지
      'Bohol Chocolate Hills',
      'Bohol Loboc River Cruise',
      'Bohol Balicasag Island',
      'Bohol Tarsier Sanctuary',
      'Bohol Alona Beach Panglao',
    ]
  }
  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 세부일정≠Cebu heal pack — manifest
  if (
    hayHasCebuPlaceToken(hay) ||
    /가와산|모알보알|오슬롭|고래상어|Magellan|정어리/i.test(hay)
  ) {
    return [
      'Cebu Oslob Whale Shark',
      'Cebu Moalboal Sardine Run',
      'Cebu Temple of Leah',
      'Cebu Sirao Flower Garden',
      'Cebu Magellan Cross',
      'Cebu Kawasan Falls',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 상해 bare → 명소 팩 — manifest
  if (/상해|상하이|Shanghai|외탄|豫园| bund/i.test(hay)) {
    return [
      // city-first — persist가 도시 토큰을 깎으면 own-route 실패
      'Shanghai Yu Garden',
      'Shanghai Oriental Pearl Tower',
      'Shanghai Nanjing Road',
      'Shanghai Zhujiajiao Water Town',
      'Shanghai Bund skyline',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 하노이·푸켓·나고야·치앙마이·보라카이·하와이·시드니·타이베이 bare → 명소 팩 — manifest
  if (/하노이|Hanoi|호안끼엠|호앙끼엠|올드\s*쿼터/i.test(hay)) {
    return [
      'Hanoi Hoan Kiem Lake',
      'Hanoi Temple of Literature',
      'Hanoi Train Street',
      'Hanoi West Lake',
      'Hanoi Old Quarter',
    ]
  }
  if (/푸켓|Phuket|빠통|Patong|카타|Kata|카론|Karon|제임스\s*본드/i.test(hay)) {
    return [
      'Phuket Patong Beach',
      'Phuket Big Buddha',
      'Phuket James Bond Island',
      'Phuket Promthep Cape',
      'Phuket Phi Phi Islands',
    ]
  }
  if (/나고야|Nagoya|나고야성|지브리\s*파크|레고랜드/i.test(hay)) {
    return [
      'Nagoya Castle',
      'Nagoya Ghibli Park',
      'Nagoya Legoland Japan',
      'Nagoya Atsuta Shrine',
      'Nagoya Osu Shopping District',
    ]
  }
  if (/치앙마이|Chiang\s*Mai|도이수텝|올드\s*시티/i.test(hay)) {
    return [
      'Chiang Mai Old City Temple',
      'Chiang Mai Doi Suthep Temple',
      'Chiang Mai Sunday Night Market',
      'Chiang Mai Elephant Nature Park',
      'Chiang Mai Wat Chedi Luang',
    ]
  }
  if (/보라카이|Boracay|화이트\s*비치|White\s*Beach/i.test(hay)) {
    return [
      'Boracay White Beach',
      'Boracay Diniwid Beach',
      'Boracay Mount Luho',
      'Boracay Puka Shell Beach',
      'Boracay Willys Rock',
    ]
  }
  if (/하와이|Hawaii|호놀룰루|Honolulu|오ahu|Oahu|와이키키|Waikiki/i.test(hay)) {
    return [
      'Hawaii Waikiki Beach',
      'Hawaii Diamond Head crater',
      'Hawaii Pearl Harbor USS Arizona',
      'Hawaii Hanauma Bay snorkeling',
      'Hawaii North Shore Oahu',
    ]
  }
  if (/시드니|Sydney|본디|Bondi|오페라\s*하우스/i.test(hay)) {
    return [
      'Sydney Opera House',
      'Sydney Bondi Beach',
      'Sydney Harbour Bridge',
      'Sydney Tower Eye',
      'Sydney Circular Quay',
    ]
  }
  if (/타이베이|Taipei|타이페이|타이베이\s*101|디화/i.test(hay)) {
    return [
      'Taipei 101',
      'Taipei Dihua Street',
      'Taipei Chiang Kai Shek Memorial Hall',
      'Taipei Jiufen Old Street',
      'Taipei Shilin Night Market',
    ]
  }
  if (/알마티|Almaty|샤린|Charyn/i.test(hay)) {
    return [
      'Almaty Kok Tobe',
      'Almaty Zenkov Cathedral',
      'Almaty Big Almaty Lake',
      'Almaty Charyn Canyon',
      'Almaty Medeu Skating Rink',
    ]
  }
  if (/프라하|Prague|프라그/i.test(hay)) {
    return [
      'Prague Old Town Square',
      'Prague Castle',
      'Prague Charles Bridge',
      'Prague Dancing House',
      'Prague Petrin Tower',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: Victoria Peak ≠ London lodging dest — manifest
  if (/홍콩|Hong\s*Kong|빅토리아\s*피크|Victoria\s*Peak|리펄스|스탠리|Repulse|Stanley/i.test(hay)) {
    return [
      // Victoria Peak Hong Kong → persist Victoria Peak → own-route 실패. 도시 토큰 유지 팩만.
      'Avenue of Stars Hong Kong',
      'Star Ferry Hong Kong',
      'Hong Kong Victoria Peak',
      'Repulse Bay Hong Kong beach',
      'Hong Kong Avenue of Stars',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 보르도 맨도시 중간일 → 명소 팩 — manifest
  if (/보르도|Bordeaux|생테밀리옹|Saint[\s-]*Emilion|부르스/i.test(hay)) {
    return [
      'Place de la Bourse Bordeaux',
      'Grand Theatre Bordeaux',
      'Grosse Cloche Bordeaux',
      'Porte Cailhau Bordeaux',
      'Saint Emilion Winery Bordeaux',
    ]
  }
  if (/헐리우드|세븐\s*매직|레드락|자이언|금문교|피어\s*39|피셔맨|Hollywood|Zion|Golden\s*Gate|(?:로스|LA).{0,24}유니버설|유니버설.{0,24}(?:헐리우드|Hollywood)/i.test(hay)) {
    return [
      'Hollywood Walk of Fame Los Angeles',
      'Universal Studios Hollywood',
      'Seven Magic Mountains Las Vegas',
      'Red Rock Canyon Nevada',
      'Zion National Park',
      'Golden Gate Bridge San Francisco',
      'Pier 39 San Francisco',
      'Fishermans Wharf San Francisco',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  if (/샌프란시스코|San\s*Francisco|금문교|피어\s*39|피셔맨/i.test(hay)) {
    return [
      'San Francisco Golden Gate Bridge',
      'San Francisco Pier 39',
      'San Francisco Fishermans Wharf',
      'San Francisco Lombard Street',
      'San Francisco Alcatraz Island',
    ]
  }
  if (/스피어|벨라지오|프리몬트|Sphere|Bellagio|Fremont/i.test(hay)) {
    return [
      'MSG Sphere Las Vegas',
      'Bellagio Fountains Las Vegas',
      'Bellagio Conservatory Las Vegas',
      'Fremont Street Experience Las Vegas',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 런던 캠든·애비로드·셜록 — manifest
  if (/버킹엄|대영\s*박물관|타워\s*브리지|샤드|Buckingham|British\s*Museum|Tower\s*Bridge|Shard|London|런던|캠든|애비\s*로드|셜록/i.test(hay)) {
    return [
      'London Buckingham Palace',
      'London British Museum',
      'London Tower Bridge Thames',
      'London Camden Market',
      'London Abbey Road',
      'London Sherlock Holmes Museum',
      'London The Shard skyline',
    ]
  }
  if (/오슬로|Oslo|뭉크|Munch|비겔란|Vigeland/i.test(hay)) {
    return [
      'Oslo Munch Museum',
      'Oslo Vigeland Sculpture Park',
      'Oslo Opera House Norway harbor',
      'Oslo Akershus Fortress',
    ]
  }
  if (/마카오|Macau|Macao|세나도|Ruins\s*of\s*St/i.test(hay)) {
    return [
      'Macau Senado Square',
      'Macau Ruins of St Pauls',
      'Macau Guia Fortress',
      'Macau A Ma Temple',
    ]
  }
  if (/마나도|Manado|부나켄|Bunaken/i.test(hay)) {
    return [
      'Manado Bunaken National Marine Park',
      'Manado Bunaken Island snorkeling',
      'Manado Likupang beach',
      'Manado City waterfront',
    ]
  }
  if (/사크레|마레|Sacre|Marais|에펠|Eiffel|파리|Paris/i.test(hay)) {
    return [
      'Sacre Coeur Basilica Paris',
      'Le Marais Paris district',
      'Eiffel Tower Paris',
      'Louvre Museum Paris',
    ]
  }
  if (/카미코지|구로베|토롯코|도야마|Kamikochi|Kurobe|Toyama/i.test(hay)) {
    return [
      'Kamikochi Alpine Route Japan',
      'Kurobe Gorge Torokko Train',
      'Toyama Japan castle town',
    ]
  }
  if (/고치성|마키노|카츠라하마|Kochi|Makino|Katsurahama/i.test(hay)) {
    return [
      'Kochi Castle Japan',
      'Makino Botanical Garden Kochi',
      'Katsurahama Beach Kochi',
    ]
  }
  if (/아카마|간몬|모지코|Akama|Kanmon|Mojiko/i.test(hay)) {
    return [
      'Akama Shrine Shimonoseki',
      'Kanmon Tunnel Shimonoseki',
      'Mojiko Retro town Kitakyushu',
    ]
  }
  if (/알라\s*모아나|탄탈루스|Ala\s*Moana|Tantalus/i.test(hay)) {
    return [
      'Ala Moana Beach Park Honolulu',
      'Tantalus Lookout Honolulu',
      'Nikos Pier 38 Honolulu',
    ]
  }
  if (/오차드|차이나타운|불아사|Orchard|Buddha\s*Tooth/i.test(hay)) {
    return [
      'Orchard Road Singapore',
      'Chinatown Singapore',
      'Buddha Tooth Relic Temple Singapore',
    ]
  }
  if (/쿠로가와|쿠마모토|Kurokawa|Kumamoto/i.test(hay)) {
    return [
      'Kurokawa Onsen village Kumamoto',
      'Kumamoto Castle Japan',
      'Suizenji Jojuen garden Kumamoto',
    ]
  }
  if (/다카마츠|쇼도시마|나오시마|Takamatsu|Shodoshima|Naoshima/i.test(hay)) {
    return [
      'Ritsurin Garden Takamatsu Japan',
      'Shodoshima olive park Japan',
      'Naoshima art island Japan yellow pumpkin',
    ]
  }
  if (/치바|Chiba/i.test(hay) && !/千葉の/i.test(hay)) {
    return ['Tokyo Disneyland Chiba', 'Narita temple Chiba', 'Chiba Japan bay']
  }
  if (/패들보드|콩\s*카페|루프탑|미케/i.test(hay)) {
    return [
      'Da Nang My Khe Beach sunset',
      'Hoi An Ancient Town lanterns',
      'Da Nang Dragon Bridge night',
      'Marble Mountains Da Nang',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 서안·괌 bare → 명소 팩 — manifest
  if (/서안|시안|Xian|Xi['’]?an|병마용|Terracotta/i.test(hay)) {
    return [
      'Xian Terracotta Army',
      'Xian Muslim Quarter',
      'Xian Giant Wild Goose Pagoda',
      'Xian City Wall',
    ]
  }
  if (/괌|Guam|투몬|Tumon/i.test(hay)) {
    return [
      'Guam Tumon Bay beach',
      'Guam Two Lovers Point',
      'Guam Fort Apugan hilltop view',
      'Guam Asia Typhoon Waterpark',
      'Guam Plaza de Espana Spanish steps',
    ]
  }
  // day3 초원인데 day2 사막 키워드 bleed — soft-dup 사막 반복 허용은 사막 route만
  if (/오르도스\s*(?:대)?초원|초원\s*액티비티|꼬마열차|문화원|징기스칸릉/i.test(hay)) {
    return [
      'Ordos grassland prairie Inner Mongolia',
      'Genghis Khan Mausoleum Ordos',
      'Ordos cultural center Inner Mongolia',
    ]
  }
  if (/인컨타라|사막|Xiangshawan/i.test(hay)) {
    return [
      'Xiangshawan Desert Ordos',
      'Ordos desert sunset dunes',
      'Xiangshawan Desert Ordos Inner Mongolia',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  if (/사이판|Saipan/i.test(hay)) {
    return [
      'Managaha Island Saipan',
      'Saipan Bird Island',
      'Suicide Cliff Saipan',
      'Korean Peace Memorial Saipan',
      'Micro Beach Saipan',
      'Banzai Cliff Saipan',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 Hurghada ≠ Cairo dest — manifest
  if (/후르가다|Hurghada|홍해\s*리조트/i.test(hay)) {
    return [
      'Hurghada Red Sea coral reef',
      'Hurghada marina Egypt',
      'Giftun Island Hurghada',
      'Hurghada old town Egypt',
    ]
  }
  if (/코타\s*키나발루|Kota\s*Kinabalu|\bKK\b/i.test(hay)) {
    return [
      'Kota Kinabalu Tunku Abdul Rahman Marine Park',
      'Kota Kinabalu Signal Hill Observatory',
      'Kota Kinabalu Gaya Street Sunday Market',
      'Kota Kinabalu Filipino Market',
      'Kota Kinabalu Manukan Island',
    ]
  }
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  {
    const hasDubai = /두바이|Dubai/i.test(hay)
    const hasAbu = /아부\s*다비|Abu\s*Dhabi/i.test(hay)
    const dubaiPack = [
      'Dubai Burj Khalifa',
      'Dubai Marina skyline',
      'Dubai Palm Jumeirah',
      'Dubai Frame architecture',
      'Dubai Burj Al Arab',
      'Dubai Miracle Garden',
      'Dubai Creek abra boats',
      'Dubai JBR Beach',
      'Dubai Museum Al Fahidi',
    ]
    const abuPack = [
      'Abu Dhabi Sheikh Zayed Grand Mosque',
      'Abu Dhabi Louvre Museum',
      'Abu Dhabi Ferrari World',
      'Abu Dhabi Emirates Palace',
      'Abu Dhabi Yas Marina Circuit',
    ]
    if (hasDubai && hasAbu) return [...dubaiPack, ...abuPack]
    if (hasAbu) return abuPack
    if (hasDubai) return dubaiPack
  }
  if (/뉴욕|New\s*York|\bNYC\b/i.test(hay)) {
    return [
      // city-first — persist 후 own-route 유지
      'New York Times Square',
      'New York Statue of Liberty',
      'New York Empire State Building',
      'New York Brooklyn Bridge',
      'New York One World Trade Center',
      'New York Grand Central Terminal',
    ]
  }
  if (/이스탄불|Istanbul/i.test(hay)) {
    return [
      'Blue Mosque Istanbul',
      'Hagia Sophia Istanbul',
      'Grand Bazaar Istanbul',
      'Bosphorus Bridge Istanbul',
      'Galata Tower Istanbul',
      'Topkapi Palace Istanbul',
    ]
  }
  if (/바르셀로나|Barcelona/i.test(hay)) {
    return [
      'Sagrada Familia Barcelona',
      'Park Guell Barcelona',
      'Casa Batllo Barcelona',
      'La Rambla Barcelona',
      'Barceloneta Beach Barcelona',
    ]
  }
  if (/아테네|Athens/i.test(hay)) {
    return [
      'Acropolis Athens Parthenon',
      'Plaka Athens old town',
      'Temple of Olympian Zeus Athens',
      'Changing of the Guard Athens',
      'Mount Lycabettus Athens',
    ]
  }
  if (/암스테르담|Amsterdam|잔세스/i.test(hay)) {
    return [
      'Zaanse Schans Netherlands',
      'Amsterdam Canal Ring',
      'Rijksmuseum Amsterdam',
      'Anne Frank House Amsterdam',
      'Vondelpark Amsterdam',
    ]
  }
  if (/케이프\s*타운|Cape\s*Town|테이블\s*마운틴/i.test(hay)) {
    return [
      'Cape Town Table Mountain South Africa',
      'Cape Town V&A Waterfront',
      'Cape of Good Hope South Africa',
      'Cape Town Bo-Kaap colorful houses',
      'Cape Town Robben Island',
    ]
  }
  if (/암만|Amman|사해|Dead\s*Sea/i.test(hay)) {
    return [
      'Amman Citadel Jordan',
      'Dead Sea Jordan coastline',
      'Amman Roman Theatre',
      'Rainbow Street Amman',
      'Jerash Roman ruins Jordan',
    ]
  }
  if (/델리|Delhi|딜리/i.test(hay)) {
    return [
      'Dilli Haat Delhi',
      'India Gate Delhi',
      'Qutub Minar Delhi',
      'Red Fort Delhi',
      'Humayun Tomb Delhi',
      'Lotus Temple Delhi',
    ]
  }
  if (/코펜하겐|Copenhagen/i.test(hay)) {
    return [
      'Nyhavn Copenhagen harbor',
      'Little Mermaid Copenhagen',
      'Tivoli Gardens Copenhagen',
      'Christiansborg Palace Copenhagen',
    ]
  }
  if (/헬싱키|Helsinki/i.test(hay)) {
    return [
      'Helsinki Cathedral Senate Square',
      'Suomenlinna Sea Fortress Helsinki',
      'Helsinki Market Square harbor',
      'Temppeliaukio Rock Church Helsinki',
    ]
  }
  if (/다낭|Da\s*Nang|호이안|Hoi\s*An/i.test(hay)) {
    return [
      'Marble Mountains Da Nang',
      'Hoi An Ancient Town lanterns',
      'Da Nang My Khe Beach sunset',
      'Da Nang Dragon Bridge night',
      'Golden Bridge Da Nang',
      'Linh Ung Pagoda Da Nang',
    ]
  }
  if (/장가계|Zhangjiajie|천문산|천자산|보봉/i.test(hay)) {
    return [
      'Zhangjiajie Glass Bridge',
      'Wulingyuan Zhangjiajie',
      'Tianmen Mountain',
      'Tianzi Mountain',
      'Baofeng Lake',
      'Avatar Hallelujah Mountain',
    ]
  }
  if (/삿포|Sapporo|비에이|Biei|오타루|Otaru/i.test(hay)) {
    return [
      'White Beard Falls Biei',
      'Ueno Farm Hokkaido',
      'Otaru Canal',
      'Odori Park Sapporo',
      'Sapporo Clock Tower',
      'Shiroi Koibito Park',
    ]
  }
  if (/레이캬비크|Reykjavik|아이슬란드|Iceland/i.test(hay)) {
    return [
      'Reykjavik Hallgrimskirkja',
      'Reykjavik Colorful Harbor Houses',
      'Harpa Concert Hall Reykjavik',
      'Perlan Reykjavik dome',
    ]
  }
  if (/포즈|Foz|이구아수|Iguazu|이과수/i.test(hay)) {
    return [
      'Iguazu Falls Brazil walkways',
      'Iguazu Brazilian Side Devil Throat',
      'Iguazu Falls Argentina boardwalk',
    ]
  }
  if (/리마|Lima|상파울|Sao\s*Paulo|빅토리아\s*폴스|Victoria\s*Falls/i.test(hay)) {
    return [
      'Lima Miraflores boardwalk Peru',
      'Lima Plaza Mayor colonial',
      'Sao Paulo Paulista Avenue',
      'Victoria Falls Waterfall Panorama',
      'Victoria Falls Livingstone Zambia',
    ]
  }
  return []
}

/** 공항 이동·출국 중간일 — 관광 명소 없이 도시 bare soft-dup 재사용 허용 */
// REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: airport middle bare revisit — manifest
function isAirportOrOutboundMovementRoute(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  if (!/공항|airport|출발\s*\(|출국/i.test(t)) return false
  if (collectRouteTextOrderedLandmarkKeywords(t).length > 0) return false
  return true
}

function priorMiddleDayRouteHay<T extends RegisterPrePhotoHealRow>(
  rows: readonly T[],
  day: number,
): string {
  let best = ''
  let bestDay = 0
  let bestWithCity = ''
  let bestWithCityDay = 0
  for (const r of rows) {
    const d = Number(r.day) || 0
    if (d <= 0 || d >= day) continue
    const route = String(r.routeText ?? '').trim()
    if (!route || isHotelLodgingImageKeyword(route)) continue
    if (d >= bestDay) {
      bestDay = d
      best = route
    }
    // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 호텔 soft-dup은 방문도시 있는 직전일 — manifest
    if (softDupForeignVisitCityForMiddleRoute(route) && d >= bestWithCityDay) {
      bestWithCityDay = d
      bestWithCity = route
    }
  }
  return bestWithCity || best
}

/** 공항 이동 중간일 — trip unique 후에도 bare 방문도시 재주입 */
// REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: airport middle post-unique refill — manifest
function refillAirportMiddleBareCityAfterUnique<T extends RegisterPrePhotoHealRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    if (String(row.imageKeyword ?? '').trim()) return row
    const route = String(row.routeText ?? '').trim()
    if (!isAirportOrOutboundMovementRoute(route)) return row
    const soft = softDupForeignVisitCityForMiddleRoute(route)
    if (!soft || !isBareCityOrCountryKeyword(soft)) return row
    if (!allowRouteRevisitBareVisitCitySoftDup(soft)) return row
    return { ...row, imageKeyword: soft }
  })
}

/** 호텔 title 중간일 — prior 방문도시·dest bare soft-dup (allow-list revisit) */
// REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: hotel title middle soft-dup — manifest
function refillHotelTitleMiddleBareCityAfterUnique<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay: string,
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  const usedBare = new Set<string>()
  for (const row of rows) {
    for (const raw of [row.imageKeyword, row.imageKeyword2]) {
      const t = String(raw ?? '').trim()
      if (!t || !isBareCityOrCountryKeyword(t)) continue
      const nk = normScheduleImageKeywordKey(t)
      if (nk) usedBare.add(nk)
    }
  }
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    if (String(row.imageKeyword ?? '').trim()) return row
    const title = String(row.title ?? '').trim()
    if (!isHotelLodgingImageKeyword(title) && !isRegisterScheduleHotelOnlyRouteText(title)) {
      return row
    }
    const priorHay = priorMiddleDayRouteHay(rows, Number(row.day) || 0)
    const soft =
      softDupForeignVisitCityForMiddleRoute(priorHay) ||
      softDupForeignVisitCityForMiddleRoute(destHay) ||
      firstMatchingScheduleCityEn(destHay) ||
      ''
    if (!soft || !isBareCityOrCountryKeyword(soft)) return row
    if (!allowRouteRevisitBareVisitCitySoftDup(soft)) return row
    const softNk = normScheduleImageKeywordKey(soft)
    if (softNk && usedBare.has(softNk)) return row
    if (softNk) usedBare.add(softNk)
    return { ...row, imageKeyword: soft }
  })
}

/** 자유휴양·당일 route allow-list bare — tripUnique가 비운 뒤 재주입 */
// REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: free leisure post-unique bare revisit — manifest
function refillFreeLeisureMiddleBareCityAfterUnique<T extends RegisterPrePhotoHealRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  // verify middle bare uniqueness와 맞춤 — align이 비운 뒤 used bare를 다시 넣지 않음
  // 자유휴양 방문도시(Hurghada 등)는 다른 middle에 없을 때만 재주입. edge(출발·귀국) bare는
  // verify도 edge→middle 반복을 막으므로 usedBare에 edge를 포함한다.
  const usedBare = new Set<string>()
  for (const row of rows) {
    for (const raw of [row.imageKeyword, row.imageKeyword2]) {
      const t = String(raw ?? '').trim()
      if (!t || !isBareCityOrCountryKeyword(t)) continue
      const nk = normScheduleImageKeywordKey(t)
      if (nk) usedBare.add(nk)
    }
  }
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    if (String(row.imageKeyword ?? '').trim()) return row
    const route = String(row.routeText ?? '').trim()
    const title = String(row.title ?? '').trim()
    // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 bare dest(Cairo)→당일 도시(Hurghada) — manifest
    const soft =
      softDupForeignVisitCityForMiddleRoute(route) ||
      softDupForeignVisitCityForMiddleRoute(title) ||
      firstMatchingScheduleCityEn(route) ||
      firstMatchingScheduleCityEn(title) ||
      ''
    if (!soft || !isBareCityOrCountryKeyword(soft)) return row
    if (!allowRouteRevisitBareVisitCitySoftDup(soft)) return row
    const softNk = normScheduleImageKeywordKey(soft)
    const free =
      isRegisterScheduleFreeTimeOrResortLeisureText(route) ||
      isRegisterScheduleFreeTimeOrResortLeisureText(title)
    // verify: edge·다른 middle에 같은 맨도시가 있으면 재주입 금지 → landmark pack이 채움
    if (softNk && usedBare.has(softNk)) return row
    const onOwn =
      registerScheduleKeywordMatchesOwnDayRoute(route, soft) ||
      registerScheduleKeywordMatchesOwnDayRoute(title, soft)
    if (!free && !onOwn) return row
    if (softNk) usedBare.add(softNk)
    return { ...row, imageKeyword: soft }
  })
}

function refillEmptyMiddleKeywordFromRoute<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay: string,
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  const used = new Set(
    rows
      .flatMap((r) => [String(r.imageKeyword ?? '').trim(), String(r.imageKeyword2 ?? '').trim()])
      .filter(Boolean)
      .flatMap((k) => {
        const low = k.toLowerCase()
        const nk = normScheduleImageKeywordKey(k)
        return nk ? [low, nk] : [low]
      }),
  )
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 식별불가 중간일 키워드 비강제 — manifest
    if (!registerScheduleDayRequiresPrimaryImageKeyword(slot, row.routeText)) {
      return row
    }
    const routeHay = String(row.routeText ?? '').trim()
    const titleHay = String(row.title ?? '').trim()
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 맨도시보다 명소 팩 우선 — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 출발·귀국은 pack으로 bare soft-dup 덮지 않음 — manifest
    const preferPack = slot === 'middle'
    const landmarkPack = preferPack ? bareVisitCityLandmarkPack(routeHay) : []
    const curKw = String(row.imageKeyword ?? '').trim()
    const freeLeisureEarly =
      isRegisterScheduleFreeTimeOrResortLeisureText(routeHay) ||
      isRegisterScheduleFreeTimeOrResortLeisureText(titleHay)
    const ownFreeCityRaw =
      softDupForeignVisitCityForMiddleRoute(routeHay) ||
      softDupForeignVisitCityForMiddleRoute(titleHay) ||
      firstMatchingScheduleCityEn(routeHay) ||
      firstMatchingScheduleCityEn(titleHay) ||
      ''
    // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 ownCity=bare만 — 홍해 POI(Red Sea Egypt)≠도시 — manifest
    const ownFreeCity =
      ownFreeCityRaw && isBareCityOrCountryKeyword(ownFreeCityRaw) ? ownFreeCityRaw : ''
    // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 bare dest(Cairo)→당일 도시(Hurghada) — manifest
    const freeCityMismatch =
      freeLeisureEarly &&
      Boolean(curKw) &&
      isBareCityOrCountryKeyword(curKw) &&
      Boolean(ownFreeCity) &&
      normScheduleImageKeywordKey(curKw) !== normScheduleImageKeywordKey(ownFreeCity)
    if (freeCityMismatch && ownFreeCity) {
      const key = ownFreeCity.trim().toLowerCase()
      if (curKw && isBareCityOrCountryKeyword(curKw)) {
        used.delete(curKw.trim().toLowerCase())
      }
      if (key) used.add(key)
      const keepRoute =
        freeLeisureEarly && (routeHay || titleHay)
          ? routeHay || titleHay
          : routeHay || titleHay || ownFreeCity
      return { ...row, routeText: keepRoute, imageKeyword: ownFreeCity }
    }
    if (
      curKw &&
      !freeCityMismatch &&
      !(preferPack && landmarkPack.length > 0 && isBareCityOrCountryKeyword(curKw))
    ) {
      return row
    }
    const hay = [routeHay, row.title].filter(Boolean).join(' ')
    const priorHay = priorMiddleDayRouteHay(rows, Number(row.day) || 0)
    const fromKoSegs = splitRouteTextPlaceSegments(routeHay)
      .map(
        (seg) =>
          englishFromScheduleKoreanSegment(seg) ||
          firstMatchingScheduleSpotEn(seg) ||
          seg,
      )
      .filter((v) => Boolean(v && String(v).trim()))
    // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: verify와 같은 route SSOT 후보로 채움 — manifest
    const candidates = [
      ...collectRouteTextOrderedLandmarkKeywords(routeHay),
      ...collectRouteTextOrderedImageKeywords(routeHay),
      ...(preferPack ? [] : [firstMatchingScheduleCityEn(routeHay)]),
      ...(preferPack ? [] : [softDupForeignVisitCityForMiddleRoute(routeHay)]),
      firstMatchingScheduleSpotEn(routeHay),
      ...landmarkPack,
      ...fromKoSegs,
      ...(landmarkPack.length ? [] : [firstMatchingScheduleCityEn(routeHay)]),
      ...(landmarkPack.length ? [] : [softDupForeignVisitCityForMiddleRoute(routeHay)]),
      // REGRESSION-FREEZE[register-pre-photo-heal-pending-fail2]: 숙소-only는 직전 방문도시 soft-dup — manifest
      softDupForeignVisitCityForMiddleRoute(priorHay),
      softDupForeignVisitCityForMiddleRoute(destHay),
      firstMatchingScheduleCityEn(destHay),
    ].filter((v): v is string => Boolean(v && String(v).trim()))
    for (const raw of candidates) {
      const persist = tryPersistScheduleImageKeyword(raw)
      if (!persist.ok || !persist.value) continue
      if (isBrokenRegisterLandmarkKeyword(persist.value) && !isBareCityOrCountryKeyword(persist.value)) {
        continue
      }
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack 있으면 맨도시 후보 스킵 — manifest
      if (landmarkPack.length > 0 && isBareCityOrCountryKeyword(persist.value)) continue
      if (destHay && isRegisterScheduleCrossContinentHallucinationKeyword(persist.value, destHay, rows)) {
        continue
      }
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 맨도시-only route도 pack 명소 허용 — manifest
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack도 verify own-route 통과 필수 — manifest
      const lodging = isHotelLodgingImageKeyword(routeHay) || !routeHay
      const onRoute = registerScheduleKeywordMatchesOwnDayRoute(routeHay, persist.value)
      const onDest =
        Boolean(destHay) && registerScheduleKeywordMatchesOwnDayRoute(destHay, persist.value)
      const packHit =
        landmarkPack.length > 0 &&
        landmarkPack.some((raw) => {
          const p = tryPersistScheduleImageKeyword(raw)
          return p.ok && p.value && normScheduleImageKeywordKey(p.value) === normScheduleImageKeywordKey(persist.value)
        })
      const bareOnlyRoutePack =
        packHit &&
        landmarkPack.length > 0 &&
        collectRouteTextOrderedLandmarkKeywords(routeHay).length < 1
      if (
        !onRoute &&
        !registerScheduleLodgingOnlyAllowsSoftDupVisitCity(routeHay, persist.value) &&
        !(lodging && packHit && onDest) &&
        !bareOnlyRoutePack
      ) {
        continue
      }
      const key = persist.value.trim().toLowerCase()
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used 맨도시는 재주입 금지 — manifest
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used 명소는 ownRouteHasKeyword(strict)일 때만 — manifest
      // REGRESSION-FREEZE[register-pre-photo-heal-pending-fail2]: 당일 route 명소는 used여도 재허용 — 비맨도시만 — manifest
      if (key && used.has(key)) {
        const isBare = isBareCityOrCountryKeyword(persist.value)
        const ownLandmark = !isBare && ownRouteHasKeyword(routeHay, persist.value)
        // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 공항 이동일은 used bare soft-dup 허용 — manifest
        if (
          isBare &&
          isAirportOrOutboundMovementRoute(routeHay) &&
          allowRouteRevisitBareVisitCitySoftDup(persist.value)
        ) {
          /* allow */
        } else if (isBare || !ownLandmark) {
          continue
        }
      }
      if (key) {
        // upgrading bare → landmark: drop prior bare key
        if (curKw && isBareCityOrCountryKeyword(curKw)) {
          used.delete(curKw.trim().toLowerCase())
        }
        used.add(key)
      }
      return { ...row, imageKeyword: persist.value }
    }
    // REGRESSION-FREEZE[register-ocean-cruise-product]: soft-dup 도시 직접 채움 — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 이미 쓴 맨도시는 스킵 — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack 있으면 맨도시 soft 주입 금지 — manifest
    const softOnly =
      landmarkPack.length > 0 ? '' : softDupForeignVisitCityForMiddleRoute(routeHay)
    if (softOnly && isBareCityOrCountryKeyword(softOnly)) {
      const key = softOnly.trim().toLowerCase()
      const airportRevisit =
        Boolean(key) &&
        used.has(key) &&
        isAirportOrOutboundMovementRoute(routeHay) &&
        allowRouteRevisitBareVisitCitySoftDup(softOnly)
      if (key && (!used.has(key) || airportRevisit)) {
        if (!used.has(key)) used.add(key)
        return { ...row, imageKeyword: softOnly }
      }
    }
    // softOnly가 used로 막히면 같은 도시 명소 팩
    if (softOnly && isBareCityOrCountryKeyword(softOnly)) {
      for (const raw of bareVisitCityLandmarkPack(routeHay)) {
        const persist = tryPersistScheduleImageKeyword(raw)
        if (!persist.ok || !persist.value) continue
        // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack도 verify own-route 통과 필수 — manifest
        if (!registerScheduleKeywordMatchesOwnDayRoute(routeHay, persist.value)) continue
        const key = persist.value.trim().toLowerCase()
        if (key && used.has(key)) continue
        if (key) used.add(key)
        return { ...row, imageKeyword: persist.value }
      }
    }
    // REGRESSION-FREEZE[register-pre-photo-heal-verify-align]: 숙소-only·빈 중간일은 dest soft-dup — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: dest soft-dup도 미사용만 — manifest
    if (
      isHotelLodgingImageKeyword(routeHay) ||
      !routeHay ||
      isHotelLodgingImageKeyword(String(row.title ?? ''))
    ) {
      const softDest =
        softDupForeignVisitCityForMiddleRoute(priorHay) ||
        softDupForeignVisitCityForMiddleRoute(destHay) ||
        firstMatchingScheduleCityEn(destHay) ||
        ''
      if (softDest && isBareCityOrCountryKeyword(softDest)) {
        const key = softDest.trim().toLowerCase()
        // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 호텔일은 allow-list bare revisit — manifest
        if (key && (!used.has(key) || allowRouteRevisitBareVisitCitySoftDup(softDest))) {
          if (!used.has(key)) used.add(key)
          return { ...row, imageKeyword: softDest }
        }
      }
    }
    // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: activity-only(패들보드 등)는 dest soft-dup — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack 있으면 맨도시 soft 주입 금지 — manifest
    if (landmarkPack.length < 1) {
      // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 당일 route 도시 우선 — dest Cairo≠Hurghada — manifest
      const titleHay = String(row.title ?? '').trim()
      const freeLeisure =
        isRegisterScheduleFreeTimeOrResortLeisureText(routeHay) ||
        isRegisterScheduleFreeTimeOrResortLeisureText(titleHay)
      const routeCityRaw =
        softDupForeignVisitCityForMiddleRoute(routeHay) ||
        softDupForeignVisitCityForMiddleRoute(titleHay) ||
        firstMatchingScheduleCityEn(routeHay) ||
        firstMatchingScheduleCityEn(titleHay) ||
        ''
      // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 routeCity=bare만 — Red Sea Egypt 금지 — manifest
      const routeCity =
        routeCityRaw && isBareCityOrCountryKeyword(routeCityRaw) ? routeCityRaw : ''
      const softDest =
        routeCity ||
        (freeLeisure
          ? ''
          : softDupForeignVisitCityForMiddleRoute(priorHay) ||
            softDupForeignVisitCityForMiddleRoute(destHay) ||
            firstMatchingScheduleCityEn(destHay) ||
            '')
      const hasSpot =
        !freeLeisure &&
        (Boolean(firstMatchingScheduleSpotEn(routeHay)) ||
          collectRouteTextOrderedLandmarkKeywords(routeHay).length > 0)
      // 자유휴양: title/route 도시(Hurghada 등) bare — dest Cairo 덮어쓰기 금지
      if (
        !hasSpot &&
        softDest &&
        isBareCityOrCountryKeyword(softDest)
      ) {
        const key = softDest.trim().toLowerCase()
        const revisitOk =
          freeLeisure &&
          (allowRouteRevisitBareVisitCitySoftDup(softDest) || Boolean(routeCity))
        if (key && (!used.has(key) || revisitOk)) {
          if (!used.has(key)) used.add(key)
          const nextRoute =
            routeHay &&
            (softDupForeignVisitCityForMiddleRoute(routeHay) ||
              softDupForeignVisitCityForMiddleRoute(titleHay))
              ? routeHay || titleHay
              : freeLeisure
                ? routeHay || titleHay || softDest
                : [routeHay, softDest].filter(Boolean).join(' - ')
          return { ...row, routeText: nextRoute || softDest, imageKeyword: softDest }
        }
      }
    }
    void hay
    return row
  })
}

function alignMiddleKeywordsToVerifyGate<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay: string,
  productTitle?: string | null,
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: verify와 동일하게 middle 중복 제거 — manifest
  // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: off-route kw2는 최종에서 무조건 비움 — manifest
  const seen = new Map<string, number>()
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: edge bare seed before middle — manifest
  for (const row of days) {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot === 'middle') continue
    for (const raw of [row.imageKeyword, row.imageKeyword2]) {
      const t = String(raw ?? '').trim()
      if (!t || !isBareCityOrCountryKeyword(t)) continue
      const key = normScheduleImageKeywordKey(t)
      if (key && !seen.has(key)) seen.set(key, day)
    }
  }
  const out = rows.map((row) => {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'middle') return row
    let kw = String(row.imageKeyword ?? '').trim()
    let kw2 = String(row.imageKeyword2 ?? '').trim()
    const route = String(row.routeText ?? '').trim()
    const lodgingOnly = isHotelLodgingImageKeyword(route)
    const keepPrimary =
      !kw ||
      registerScheduleKeywordMatchesOwnDayRoute(route, kw) ||
      registerScheduleLodgingOnlyAllowsSoftDupVisitCity(route, kw) ||
      registerScheduleLodgingAllowsDestLandmark(route, kw, destHay) ||
      (isAuroraHuntingProductTitle(productTitle) && imageKeywordMentionsAurora(kw))
    if (!keepPrimary) kw = ''
    // 숙소-only — 타일 명소 kw2 금지. dest 명소는 primary/kw2 모두 허용.
    const keepKw2 =
      !kw2 ||
      (!lodgingOnly &&
        (registerScheduleKeywordMatchesOwnDayRoute(route, kw2) ||
          registerScheduleLodgingOnlyAllowsSoftDupVisitCity(route, kw2))) ||
      registerScheduleLodgingAllowsDestLandmark(route, kw2, destHay)
    if (!keepKw2) kw2 = ''
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: middle bare kw2는 반복(used)일 때만 제거 — manifest
    if (kw2 && isBareCityOrCountryKeyword(kw2)) {
      const k2 = normScheduleImageKeywordKey(kw2)
      if (k2 && (seen.has(k2) || (kw && normScheduleImageKeywordKey(kw) === k2))) kw2 = ''
    }
    if (kw && kw2 && normScheduleImageKeywordKey(kw) === normScheduleImageKeywordKey(kw2)) {
      kw2 = ''
    }
    if (kw && kw2 && isRegisterScheduleSameDayKeywordCountryClash(kw, kw2)) {
      kw2 = ''
    }
    if (destHay && kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, rows)) {
      kw2 = ''
    }
    if (destHay && kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, rows)) {
      kw = ''
    }
    for (const [field, raw] of [
      ['kw', kw],
      ['kw2', kw2],
    ] as const) {
      if (!raw) continue
      const key = normScheduleImageKeywordKey(raw)
      if (!key) continue
      const prev = seen.get(key)
      if (prev != null) {
        if (isBareCityOrCountryKeyword(raw)) {
          if (field === 'kw') kw = ''
          else kw2 = ''
        } else if (!ownRouteHasKeyword(route, raw)) {
          // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: ownRouteHasKeyword strict for landmark dup — manifest
          // 도시 soft 귀속(상해→동방명주)으로 bleed 명소를 유지하면 verify keyword_bleed
          if (field === 'kw') kw = ''
          else kw2 = ''
        }
      } else {
        seen.set(key, day)
      }
    }
    return { ...row, imageKeyword: kw, imageKeyword2: kw2 || null }
  })
  // 공란 middle primary — 당일 route 미사용 명소 · 숙소일은 landmark pack
  const used = new Set(
    out
      .flatMap((r) => [String(r.imageKeyword ?? '').trim(), String(r.imageKeyword2 ?? '').trim()])
      .filter(Boolean)
      .map((k) => normScheduleImageKeywordKey(k))
      .filter(Boolean),
  )
  return out.map((row) => {
    const day = Number(row.day)
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    if (slot !== 'middle') return row
    if (String(row.imageKeyword ?? '').trim()) return row
    if (!registerScheduleDayRequiresPrimaryImageKeyword(slot, row.routeText)) return row
    const routeHay = String(row.routeText ?? '').trim()
    const priorHay = priorMiddleDayRouteHay(out, day)
    const packFromRoute = bareVisitCityLandmarkPack(routeHay)
    const packFromPrior = bareVisitCityLandmarkPack(priorHay)
    const packFromDest = bareVisitCityLandmarkPack(destHay)
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: prior 무관하면 dest pack — manifest
    // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: activity-only middle → dest soft-alt — manifest
    // 패들보드 등 route 명소 0이면 prior(출발일) pack보다 dest pack 우선 — prior 공항·허브로 막히지 않게
    const activityOnlyDestPack =
      packFromRoute.length === 0 &&
      collectRouteTextOrderedLandmarkKeywords(routeHay).length < 1 &&
      packFromDest.length > 0
    const pack = packFromRoute.length
      ? packFromRoute
      : activityOnlyDestPack
        ? packFromDest
        : packFromPrior.length
          ? packFromPrior
          : packFromDest
    const packPersistKeys = new Set(
      pack
        .map((k) => {
          const p = tryPersistScheduleImageKeyword(k)
          if (!p.ok || !p.value) return ''
          return normScheduleImageKeywordKey(p.value)
        })
        .filter(Boolean),
    )
    const lodging = isHotelLodgingImageKeyword(routeHay) || !routeHay
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 맨도시-only route도 pack 명소 허용 — manifest
    const bareOnlyRoute =
      packFromRoute.length > 0 && collectRouteTextOrderedLandmarkKeywords(routeHay).length < 1
    // 빈 route + dest pack 도 lodging과 동일하게 pack 허용
    const emptyRouteDestPack = !routeHay && packFromDest.length > 0
    // 패들보드·버거 등 route 명소 0 + dest pack 있으면 dest soft-alt로 채움
    // 자유시간·공항이동처럼 당일 도시 증거가 없으면 dest hay로 soft-alt unlock (HK airtel D3)
    // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: free-time empty middle → dest soft-alt — manifest
    const dayCityEvidence =
      Boolean(softDupForeignVisitCityForMiddleRoute(routeHay)) ||
      Boolean(firstMatchingScheduleCityEn(routeHay)) ||
      collectRouteTextOrderedLandmarkKeywords(routeHay).length > 0
    const softPickHay =
      !dayCityEvidence && destHay
        ? [routeHay, destHay].filter(Boolean).join('\n')
        : routeHay
    const softPick = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: softPickHay,
      title: row.title,
      description: row.description,
      usedKeyword: String(row.imageKeyword2 ?? '').trim() || undefined,
    })
    const cands = [
      ...collectRouteTextOrderedLandmarkKeywords(routeHay),
      ...collectRouteTextOrderedImageKeywords(routeHay),
      ...pack,
      softPick,
      firstMatchingScheduleSpotEn(routeHay),
    ].filter((v): v is string => Boolean(v && String(v).trim()))
    for (const raw of cands) {
      const persist = tryPersistScheduleImageKeyword(raw)
      if (!persist.ok || !persist.value) continue
      if (isBareCityOrCountryKeyword(persist.value)) continue
      if (isBrokenRegisterLandmarkKeyword(persist.value)) continue
      const nk = normScheduleImageKeywordKey(persist.value)
      if (!nk || used.has(nk)) continue
      const onRoute = registerScheduleKeywordMatchesOwnDayRoute(routeHay, persist.value)
      const onDest =
        Boolean(destHay) && registerScheduleKeywordMatchesOwnDayRoute(destHay, persist.value)
      // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: pack도 verify own-route 통과 필수 — manifest
      // Victoria Peak(도시 토큰 소실)처럼 persist 후 onRoute 실패면 주입 금지. 숙소/빈 route만 dest 귀속 허용.
      // 맨도시-only route + city pack: soft 도시 토큰이 키워드에 있으면 허용
      // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: middle empty — day soft-alt pick refill — manifest
      const softAltPickHit =
        Boolean(softPick) && normScheduleImageKeywordKey(softPick) === nk && Boolean(routeHay)
      if (
        !onRoute &&
        !(lodging && packPersistKeys.has(nk) && onDest) &&
        !(emptyRouteDestPack && packPersistKeys.has(nk) && onDest) &&
        !(bareOnlyRoute && packPersistKeys.has(nk)) &&
        !(activityOnlyDestPack && packPersistKeys.has(nk) && onDest) &&
        !softAltPickHit
      ) {
        continue
      }
      used.add(nk)
      return { ...row, imageKeyword: persist.value }
    }
    if (lodging || activityOnlyDestPack) {
      // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: 자유휴양 bare dest(Cairo)→당일 도시(Hurghada) — manifest
      const soft =
        softDupForeignVisitCityForMiddleRoute(routeHay) ||
        softDupForeignVisitCityForMiddleRoute(priorHay) ||
        softDupForeignVisitCityForMiddleRoute(destHay) ||
        firstMatchingScheduleCityEn(destHay) ||
        ''
      if (soft && isBareCityOrCountryKeyword(soft)) {
        const nk = normScheduleImageKeywordKey(soft)
        if (nk && !used.has(nk)) {
          used.add(nk)
          return { ...row, imageKeyword: soft }
        }
      }
    }
    return row
  })
}

function dropKeywordsNotOnOwnDayRoute<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  destHay = '',
  productTitle?: string | null,
): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  const auroraProduct = isAuroraHuntingProductTitle(productTitle)
  const usedBareCity = new Set(
    rows
      .filter((r) => {
        const d = Number(r.day)
        const slot = resolveScheduleKeywordSlotKind(d, maxDay, activeDays)
        return slot === 'middle' && isBareCityOrCountryKeyword(String(r.imageKeyword ?? ''))
      })
      .map((r) => String(r.imageKeyword ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'middle') return row
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    // REGRESSION-FREEZE[register-pre-photo-la-vallee-not-los-angeles]: 환각은 당일 route 오탐이어도 제거 — manifest
    const hallucKw = Boolean(
      destHay && kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, rows),
    )
    const hallucKw2 = Boolean(
      destHay && kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, rows),
    )
    // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 오로라 primary는 own-route drop 예외 — manifest
    const auroraKw = auroraProduct && imageKeywordMentionsAurora(kw)
    // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 초원일≠사막 키워드 bleed — manifest
    const desertOnGrass =
      /초원/u.test(String(row.routeText ?? '')) &&
      !/사막|인컨타라|Xiangshawan/i.test(String(row.routeText ?? '')) &&
      /Desert|사막|Xiangshawan/i.test(kw)
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 빈 route 중간일은 dest 명소 유지 — manifest
    // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: activity-only middle → dest soft-alt — manifest
    const emptyRoute = !String(row.routeText ?? '').trim()
    const routeLandmarkCount = collectRouteTextOrderedLandmarkKeywords(row.routeText).length
    const activityOnlyNoLandmark = !emptyRoute && routeLandmarkCount < 1 && Boolean(String(destHay ?? '').trim())
    const destPackPersistKeys =
      emptyRoute || activityOnlyNoLandmark
        ? new Set(
            bareVisitCityLandmarkPack(destHay)
              .map((raw) => {
                const p = tryPersistScheduleImageKeyword(raw)
                return p.ok && p.value ? normScheduleImageKeywordKey(p.value) : ''
              })
              .filter(Boolean),
          )
        : null
    const keepViaDest =
      (emptyRoute || activityOnlyNoLandmark) &&
      Boolean(kw) &&
      (registerScheduleKeywordMatchesOwnDayRoute(destHay, kw) ||
        Boolean(destPackPersistKeys?.has(normScheduleImageKeywordKey(kw))))
    const keepViaDest2 =
      (emptyRoute || activityOnlyNoLandmark) &&
      Boolean(kw2) &&
      (registerScheduleKeywordMatchesOwnDayRoute(destHay, kw2) ||
        Boolean(destPackPersistKeys?.has(normScheduleImageKeywordKey(kw2))))
    const keepKw =
      !kw ||
      auroraKw ||
      keepViaDest ||
      registerScheduleLodgingAllowsDestLandmark(row.routeText, kw, destHay) ||
      (!desertOnGrass &&
        !hallucKw &&
        (registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw) ||
          registerScheduleLodgingOnlyAllowsSoftDupVisitCity(row.routeText, kw)))
    const keepKw2 =
      !kw2 ||
      keepViaDest2 ||
      registerScheduleLodgingAllowsDestLandmark(row.routeText, kw2, destHay) ||
      (!hallucKw2 &&
        !(
          /초원/u.test(String(row.routeText ?? '')) &&
          !/사막|인컨타라|Xiangshawan/i.test(String(row.routeText ?? '')) &&
          /Desert|사막|Xiangshawan/i.test(kw2)
        ) &&
        (registerScheduleKeywordMatchesOwnDayRoute(row.routeText, kw2) ||
          registerScheduleLodgingOnlyAllowsSoftDupVisitCity(row.routeText, kw2)))
    if (keepKw && keepKw2) {
      if (kw && isBareCityOrCountryKeyword(kw)) usedBareCity.add(kw.toLowerCase())
      return row
    }
    let nextKw = keepKw ? kw : ''
    let nextKw2 = keepKw2 ? kw2 || null : null
    if (!nextKw && nextKw2) {
      nextKw = nextKw2
      nextKw2 = null
    }
    // 숙소-only 중간일 — bleed 제거 후 직전 방문도시·dest soft-dup으로 채움
    // REGRESSION-FREEZE[register-pre-photo-heal-pending-fail2]: lodging bleed→prior city — manifest
    // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: lodging soft-dup도 미사용만 — manifest
    if (
      !nextKw &&
      isHotelLodgingImageKeyword(String(row.routeText ?? ''))
    ) {
      const priorHay = priorMiddleDayRouteHay(rows, Number(row.day) || 0)
      const soft =
        softDupForeignVisitCityForMiddleRoute(priorHay) ||
        softDupForeignVisitCityForMiddleRoute(destHay) ||
        firstMatchingScheduleCityEn(destHay) ||
        ''
      if (soft && isBareCityOrCountryKeyword(soft)) {
        const key = soft.trim().toLowerCase()
        if (key && !usedBareCity.has(key)) {
          nextKw = soft
          usedBareCity.add(key)
        }
      }
    }
    if (nextKw && isBareCityOrCountryKeyword(nextKw)) {
      usedBareCity.add(nextKw.trim().toLowerCase())
    }
    return { ...row, imageKeyword: nextKw, imageKeyword2: nextKw2 }
  })
}

function stripOffTripReturnHubRoute<T extends RegisterPrePhotoHealRow>(rows: T[], destHay: string): T[] {
  if (!destHay) return rows
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  const tripHayAll = rows.map((r) => String(r.routeText ?? '')).join('\n')
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    if (slot !== 'return' && slot !== 'departure') return row
    const route = String(row.routeText ?? '').trim()
    if (!route) return row
    const segs = splitRouteTextPlaceSegments(route)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    const parts = segs.length ? segs : [route]
    // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 경유 허브(이스탄불·두바이) ≠ 이탈리아·시칠리아 귀국 soft-dup — manifest
    // 귀국 route가 「두바이」만이면 own-route 검사가 이탈리아 soft-dup을 전부 비움 → route 비워 soft-dup 허용
    const onlyTransitHub =
      parts.length > 0 &&
      parts.every((s) => {
        const en = firstMatchingScheduleCityEn(s) || s
        return (
          shouldRejectAirlineTransitHubKeywordForTrip(en, `${tripHayAll}\n${destHay}`) ||
          shouldRejectAirlineTransitHubKeywordForTrip(s, `${tripHayAll}\n${destHay}`)
        )
      })
    if (onlyTransitHub) {
      return { ...row, routeText: '' }
    }
    const onTrip = parts.filter(
      (s) => !isRegisterScheduleCrossContinentHallucinationKeyword(s, destHay, rows),
    )
    if (onTrip.length > 0) return row
    const offTrip = parts.some((s) =>
      isRegisterScheduleCrossContinentHallucinationKeyword(s, destHay, rows),
    )
    if (!offTrip) return row
    return { ...row, routeText: '' }
  })
}

function promoteEmptyMiddlePrimaryFromKeyword2<T extends RegisterPrePhotoHealRow>(rows: T[]): T[] {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (!days.length) return rows
  const maxDay = Math.max(...days.map((r) => Number(r.day)))
  const activeDays = days.length
  const usedPrimary = new Set<string>()
  for (const r of days) {
    const pk = normScheduleImageKeywordKey(String(r.imageKeyword ?? '').trim())
    if (pk) usedPrimary.add(pk)
  }
  return rows.map((row) => {
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), maxDay, activeDays)
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (!registerScheduleDayRequiresPrimaryImageKeyword(slot, row.routeText) || kw || !kw2) {
      return row
    }
    const skNk = normScheduleImageKeywordKey(kw2)
    // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: middle empty kw1 — used kw2 clear for refill — manifest
    if (skNk && usedPrimary.has(skNk)) return { ...row, imageKeyword2: null }
    if (skNk) usedPrimary.add(skNk)
    return { ...row, imageKeyword: kw2, imageKeyword2: null }
  })
}

function healDescription(
  row: RegisterPrePhotoHealRow,
  maxDay: number,
  force = false,
  productHaystack?: string | null,
  opts?: { fit?: boolean },
): string {
  const current = String(row.description ?? '').trim()
  const descBroken = opts?.fit
    ? isBrokenRegisterFitScheduleDescription
    : isBrokenRegisterScheduleDescription
  // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 힐 전일해상 선상 요약 — manifest
  if (isOceanCruiseAtSeaRoute(row.routeText) || isOceanCruiseAtSeaRoute(row.title)) {
    const scrubbed = scrubOceanCruiseAtSeaScheduleRow(
      {
        title: row.title,
        routeText: row.routeText,
        description: current,
      },
      productHaystack,
    )
    return String(scrubbed.description ?? current)
  }
  // REGRESSION-FREEZE[register-fit-gemini-desc-verify]: FIT Gemini 요약 유지 — manifest
  if (!force && !descBroken(current, row.routeText)) return current
  const routePlaces = splitRouteTextPlaceSegments(row.routeText)
  let next = current
  try {
    next = composeRegisterScheduleDaySummary({
      day: Number(row.day) || 1,
      maxDay,
      routePlaces,
      joinedBlob: [row.routeText, row.title, row.description].filter(Boolean).join('\n'),
      supplierText: null,
    })
  } catch {
    next = current
  }
  // REGRESSION-FREEZE[register-ocean-cruise-product]: 귀국·기항 요약에 route 지명 강제 — manifest
  if (descBroken(next, row.routeText)) {
    const lead = routePlaces.map((p) => p.trim()).find((p) => p.length >= 2)
    if (lead && !next.includes(lead)) {
      next = `${lead}에서 일정을 마무리한 뒤 귀국 이동으로 이어갑니다.`
    }
  }
  return next
}

/**
 * 사진 생성·Pexels/Gemini 호출 없음.
 * 숙소·식사 키워드를 비운 뒤, 중간일이 비거나 깨져 있으면 등록 imageKeyword SSOT로 다시 채운다.
 * 이미 유효한 랜드마크는 덮어쓰지 않는다.
 * 그래도 깨져 있으면 parser_fix_required — 그 건은 등록대기에 올리지 않는다.
 */
export function healRegisterPrePhotoSchedule<T extends RegisterPrePhotoHealRow>(
  rows: T[],
  opts: RegisterPrePhotoHealOpts,
): RegisterPrePhotoHealResult<T> {
  const notes: RegisterPrePhotoHealNote[] = []
  if (!rows.length) return { rows, notes, reappliedKeywords: false }
  const lane: RegisterAdminLane = opts.lane ?? 'package'
  const isFit = lane === 'air_hotel_free'

  let working: T[] = rows.map((row) => {
    const kw = sanitizeLandmarkKeyword(row.imageKeyword, isFit)
    const kw2 = sanitizeLandmarkKeyword(row.imageKeyword2, isFit)
    if (String(row.imageKeyword ?? '').trim() && !kw) {
      notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'lodging_or_non_landmark' })
    }
    if (String(row.imageKeyword2 ?? '').trim() && !kw2) {
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'lodging_or_non_landmark' })
    }
    return {
      ...row,
      imageKeyword: kw,
      imageKeyword2: kw2 || null,
    }
  })

  // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: route scrub + 선상 description — manifest
  working = working.map((row) => {
    const beforeRoute = String(row.routeText ?? '')
    const beforeDesc = String(row.description ?? '')
    const next = scrubOceanCruiseAtSeaScheduleRow(row, opts.productHaystack) as T
    if (String(next.routeText ?? '') !== beforeRoute || String(next.title ?? '') !== String(row.title ?? '')) {
      notes.push({ day: Number(row.day), field: 'title', reason: 'ocean_cruise_at_sea_route_scrub' })
    }
    if (
      isOceanCruiseAtSeaRoute(next.routeText) &&
      String(next.description ?? '') !== beforeDesc
    ) {
      notes.push({ day: Number(row.day), field: 'description', reason: 'ocean_cruise_at_sea_description' })
    }
    return next
  })

  const destHay = registerPrePhotoPlaceDestHay(opts.productDestination, opts.productTitle)
  if (destHay) {
    working = working.map((row) => {
      const kw = String(row.imageKeyword ?? '').trim()
      const kw2 = String(row.imageKeyword2 ?? '').trim()
      const dropKw = Boolean(
        kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, working),
      )
      const dropKw2 = Boolean(
        kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, working),
      )
      if (dropKw) notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'wrong_country' })
      if (dropKw2) notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'wrong_country' })
      return {
        ...row,
        imageKeyword: dropKw ? '' : row.imageKeyword,
        imageKeyword2: dropKw2 ? null : row.imageKeyword2,
      }
    })
  }

  working = working.map((row) => {
    if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
    notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
    return { ...row, imageKeyword2: null }
  })

  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: 식사·항공·비명소 kw2는 검증 전에 비움 — manifest
  working = working.map((row) => {
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    if (!kw2) return row
    if (
      isBrokenRegisterLandmarkKeyword(kw2, { allowHotelLodging: isFit }) ||
      isAirlineCarrierImageKeyword(kw2)
    ) {
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'lodging_or_non_landmark' })
      return { ...row, imageKeyword2: null }
    }
    return row
  })

  let reappliedKeywords = false
  if (isFit) {
    const maxFitDay = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
    const activeFit = working.filter((r) => Number(r.day) > 0).length
    working = working.map((row) => {
      const day = Number(row.day)
      const slot = resolveScheduleKeywordSlotKind(day, maxFitDay, activeFit)
      if (!registerScheduleDayRequiresPrimaryImageKeyword(slot, row.routeText)) return row
      if (String(row.imageKeyword ?? '').trim()) return row
      const filled = refillFitKeywordFromDayRoute(row, destHay, working)
      if (!filled) return row
      notes.push({ day, field: 'imageKeyword', reason: 'fit_route_refill' })
      reappliedKeywords = true
      return { ...row, imageKeyword: filled }
    })
    working = working.map((row) => {
      if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
      return { ...row, imageKeyword2: null }
    })
    // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: FIT도 당일 route 밖 키워드 제거 — manifest
    working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
    working = refillEmptyMiddleRouteFromDest(working, destHay)
    working = refillEmptyMiddleKeywordFromRoute(working, destHay)
    working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
    working = stripOffTripReturnHubRoute(working, destHay)
    // REGRESSION-FREEZE[register-aurora-primary-image-keyword]: FIT도 오로라 primary 1회 — manifest
    working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]
    // REGRESSION-FREEZE[register-pre-photo-heal-verify-align]: FIT도 출발일·own-route 재정렬 — manifest
    working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
    working = promoteEmptyMiddlePrimaryFromKeyword2(working)
    working = refillEmptyMiddleRouteFromDest(working, destHay)
    working = refillEmptyMiddleKeywordFromRoute(working, destHay)
    working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
    working = ensureDepartureReturnVisitCityKeywords(
      working,
      opts.productDestination,
    ) as T[]
    working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]
    working = alignMiddleKeywordsToVerifyGate(working, destHay, opts.productTitle)
    const maxFitDesc = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
    const fitRepeatedCloser = tripDaysSharingTemplateCloser(working)
    working = working.map((row) => {
      const before = String(row.description ?? '').trim()
      const force = fitRepeatedCloser.has(Number(row.day))
      const description = healDescription(row, maxFitDesc, force, opts.productHaystack, { fit: true })
      if (description !== before) {
        notes.push({
          day: Number(row.day),
          field: 'description',
          reason: force ? 'repeated_closer_resynth' : 'filler_or_duplicate_resynth',
        })
      }
      return { ...row, description }
    })
    // if (scheduleHasBrokenKeywords(working)) — FIT도 깨진 키워드면 parser_fix
    if (scheduleHasBrokenKeywords(working, { allowHotelLodging: true, destHay })) {
      notes.push({ day: 0, field: 'imageKeyword', reason: 'parser_fix_required' })
    }
    return { rows: working, notes, reappliedKeywords }
  }

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-filled-keywords]: 깨진/빈 중간일만 SSOT 재적용 — manifest
  if (
    scheduleHasBrokenKeywords(working, {
      productTitle: opts.productTitle,
      destHay,
      requireFreeDayRecommended: true,
    })
  ) {
    const applied = applyRegisterScheduleImageKeywordsBySupplier(
      working.map((row) => ({
        day: Number(row.day) || 0,
        title: row.title != null ? String(row.title) : undefined,
        description: row.description != null ? String(row.description) : undefined,
        routeText: row.routeText ?? null,
        imageKeyword: row.imageKeyword ?? '',
        imageKeyword2: row.imageKeyword2 ?? null,
      })),
      {
        supplierKey: opts.supplierKey,
        productDestination: opts.productDestination,
        productTitle: opts.productTitle,
        travelScope: 'package',
      },
    )
    reappliedKeywords = true
    const byDay = new Map(applied.map((r) => [Number(r.day), r]))
    working = working.map((row) => {
      const a = byDay.get(Number(row.day))
      if (!a) return row
      return {
        ...row,
        imageKeyword: sanitizeLandmarkKeyword(a.imageKeyword),
        imageKeyword2: sanitizeLandmarkKeyword(a.imageKeyword2) || null,
      }
    })
    if (destHay) {
      working = working.map((row) => {
        const kw = String(row.imageKeyword ?? '').trim()
        const kw2 = String(row.imageKeyword2 ?? '').trim()
        const dropKw = Boolean(
          kw && isRegisterScheduleCrossContinentHallucinationKeyword(kw, destHay, working),
        )
        const dropKw2 = Boolean(
          kw2 && isRegisterScheduleCrossContinentHallucinationKeyword(kw2, destHay, working),
        )
        if (dropKw) notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'wrong_country' })
        if (dropKw2) notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'wrong_country' })
        return {
          ...row,
          imageKeyword: dropKw ? '' : row.imageKeyword,
          imageKeyword2: dropKw2 ? null : row.imageKeyword2,
        }
      })
    }
    working = working.map((row) => {
      if (!isRegisterScheduleSameDayKeywordCountryClash(row.imageKeyword, row.imageKeyword2)) return row
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_day_country_clash' })
      return { ...row, imageKeyword2: null }
    })
  }

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 중간일 primary 공란·kw2 있으면 승격 — manifest
  // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: apply 트립 블리드를 당일 route로 되돌림 — manifest
  working = promoteEmptyMiddlePrimaryFromKeyword2(working)
  working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
  working = refillEmptyMiddleRouteFromDest(working, destHay)
  working = refillEmptyMiddleKeywordFromRoute(working, destHay)
  working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
  working = stripOffTripReturnHubRoute(working, destHay)
  // REGRESSION-FREEZE[register-pending-quality-keyword-desc-departure]: keep-filled 후에도 trip dedupe — manifest
  working = enforceRegisterScheduleTripUniqueImageKeywords(
    working.map((row) => ({
      ...row,
      day: Number(row.day) || 0,
      imageKeyword: String(row.imageKeyword ?? '').trim(),
      imageKeyword2: row.imageKeyword2 ?? null,
    })),
  ) as T[]
  // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: airport·free-leisure middle post-unique refill — manifest
  working = refillAirportMiddleBareCityAfterUnique(working)
  working = refillFreeLeisureMiddleBareCityAfterUnique(working)
  // REGRESSION-FREEZE[register-ocean-cruise-product]: 힐도 출발·귀국 방문도시 soft 채움 — manifest
  working = ensureDepartureReturnVisitCityKeywords(
    working,
    opts.productDestination,
  ) as T[]
  // REGRESSION-FREEZE[register-aurora-primary-image-keyword]: 힐 경로 오로라 primary — manifest
  working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]
  working = enforceRegisterScheduleTripUniqueImageKeywords(working) as T[]
  working = refillFreeLeisureMiddleBareCityAfterUnique(working)
  working = ensureDepartureReturnVisitCityKeywords(
    working,
    opts.productDestination,
  ) as T[]
  working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]

  // REGRESSION-FREEZE[register-pre-photo-heal-verify-align]: tripUnique 후 verify 게이트에 맞춰 재정렬 — manifest
  working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
  working = promoteEmptyMiddlePrimaryFromKeyword2(working)
  working = refillEmptyMiddleRouteFromDest(working, destHay)
  working = refillEmptyMiddleKeywordFromRoute(working, destHay)
  working = dropKeywordsNotOnOwnDayRoute(working, destHay, opts.productTitle)
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: refill 후 맨도시 반복 재제거 — manifest
  working = enforceRegisterScheduleTripUniqueImageKeywords(
    working.map((row) => ({
      ...row,
      day: Number(row.day) || 0,
      imageKeyword: String(row.imageKeyword ?? '').trim(),
      imageKeyword2: row.imageKeyword2 ?? null,
    })),
  ) as T[]
  working = refillFreeLeisureMiddleBareCityAfterUnique(working)
  working = ensureDepartureReturnVisitCityKeywords(
    working,
    opts.productDestination,
  ) as T[]
  // REGRESSION-FREEZE[register-pre-photo-heal-blocked-refill]: tripUnique 후 오로라 재고정·깨진 kw2 최종 비움 — manifest
  working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]
  {
    const edgeDays = working.filter((r) => Number(r.day) > 0)
    const edgeMax = Math.max(...edgeDays.map((r) => Number(r.day)), 1)
    const edgeActive = edgeDays.length
    const tripHayForEdge = working.map((r) => String(r.routeText ?? '')).join('\n')
    working = working.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    let nextKw = kw
    let nextKw2: string | null = kw2 || null
    const slot = resolveScheduleKeywordSlotKind(Number(row.day), edgeMax, edgeActive)
    // 출발·귀국 soft-dup bare 도시( Milan / Catania )는 lodging clear로 비우지 않음
    const edgeBareSoftDup =
      (slot === 'departure' || slot === 'return') &&
      Boolean(kw) &&
      isBareCityOrCountryKeyword(kw) &&
      !shouldRejectAirlineTransitHubKeywordForTrip(kw, tripHayForEdge)
    if (
      kw &&
      isBrokenRegisterLandmarkKeyword(kw) &&
      !imageKeywordMentionsAurora(kw) &&
      !edgeBareSoftDup
    ) {
      notes.push({ day: Number(row.day), field: 'imageKeyword', reason: 'lodging_or_non_landmark' })
      nextKw = ''
    }
    if (kw2 && (isBrokenRegisterLandmarkKeyword(kw2) || isAirlineCarrierImageKeyword(kw2))) {
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'lodging_or_non_landmark' })
      nextKw2 = null
    }
    if (!nextKw && nextKw2) {
      nextKw = nextKw2
      nextKw2 = null
    }
    // REGRESSION-FREEZE[register-pending-deep-geo-kw]: 같은 날 kw==kw2 비움 — manifest
    if (
      nextKw &&
      nextKw2 &&
      normScheduleImageKeywordKey(nextKw) === normScheduleImageKeywordKey(nextKw2)
    ) {
      notes.push({ day: Number(row.day), field: 'imageKeyword2', reason: 'same_as_keyword' })
      nextKw2 = null
    }
    return { ...row, imageKeyword: nextKw, imageKeyword2: nextKw2 }
  })
  }
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 경유 허브(이스탄불·두바이) ≠ 이탈리아·시칠리아 귀국 soft-dup — manifest
  // lodging clear가 귀국 bare soft-dup을 비운 뒤 재채움 + 중간일 경유 허브 kw2 제거
  working = scrubAirlineTransitHubKeywordsOffTrip(working)
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 앙코르≠하노이 cross-country scrub — manifest
  working = scrubCrossCountrySeaKeywordsOffTrip(working)
  working = stripOffTripReturnHubRoute(working, destHay)
  working = ensureDepartureReturnVisitCityKeywords(working, opts.productDestination) as T[]
  working = scrubCrossCountrySeaKeywordsOffTrip(working)
  working = refillEmptyMiddleRouteFromDest(working, destHay)
  working = refillEmptyMiddleKeywordFromRoute(working, destHay)
  working = ensureAuroraPrimaryImageKeyword(working, opts.productTitle) as T[]
  // REGRESSION-FREEZE[register-pre-photo-keyword-own-route]: enforce/refill 후 verify 정렬 — manifest
  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: 최종 middle 맨도시·kw2 정리 — manifest
  working = alignMiddleKeywordsToVerifyGate(working, destHay, opts.productTitle)
  // REGRESSION-FREEZE[register-pre-photo-pkg-middle-kw-fill]: align 후에도 공항·호텔·자유휴양 중간일 bare 재주입 — manifest
  working = refillAirportMiddleBareCityAfterUnique(working)
  working = refillHotelTitleMiddleBareCityAfterUnique(working, destHay)
  working = refillFreeLeisureMiddleBareCityAfterUnique(working)

  // REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 키워드 파이프 후 전일해상 재고정 — manifest
  working = working.map(
    (row) => scrubOceanCruiseAtSeaScheduleRow(row, opts.productHaystack) as T,
  )

  // REGRESSION-FREEZE[register-pre-photo-bare-city-middle-repeat]: used bare reinject 금지·허브 팩 — manifest
  {
    const scrub = scrubPoisonedScheduleDayTitlesForCountryKey({
      countryKey: opts.countryKey,
      rows: working,
    })
    if (scrub.scrubbedDays.length) {
      working = scrub.rows as T[]
      for (const d of scrub.scrubbedDays) {
        notes.push({ day: d, field: 'title', reason: 'hub_poison_scrub' })
      }
    }
  }

  if (
    scheduleHasBrokenKeywords(working, {
      productTitle: opts.productTitle,
      destHay,
      requireFreeDayRecommended: true,
    })
  ) {
    notes.push({ day: 0, field: 'imageKeyword', reason: 'parser_fix_required' })
  }

  const maxDay = Math.max(...working.map((r) => Number(r.day)).filter((d) => d > 0), 1)
  // REGRESSION-FREEZE[register-schedule-description-no-repeated-closer]: 같은 closer 일차 강제 재합성 — manifest
  const repeatedCloserDays = tripDaysSharingTemplateCloser(working)
  working = working.map((row) => {
    const before = String(row.description ?? '').trim()
    const force = repeatedCloserDays.has(Number(row.day))
    const description = healDescription(row, maxDay, force, opts.productHaystack)
    if (description !== before) {
      notes.push({
        day: Number(row.day),
        field: 'description',
        reason: force ? 'repeated_closer_resynth' : 'filler_or_duplicate_resynth',
      })
    }
    return { ...row, description }
  })

  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 같은 날 kw==kw2 최종 비움 — manifest
  // refill·align·aurora 이후 재주입된 동일 kw2만 제거 — 최종 trip-unique enforce는
  // 출발·귀국 soft-dup(홍콩·장가계)을 비워 day1_departure_keyword_empty 회귀를 만드므로 쓰지 않음.
  working = scrubSameDayDuplicateImageKeyword2(working)
  // REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: 앙코르≠하노이 cross-country scrub — manifest
  working = scrubCrossCountrySeaKeywordsOffTrip(working)
  working = scrubAirlineTransitHubKeywordsOffTrip(working)
  // scrub이 출발·귀국을 비우면 soft-dup 재채움 (홍콩 day1 / 장가계 귀국 KL 제거 후)
  working = ensureDepartureReturnVisitCityKeywords(working, opts.productDestination) as T[]
  working = scrubCrossCountrySeaKeywordsOffTrip(working)
  working = scrubSameDayDuplicateImageKeyword2(working)

  return { rows: working, notes, reappliedKeywords }
}

const OBVIOUS_BROKEN_URL_RE = /^(?:undefined|null|n\/a|#)$/i

/** 네트워크 HEAD 없이 형식만. 404 검사는 probeRegisterScheduleImageUrl. */
export function isObviouslyBrokenScheduleImageUrl(url: string | null | undefined): boolean {
  const t = String(url ?? '').trim()
  if (!t) return false
  if (OBVIOUS_BROKEN_URL_RE.test(t)) return true
  if (/^(?:javascript:|data:)/i.test(t)) return true
  if (!/^https?:\/\//i.test(t)) return true
  return false
}

export async function probeRegisterScheduleImageUrl(
  url: string | null | undefined,
  timeoutMs = 2500,
): Promise<'ok' | 'broken' | 'empty'> {
  const t = String(url ?? '').trim()
  if (!t) return 'empty'
  if (isObviouslyBrokenScheduleImageUrl(t)) return 'broken'
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(t, { method: 'HEAD', redirect: 'follow', signal: ac.signal })
    if (res.status === 404 || res.status === 410 || res.status >= 500) return 'broken'
    if (res.ok || res.status === 405 || res.status === 403) return 'ok'
    const getRes = await fetch(t, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { Range: 'bytes=0-0' },
    })
    if (getRes.status === 404 || getRes.status === 410) return 'broken'
    return getRes.ok ? 'ok' : 'broken'
  } catch {
    return 'broken'
  } finally {
    clearTimeout(timer)
  }
}
