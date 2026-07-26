/**
 * 하나투어 2030(구 밍글링) TRP 패키지 — 일정·제목 정제 SSOT.
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: 2030 routeText POI·vibe·제목·confirm 가드 — manifest
 */
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-hanatour'
import { classifyHanatourScheduleCardDayKind } from '@/lib/hanatour-schedule-card-day-kind'
import {
  cleanRegisterScheduleRoutePlaceLabel,
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
} from '@/lib/register-schedule-route-place-noise'
import { SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX } from '@/lib/supplier-product-title-display'
import {
  SPORTS_THEME_TAG_VALUES,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'
import {
  isHanatour2030ProductTitle,
  resolveHanatour2030ProductTitleForDetect,
} from '@/lib/product-adult-only-2030'

export {
  isHanatour2030ProductTitle,
  resolveHanatour2030ProductTitleForDetect,
} from '@/lib/product-adult-only-2030'

const HANATOUR_2030_PLACE_NOISE_RE =
  /밍글|mingling|미션|모여라|친구\s*만들기|여행러버|밍글링\s*투어|밍글링\s*타임|밍글링\s*친구|현지투어플러스|everyday\s*맞춤|Late\s*Night|Sunset\s*Chill|업로드|인생샷\s*가능|추천\s*일정|포토\s*스팟|포토스팟|자유\s*시간|속\s*밍글|MD와|feat\.|노미타베|호다이|일정식\s*요리|체크\s*인\s*후|낭만가득|대표\s*번화가|현대식\s*쇼핑|쇼핑\s*메카|초특가|유류비|내가\s*만들어서|타코야키|명물\s*체험|더\s*특별한|짐\s*풀고|바로\s*GO|에어아시아|AirAsia|출발\s*및\s*인천|인천\s*귀국|^\s*귀국\s*$|손글씨|기획자|전\s*일정\s*동반|안심\s*여행|세부\s*소개|상품\s*소개|호핑\s*식사|식사$/i

const HANATOUR_2030_META_CARD_RE =
  /출입국|입국\s*절차|입국\s*안내|조식\s*안내|여행자보험|면세|항공\s*안내|미주지역\s*호텔|방문객\s*출입국/i

/** CMS 손글씨·버전 접미 — POI 본문만 남긴다. */
const HANATOUR_2030_HANDWRITING_SUFFIX_RE = /[_\s]*손글씨\s*(?:버전)?.*$/iu
const HANATOUR_2030_MEAL_TAIL_RE = /\s*(?:특식|선상식|자유식|식사|런치|조식|중식|석식)\s*$/u

const HANATOUR_2030_FREE_DAY_RE = /자유\s*일정|자유일정|1\s*일\s*자유|2\s*일\s*자유/i

type Hanatour2030RegionProfile =
  | 'japan'
  | 'southeast_asia'
  | 'vietnam'
  | 'europe'
  | 'americas'
  | 'mongolia_china'
  | 'generic'

const HANATOUR_2030_VIBE_BY_REGION: Record<
  Hanatour2030RegionProfile,
  { tourism: readonly string[]; arrival: readonly string[]; returnDay: readonly string[]; free: readonly string[] }
> = {
  japan: {
    arrival: [
      '현지에 도착한 뒤 도심을 걸으며 일정 리듬을 맞추는 첫날입니다.',
      '이자카야·골목·야경을 함께 즐기기 좋고, 쇼핑 강요 없이 거리 분위기에 집중하는 2030형 구성입니다.',
    ],
    tourism: [
      '도심과 근교를 오가며 걷기 좋은 동선입니다.',
      '식사·카페·사진 포인트를 골라가며, 동행자와 속도를 맞추기 좋은 2030 리듬입니다.',
    ],
    free: [
      '일정에 묶이지 않고 카페·골목·야경을 각자 또는 함께 채우는 하루입니다.',
      '또래와 동선을 맞추기 좋은 여유 시간이 포함된 구성입니다.',
    ],
    returnDay: [
      '랜드마크와 로컬 거리를 걸으며 마무리하는 하루입니다.',
      '마지막까지 무리한 쇼핑 없이 장면 위주로 정리되며, 귀국 동선으로 이어집니다.',
    ],
  },
  southeast_asia: {
    arrival: [
      '현지 도착 후 해변·시내 리듬에 맞추는 첫날입니다.',
      '저녁에는 함께 걷기 좋은 거리 분위기를 즐기기 좋은 2030형 구성입니다.',
    ],
    tourism: [
      '해변·섬·시장을 오가는 활동 중심 하루입니다.',
      '사진과 휴식의 밸런스가 좋고, 저녁에는 자유롭게 비치·야시장으로 이어지기 쉬운 리듬입니다.',
    ],
    free: [
      '비치·리조트·야시장을 각자 또는 함께 채우는 자유 일정입니다.',
      '2030 상품 특성상 무리한 쇼핑 동선 없이 여유를 두는 구성입니다.',
    ],
    returnDay: [
      '여정을 정리하고 귀국하는 마무리 일정입니다.',
      '이동에 집중하는 차분한 하루로, 여행의 리듬을 자연스럽게 마칩니다.',
    ],
  },
  vietnam: {
    arrival: [
      '현지에 도착해 거리 분위기에 적응하는 첫날입니다.',
      '로컬 식사와 산책을 함께 즐기기 좋은 2030형 리듬입니다.',
    ],
    tourism: [
      '현지 분위기를 천천히 음미하는 동선입니다.',
      '단체 쇼핑보다 거리·시장·전망에 무게를 두는 하루입니다.',
    ],
    free: [
      '시내·카페·야시장을 자유롭게 채우는 하루입니다.',
      '동행자와 속도를 맞추기 좋은 여유 시간이 보장됩니다.',
    ],
    returnDay: [
      '마무리 관광 뒤 귀국 동선으로 이어지는 하루입니다.',
      '쇼핑 강요 없이 이동에 집중하는 차분한 마무리입니다.',
    ],
  },
  europe: {
    arrival: [
      '유럽 도시에 도착해 첫 동선을 익히는 날입니다.',
      '도보 중심으로 분위기를 느끼기 좋은 2030형 구성입니다.',
    ],
    tourism: [
      '역사와 도시 풍경을 걸으며 음미하는 하루입니다.',
      '이동마다 분위기가 바뀌어 사진과 산책을 함께 즐기기 좋습니다.',
    ],
    free: [
      '박물관·카페·야경을 각자 취향대로 채우는 자유 일정입니다.',
      '함께 걷기 좋은 거리와 개별 여유가 균형 잡힌 하루입니다.',
    ],
    returnDay: [
      '도시를 정리하고 귀국길로 이어지는 마무리 일정입니다.',
      '여유 있는 리듬으로 여정을 마칩니다.',
    ],
  },
  americas: {
    arrival: [
      '현지 도착 후 도심 리듬에 맞추는 첫날입니다.',
      '카페·전망·산책을 함께 즐기기 좋은 2030형 구성입니다.',
    ],
    tourism: [
      '맨해튼·랜드마크를 걸어보는 하루입니다.',
      '브런치·미술관·야경을 각자 또는 함께 채우기 좋은 리듬입니다.',
    ],
    free: [
      '자유 일정으로 골목·뮤지엄·카페를 채우는 하루입니다.',
      '2030 상품 특성상 또래와 동선을 맞추기 좋은 여유가 포함됩니다.',
    ],
    returnDay: [
      '마무리 장면을 담고 귀국하는 하루입니다.',
      '이동 중심으로 차분하게 여정을 마칩니다.',
    ],
  },
  mongolia_china: {
    arrival: [
      '현지 도착 후 일정 리듬을 맞추는 첫날입니다.',
      '대자연·도시 체험이 이어지기 전, 무리 없이 적응하는 구성입니다.',
    ],
    tourism: [
      '초원·사막·도시 체험이 어우러지는 하루입니다.',
      '풍경과 함께하는 시간에 집중하는 2030형 리듬입니다.',
    ],
    free: [
      '자유 시간으로 풍경·체험을 각자 채우는 하루입니다.',
      '공동 체험과 여유가 균형 잡힌 구성입니다.',
    ],
    returnDay: [
      '일출·체험을 마치고 귀국 동선으로 이어지는 하루입니다.',
      '이동에 집중하는 차분한 마무리입니다.',
    ],
  },
  generic: {
    arrival: [
      '현지에 도착해 일정 리듬을 맞추는 첫날입니다.',
      '동행자와 함께 걷기 좋은 분위기로, 이후 일정을 위한 여유를 두는 구성입니다.',
    ],
    tourism: [
      '하루 동안 여러 장면이 자연스럽게 이어지는 동선입니다.',
      '사진·카페·산책을 함께 즐기기 좋은 2030 리듬입니다.',
    ],
    free: [
      '자유 일정으로 각자 또는 함께 동선을 채우는 하루입니다.',
      '무리한 쇼핑 없이 여유를 두는 구성입니다.',
    ],
    returnDay: [
      '여정을 정리하고 귀국하는 마무리 일정입니다.',
      '차분한 리듬으로 여행을 마칩니다.',
    ],
  },
}

function isHanatour2030PlaceNoise(label: string): boolean {
  const t = label.trim()
  if (!t || t.length < 2) return true
  if (isRegisterScheduleRoutePlaceNoise(t)) return true
  if (HANATOUR_2030_META_CARD_RE.test(t)) return true
  if (HANATOUR_2030_PLACE_NOISE_RE.test(t)) return true
  if (/^✨|LIGHT$/i.test(t)) return true
  if (/^Dormy\s*Inn|^HENANN|^Hotel\s+Villa|^Candeo\s*Hotels/i.test(t)) return true
  if (/^(?:조식|중식|석식|석식\s*후|일정식)$/u.test(t)) return true
  return false
}

function pickHanatour2030PlaceAfterComma(t: string): string | null {
  if (!/[,，]/.test(t)) return null
  const parts = t
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const tail = parts[parts.length - 1]!
  return tail.length >= 2 ? tail : null
}

/** 2030 카드 라벨 → routeText용 POI (밍글링·미션·안내 카드 제외). */
export function extractHanatour2030PoiFromCardLabel(raw: string): string | null {
  let t = cleanRegisterScheduleRoutePlaceLabel(String(raw ?? ''))
  if (!t) return null

  // REGRESSION-FREEZE[hanatour-register-schedule-2030]: strip 손글씨·식사 접미 — manifest
  t = t.replace(HANATOUR_2030_HANDWRITING_SUFFIX_RE, '').trim()
  t = t.replace(HANATOUR_2030_MEAL_TAIL_RE, '').trim()
  t = t.replace(/[_\s]+$/g, '').trim()
  if (!t) return null

  const inlineParenKo = t.match(/([가-힣]{2,16})\s*\(([^)]+)\)\s*$/)
  if (inlineParenKo) {
    const ko = inlineParenKo[1]!.trim()
    if (!isHanatour2030PlaceNoise(ko)) return ko
  }

  const parenMatch = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const ko = parenMatch[1]!
      .replace(/^[^가-힣0-9A-Za-z]*#?/u, '')
      .replace(/^(?:인생샷\s*가능!?|자연이\s*만들어낸\s*신비로운\s*절경)\s*/i, '')
      .trim()
    if (ko.length >= 2 && ko.length <= 28 && !isHanatour2030PlaceNoise(ko)) return ko
    const en = parenMatch[2]!.trim()
    if (en.length >= 2 && en.length <= 40 && !isHanatour2030PlaceNoise(en)) return en
  }

  t = t.replace(/^(?:인생샷\s*가능!?|자연이\s*만들어낸\s*신비로운\s*절경)\s*/i, '')
  t = t.replace(/^#+/g, '').trim()

  if (t.includes('#')) {
    const parts = t
      .split('#')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const part of parts) {
      const p = cleanRegisterScheduleRoutePlaceLabel(part)
      if (p && !isHanatour2030PlaceNoise(p) && p.length >= 2 && p.length <= 32) return p
    }
    return null
  }

  const commaPick = pickHanatour2030PlaceAfterComma(t)
  if (commaPick) {
    const fromComma = extractHanatour2030PoiFromCardLabel(commaPick)
    if (fromComma) return fromComma
    if (!isHanatour2030PlaceNoise(commaPick)) return commaPick
  }

  if (isHanatour2030PlaceNoise(t)) return null
  if (t.length > 48) return null
  return t
}

export function filterHanatour2030FactScheduleDays(
  days: RegisterFactScheduleDay[],
  productTitle?: string | null,
): RegisterFactScheduleDay[] {
  if (!isHanatour2030ProductTitle(productTitle)) return days
  return days.map((d) => {
    const pois: string[] = []
    const seen = new Set<string>()
    for (const raw of d.places) {
      // CMS가 `A - B - C`를 한 칸에 넣으면 세그먼트별로 POI 추출 (title=route 복붙 soft 방지)
      const chunks = String(raw ?? '')
        .split(/\s+-\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const chunk of chunks.length > 0 ? chunks : [String(raw ?? '')]) {
        const poi = extractHanatour2030PoiFromCardLabel(chunk)
        if (!poi) continue
        const key = poi.toLowerCase().replace(/\s+/g, '')
        if (seen.has(key)) continue
        seen.add(key)
        pois.push(poi)
      }
    }
    return { ...d, places: pois }
  })
}

function inferHanatour2030RegionProfile(productTitle: string, routePlaces: string[]): Hanatour2030RegionProfile {
  const blob = `${productTitle} ${routePlaces.join(' ')}`
  if (/일본|도쿄|오사카|교토|고베|이네|홋카이도|오키나와|미야자키|후쿠오카|나라|히로시마/u.test(blob)) return 'japan'
  if (/뉴욕|미동부|미서부|하와이|캐나다|미국|LA|보스턴/u.test(blob)) return 'americas'
  if (/터키|프라하|체코|오스트리아|스위스|유럽|이스탄불|카파도키아/u.test(blob)) return 'europe'
  if (/몽골|오르도스|초원|사막|상해|청두|대만|타이베이|카자흐/u.test(blob)) return 'mongolia_china'
  if (/하노이|사파|나트랑|푸꾸옥|베트남|다낭/u.test(blob)) return 'vietnam'
  if (/보홀|세부|발리|싱가포르|방콕|필리핀|코타키나발루|라오스|말레이/u.test(blob)) return 'southeast_asia'
  return 'generic'
}

import {
  firstRegisterDestinationPlaceFromTitleHead,
} from '@/lib/register-destination-tour-style-noise'

function extractHanatour2030CityFromTitle(productTitle: string): string | null {
  // REGRESSION-FREEZE[register-destination-reject-ilju]: bare 일주/개국 일주 금지 — manifest
  const cleaned = productTitle.replace(/\[?\s*2030\s*전용\s*\]?/gi, '').trim()
  const m = cleaned.match(/([가-힣A-Za-z][가-힣A-Za-z·\s/／]{0,50}?)\s*\d+\s*일/)
  if (m?.[1]) return firstRegisterDestinationPlaceFromTitleHead(m[1])
  return null
}

function composeHanatour2030DayTitle(args: {
  day: number
  maxDay: number
  routePlaces: string[]
  dayKind: ReturnType<typeof classifyHanatourScheduleCardDayKind>
  productTitle: string
  transportNote: string | null
}): string {
  // REGRESSION-FREEZE[hanatour-register-schedule-2030]: no bare N일차 / no return-phrase double — manifest
  const { day, maxDay, routePlaces, dayKind, productTitle, transportNote } = args
  const city = extractHanatour2030CityFromTitle(productTitle)

  if (day === 1) {
    if (routePlaces.length >= 2) return `${routePlaces[0]} · ${routePlaces[1]}`
    const place = routePlaces[0] ?? city
    if (place && city && place !== city) return `${city} 입국 · ${place}`
    if (place) return `${place} 입국`
    return city ? `${city} 입국` : `${day}일차`
  }
  if (
    dayKind === 'return_home' ||
    (day === maxDay && routePlaces.length === 0) ||
    (day === maxDay && /인천|ICN|귀국/u.test(transportNote ?? ''))
  ) {
    const rawFrom = routePlaces[routePlaces.length - 1] ?? city ?? '현지'
    const from =
      rawFrom
        .replace(/\s*출발\s*및\s*인천\s*귀국.*$/u, '')
        .replace(/\s*귀국.*$/u, '')
        .trim() ||
      city ||
      '현지'
    if (/출발\s*및\s*인천\s*귀국/u.test(rawFrom) && /인천|ICN/u.test(rawFrom)) return rawFrom
    return `${from} 출발 및 인천 귀국`
  }
  if (routePlaces.some((p) => HANATOUR_2030_FREE_DAY_RE.test(p)) || /자유\s*일정/u.test(transportNote ?? '')) {
    return `자유 일정 · ${city ?? routePlaces[0] ?? '현지'}`
  }
  if (routePlaces.length >= 2) return `${routePlaces[0]} · ${routePlaces[1]}`
  if (routePlaces.length === 1) {
    const p = routePlaces[0]!
    return p.length < 4 ? `${p} 시내` : p
  }
  return `자유 일정 · ${city ?? '현지'}`
}

function composeHanatour2030DayDescription(args: {
  day: number
  maxDay: number
  routePlaces: string[]
  dayKind: ReturnType<typeof classifyHanatourScheduleCardDayKind>
  productTitle: string
}): string {
  const profile = inferHanatour2030RegionProfile(args.productTitle, args.routePlaces)
  const vibes = HANATOUR_2030_VIBE_BY_REGION[profile]
  const { dayKind, routePlaces } = args

  if (routePlaces.some((p) => HANATOUR_2030_FREE_DAY_RE.test(p))) {
    return vibes.free.slice(0, 2).join(' ')
  }
  if (args.day === 1 || (dayKind === 'movement' && args.day === 1)) {
    return vibes.arrival.slice(0, 2).join(' ')
  }
  if (dayKind === 'return_home' || (args.day === args.maxDay && routePlaces.length === 0)) {
    return vibes.returnDay.slice(0, 2).join(' ')
  }
  if (args.day === args.maxDay && /인천|ICN|귀국/u.test(routePlaces.join(' '))) {
    return vibes.returnDay.slice(0, 2).join(' ')
  }
  if (routePlaces.length === 0) {
    return vibes.free.slice(0, 2).join(' ')
  }
  return vibes.tourism.slice(0, 2).join(' ')
}

function buildHanatour2030RouteText(
  factDay: RegisterFactScheduleDay,
  routePlaces: string[],
  dayKind: ReturnType<typeof classifyHanatourScheduleCardDayKind>,
  maxDay: number,
  productTitle: string,
): string {
  // REGRESSION-FREEZE[hanatour-register-schedule-2030]: bare city middle ≠ hard-short route — manifest
  const transport = String(factDay.transportNote ?? '').trim()
  const cityFromTitle = extractHanatour2030CityFromTitle(productTitle)
  if (routePlaces.some((p) => HANATOUR_2030_FREE_DAY_RE.test(p))) {
    const city =
      routePlaces.find((p) => !HANATOUR_2030_FREE_DAY_RE.test(p)) ?? cityFromTitle ?? routePlaces[0]
    return city ? `${city} 자유 일정` : '자유 일정'
  }
  // 자유 일정 transportNote + bare city place — title「자유 일정 · 도시」와 route 정합
  if (/자유\s*일정/u.test(transport) && routePlaces.length <= 1) {
    const city =
      routePlaces.find((p) => !HANATOUR_2030_FREE_DAY_RE.test(p)) ?? cityFromTitle
    if (city) return `${city} 자유 일정`
  }
  if (routePlaces.length === 1) {
    const p = routePlaces[0]!
    // 「뉴욕」등 2~3글자 bare city — sanitize가 축약해도 시내 접미 유지
    if (p.length < 4) return `${p} 시내`
    return sanitizeRegisterScheduleRouteText(p, 4) ?? p
  }
  if (routePlaces.length > 1) {
    return sanitizeRegisterScheduleRouteText(routePlaces.join(' - '), 4) ?? routePlaces.join(' - ')
  }
  if (transport.includes(' - ')) {
    // 「뉴욕; 뉴욕 - 인천」처럼 세미콜론 앞이 bare city이고 뒤에 귀국 체인이 붙은 오염 —
    // first chunk만 쓰면 live gate soft(bare city short). 관광 체인일 때만 채택.
    const first = transport.split(';')[0]!.trim()
    if (first.includes(' - ') || first.length >= 4) {
      return first
    }
  }
  if (factDay.day === maxDay || dayKind === 'return_home') {
    return cityFromTitle ? `${cityFromTitle} 출발 및 인천 귀국` : '인천'
  }
  if (factDay.day === 1) {
    // REGRESSION-FREEZE[hanatour-register-schedule-2030]: Day1 hotel→막탄 seed for APP221 kw — manifest
    const hotelBlob = (factDay.hotels ?? []).join(' ')
    if (/막탄|Mactan|Mövenpick|Movenpick|뫼벤픽/iu.test(hotelBlob)) {
      return cityFromTitle ? `${cityFromTitle} 막탄` : '막탄'
    }
    return cityFromTitle ? `${cityFromTitle} 입국` : ''
  }
  return cityFromTitle ? `${cityFromTitle} 자유 일정` : '자유 일정'
}

/** 2030 상품 — factDays 기반으로 schedule title·routeText·description 재구성. */
export function applyHanatour2030SchedulePolish(args: {
  schedule: RegisterScheduleDay[]
  factDays: RegisterFactScheduleDay[]
  productTitle: string
}): RegisterScheduleDay[] {
  if (!isHanatour2030ProductTitle(args.productTitle)) return args.schedule
  const filteredFacts = filterHanatour2030FactScheduleDays(args.factDays, args.productTitle)
  const maxDay = Math.max(...filteredFacts.map((d) => d.day), 0)
  const factByDay = new Map(filteredFacts.map((d) => [d.day, d]))

  return args.schedule.map((row) => {
    const fact = factByDay.get(row.day)
    if (!fact) return row
    const routePlaces = fact.places
    const joined = [fact.transportNote ?? '', ...routePlaces, ...fact.hotels].filter(Boolean).join(' ')
    const dayKind = classifyHanatourScheduleCardDayKind(fact.day, maxDay, joined)
    const routeText = buildHanatour2030RouteText(
      fact,
      routePlaces,
      dayKind,
      maxDay,
      args.productTitle,
    )
    const title = composeHanatour2030DayTitle({
      day: fact.day,
      maxDay,
      routePlaces,
      dayKind,
      productTitle: args.productTitle,
      transportNote: fact.transportNote,
    })
    const description = composeHanatour2030DayDescription({
      day: fact.day,
      maxDay,
      routePlaces,
      dayKind,
      productTitle: args.productTitle,
    })
    // REGRESSION-FREEZE[hanatour-register-schedule-2030]: never keep pre-polish mingling route/title — manifest
    return {
      ...row,
      title,
      routeText,
      description: description || row.description,
    }
  })
}

const HANATOUR_2030_TITLE_SOCIAL_HASH_RE =
  /^(?:또래\s*친구\s*만들기|여행러버\s*모여라|밍글링\s*Light|밍글링\s*LIGHT|밍글밍|2030\s*전용|일본감성\s*풀충전|주류무한\s*이자카야|공항.?호텔\s*왕복\s*송영)$/i

/** 2030 TRP — 마케팅 해시 제거·(2030) 접미(상한 내 접미 보존). */
export function normalizeHanatour2030ListingTitle(s: string): string {
  const suffix = ' (2030)'
  const bodyMax = Math.max(24, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX - suffix.length)

  let t = String(s ?? '')
    .replace(/\[\s*2030\s*전용\s*\]/gi, ' ')
    .replace(/\[?\s*2030\s*전용\s*\]?/gi, ' ')
    .replace(/#?\s*밍글링\s*(?:Light|LIGHT)?/gi, ' ')
    .replace(/#?\s*밍글밍/gi, ' ')
    .replace(/#또래\s*친구\s*만들기/gi, ' ')
    .replace(/#여행러버\s*모여라/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 공백 없는 해시 + 공백 포함 해시(#또래 친구 만들기) 모두 제거 후보
  t = t.replace(/#[^\s#]+(?:\s+[^\s#]+)*/g, (m) => {
    const body = m.slice(1).trim()
    return HANATOUR_2030_TITLE_SOCIAL_HASH_RE.test(body) ? ' ' : m
  })
  // 남은 관광 해시가 상한을 잡아 (2030) 접미가 잘리지 않도록 전부 제거
  t = t.replace(/#[^\s#]+(?:\s+[^\s#]+)*/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(/\bLight\b/gi, ' ').replace(/\s+/g, ' ').trim()
  t = t.replace(/\//g, '·')
  t = t.replace(/\(\s*2030\s*\)\s*$/i, '').trim()
  // REGRESSION-FREEZE[hanatour-register-schedule-2030]: keep (2030) within title max — manifest
  if (t.length > bodyMax) t = t.slice(0, bodyMax).trim()
  t = `${t}${suffix}`.trim()
  return t.slice(0, SUPPLIER_PRODUCT_DISPLAY_TITLE_MAX)
}

export function polishHanatour2030RegisterBundle(args: {
  productTitle: string
  factDays: RegisterFactScheduleDay[]
  schedule: RegisterScheduleDay[]
  listingTitle?: string
}): {
  listingTitle: string
  factDays: RegisterFactScheduleDay[]
  schedule: RegisterScheduleDay[]
} {
  if (!isHanatour2030ProductTitle(args.productTitle)) {
    return {
      listingTitle: args.listingTitle ?? args.productTitle,
      factDays: args.factDays,
      schedule: args.schedule,
    }
  }
  const factDays = filterHanatour2030FactScheduleDays(args.factDays, args.productTitle)
  const schedule = applyHanatour2030SchedulePolish({
    schedule: args.schedule,
    factDays,
    productTitle: args.productTitle,
  })
  const listingTitle = normalizeHanatour2030ListingTitle(args.listingTitle ?? args.productTitle)
  return { listingTitle, factDays, schedule }
}

const HANATOUR_2030_CONFIRM_ROUTE_TOXIC_RE =
  /밍글|mingling|미션|출입국|입국\s*절차|손글씨|기획자|전\s*일정\s*동반|안심\s*여행/i
const HANATOUR_2030_CONFIRM_TITLE_TOXIC_RE =
  /밍글|mingling|Light|LIGHT|손글씨|기획자|전\s*일정\s*동반/i
const HANATOUR_2030_CONFIRM_LISTING_MARKETING_RE = /\[?\s*2030\s*전용\s*\]?|#?\s*밍글링|#?\s*밍글밍/i

export type Hanatour2030ConfirmScheduleIssue = {
  day: number
  field: 'title' | 'routeText' | 'description' | 'listingTitle'
  reason: string
}

function normalizeHanatour2030ConfirmCompareText(s: string | null | undefined): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

function inferHanatour2030FactDaysFromSchedule(schedule: RegisterScheduleDay[]): RegisterFactScheduleDay[] {
  return schedule.map((row, index) => {
    const rawPlaces: string[] = []
    const routeText = String(row.routeText ?? '').trim()
    const title = String(row.title ?? '').trim()
    if (routeText) {
      rawPlaces.push(
        ...routeText
          .split(/\s*[-–—·]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
    } else if (title) {
      rawPlaces.push(
        ...title
          .split(/\s*[-–—·]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
    }
    return {
      day: row.day > 0 ? row.day : index + 1,
      places: rawPlaces,
      hotels: [],
      meals: [],
      transportNote: null,
    }
  })
}

/** 등록 confirm 직전 — augment 이후 schedule·제목을 2030 규칙으로 재정제. */
export function repolishHanatour2030ParsedAtRegisterConfirm(parsed: RegisterParsed): RegisterParsed {
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    parsed.supplierListingTitleRaw,
    parsed.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return parsed

  const schedule = parsed.schedule ?? []
  if (schedule.length === 0) return parsed

  const polishedSchedule = applyHanatour2030SchedulePolish({
    schedule,
    factDays: inferHanatour2030FactDaysFromSchedule(schedule),
    productTitle: detectTitle,
  })
  return {
    ...parsed,
    title: normalizeHanatour2030ListingTitle(parsed.title),
    schedule: polishedSchedule,
  }
}

/** 2030 TRP — 등록 confirm 시점 일정·제목 계약 위반 수집. */
export function collectHanatour2030RegisterScheduleConfirmIssues(
  parsed: Pick<RegisterParsed, 'title' | 'supplierListingTitleRaw' | 'schedule'>,
): Hanatour2030ConfirmScheduleIssue[] {
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    parsed.supplierListingTitleRaw,
    parsed.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return []

  const issues: Hanatour2030ConfirmScheduleIssue[] = []
  const listingTitle = String(parsed.title ?? '').trim()

  if (!/\(2030\)\s*$/i.test(listingTitle)) {
    issues.push({
      day: 0,
      field: 'listingTitle',
      reason: '2030 상품 제목에 (2030) 접미가 필요합니다.',
    })
  }
  if (HANATOUR_2030_CONFIRM_LISTING_MARKETING_RE.test(listingTitle)) {
    issues.push({
      day: 0,
      field: 'listingTitle',
      reason: '2030 상품 제목에 [2030전용]·밍글링 해시 등 마케팅 태그가 남아 있습니다.',
    })
  }

  const schedule = parsed.schedule ?? []
  if (schedule.length === 0) {
    issues.push({
      day: 0,
      field: 'routeText',
      reason: '2030 상품 일정 행이 비어 있습니다.',
    })
    return issues
  }

  for (const row of schedule) {
    const day = row.day > 0 ? row.day : 0
    const title = String(row.title ?? '')
    const routeText = String(row.routeText ?? '')
    const description = String(row.description ?? '')

    if (
      HANATOUR_2030_CONFIRM_ROUTE_TOXIC_RE.test(routeText) ||
      HANATOUR_2030_META_CARD_RE.test(routeText)
    ) {
      issues.push({
        day,
        field: 'routeText',
        reason: `D${day} routeText에 밍글링·미션·출입국 안내 문구가 포함되어 있습니다.`,
      })
    }
    if (HANATOUR_2030_CONFIRM_TITLE_TOXIC_RE.test(title)) {
      issues.push({
        day,
        field: 'title',
        reason: `D${day} title에 밍글링·Light 마케팅 문구가 포함되어 있습니다.`,
      })
    }
    if (
      routeText &&
      description &&
      normalizeHanatour2030ConfirmCompareText(description) ===
        normalizeHanatour2030ConfirmCompareText(routeText)
    ) {
      issues.push({
        day,
        field: 'description',
        reason: `D${day} description이 routeText와 동일합니다. 2030 vibe 브리프가 필요합니다.`,
      })
    }
    if (/밍글|미션/i.test(description)) {
      issues.push({
        day,
        field: 'description',
        reason: `D${day} description에 밍글링·미션 문구가 남아 있습니다.`,
      })
    }
  }

  return issues
}

export function hanatour2030RegisterScheduleOkAtConfirm(parsed: RegisterParsed): boolean {
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    parsed.supplierListingTitleRaw,
    parsed.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return true
  return collectHanatour2030RegisterScheduleConfirmIssues(parsed).length === 0
}

/**
 * 2030 TRP는 또래·성인 전용 — 아동·유아 요금 슬롯을 비운다.
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]: adult-only prices — manifest
 */
export function stripHanatour2030ChildInfantPrices(parsed: RegisterParsed): RegisterParsed {
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    parsed.supplierListingTitleRaw,
    parsed.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return parsed

  const table = parsed.productPriceTable
  const nextTable = table
    ? {
        ...table,
        childExtraBedPrice: null,
        childNoBedPrice: null,
        infantPrice: null,
      }
    : table

  const nextPrices = (parsed.prices ?? []).map((row) => {
    const next = { ...row }
    delete next.childBedBase
    delete next.childNoBedBase
    delete next.infantBase
    next.childFuel = 0
    next.infantFuel = 0
    return next
  })

  return {
    ...parsed,
    productPriceTable: nextTable,
    prices: nextPrices,
  }
}

/** preview·confirm 공통 — augment 이후 2030 재정제 + extractionFieldIssues 동기화. */
export function applyHanatour2030RegisterConfirmGuard(parsed: RegisterParsed): RegisterParsed {
  const next = stripHanatour2030ChildInfantPrices(repolishHanatour2030ParsedAtRegisterConfirm(parsed))
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    next.supplierListingTitleRaw,
    next.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return next

  const issues = collectHanatour2030RegisterScheduleConfirmIssues(next)
  const stripped = (next.extractionFieldIssues ?? []).filter(
    (i) =>
      !String(i.field).startsWith('hanatour2030.schedule') &&
      !String(i.field).startsWith('schedule.day') &&
      !String(i.field).startsWith('hanatour2030.price'),
  )
  const priceNote = {
    field: 'hanatour2030.price.adultOnly',
    reason: '2030 상품: 아동·유아 요금 슬롯을 비웠습니다(성인 전용).',
    source: 'auto' as const,
    severity: 'info' as const,
  }
  if (issues.length === 0) {
    return {
      ...next,
      extractionFieldIssues: [...stripped, priceNote],
    }
  }
  return {
    ...next,
    extractionFieldIssues: [
      ...stripped,
      priceNote,
      ...issues.map((i) => ({
        field:
          i.day > 0
            ? `hanatour2030.schedule.day${i.day}.${i.field}`
            : `hanatour2030.schedule.${i.field}`,
        reason: i.reason,
        source: 'auto' as const,
        severity: 'warn' as const,
      })),
    ],
  }
}

export function hanatour2030ConfirmScheduleBlockReason(parsed: RegisterParsed): string | null {
  const issues = collectHanatour2030RegisterScheduleConfirmIssues(parsed)
  if (issues.length === 0) return null
  const head = issues
    .slice(0, 2)
    .map((i) => i.reason)
    .join(' ')
  const more = issues.length > 2 ? ` 외 ${issues.length - 2}건` : ''
  return `2030 TRP 일정 정제 미충족: ${head}${more} 미리보기를 다시 실행하거나 본문 일정을 확인하세요.`
}

/** 하나투어 2030 TRP — confirm 시 메가메뉴·browse용 `sportsThemeTag`에 2030 자동 병합. */
export function mergeHanatour2030SportsThemeTagForRegister(
  adminTags: SportsThemeTag[],
  parsed: Pick<RegisterParsed, 'title' | 'supplierListingTitleRaw'>,
): SportsThemeTag[] {
  const detectTitle = resolveHanatour2030ProductTitleForDetect(
    parsed.supplierListingTitleRaw,
    parsed.title,
  )
  if (!isHanatour2030ProductTitle(detectTitle)) return adminTags
  const seen = new Set<string>(adminTags)
  seen.add('2030')
  return SPORTS_THEME_TAG_VALUES.filter((k) => seen.has(k))
}
