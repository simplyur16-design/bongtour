/**
 * 국내 공개 `/travel/domestic` · browse API 전용 매칭.
 * (공급사 파이프라인·파서와 분리)
 */
import { DOMESTIC_NAV_PILLARS } from '@/lib/domestic-landing-nav-data'
import { DOMESTIC_LOCATION_TREE, matchTokensForDomesticGroup } from '@/lib/domestic-location-tree'
import { toOverseasMatchInput } from '@/lib/products-browse-filter'
import { productMatchesOverseasDestinationTerms } from '@/lib/match-overseas-product'

/** `Product.displayCategory`에 이 문자열이 포함된 경우만 공개 「특별테마」 노출 */
export const DOMESTIC_SPECIAL_THEME_MARKER = '국내특별테마'

const BUS_TITLE =
  /(관광\s*버스|전용\s*버스|버스\s*여행|버스여행|전세\s*버스|셔틀\s*버스|고속\s*버스)/i
const BUS_WEAK = /(^|[^\w가-힣])버스([^\w가-힣]|$)/i

const TRAIN_TITLE =
  /(ktx|srt|itx|무궁화\s*호?|기차\s*여행|기차여행|열차\s*여행|열차여행|철도\s*여행|철도여행|레일\s*크루즈|레일크루즈|관광열차|철도망|레일\s*바이크|레일바이크)/i
const TRAIN_WEAK = /(^|[^\w가-힣])기차([^\w가-힣]|$)/i

/** 지역 메뉴 키별 제목에서 우선할 추가 토큰(트리에 없는 표기) */
const EXTRA_REGION_TITLE_TOKENS: Record<string, string[]> = {
  gangwon: ['정동진'],
  jeolla: ['군산', '전북', '전라북도'],
  gyeongsang: ['부산', '통영', '남해안', '영남'],
  jeju: ['제주도'],
  islands: ['남해안', '완도', '홍도', '흑산'],
  capital: ['서울', '경기', '인천', '수도권'],
  chungcheong: ['충북', '충남', '충청'],
}

function regionNavItem(dmItem: string) {
  const pillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === 'region')
  return pillar?.regionSecond?.find((r) => r.key === dmItem) ?? null
}

function collectRegionMatchTokens(dmItem: string, explicit?: string[]): string[] {
  const set = new Set<string>()
  for (const t of explicit ?? []) {
    const s = t.trim()
    if (s.length >= 2) set.add(s)
  }
  const row = regionNavItem(dmItem)
  const gk = row?.groupKey
  if (gk) {
    const g = DOMESTIC_LOCATION_TREE.find((x) => x.groupKey === gk)
    if (g) matchTokensForDomesticGroup(g).forEach((x) => set.add(x))
  }
  for (const x of EXTRA_REGION_TITLE_TOKENS[dmItem] ?? []) set.add(x)
  return [...set].sort((a, b) => b.length - a.length)
}

function titleHasToken(titleLower: string, tokenLower: string): boolean {
  if (tokenLower.length < 2) return false
  return titleLower.includes(tokenLower)
}

/**
 * 지역별: 제목 우선 → primaryRegion 보조 → 기존 목적지 haystack
 */
export function domesticNavRegionProductMatches(
  p: {
    title: string
    originSource?: string | null
    primaryDestination?: string | null
    destinationRaw?: string | null
    destination?: string | null
    primaryRegion?: string | null
  },
  dmItem: string,
  prefTerms: string[]
): boolean {
  const row = regionNavItem(dmItem)
  const explicit = row?.destinationTerms ?? []
  const tokens = collectRegionMatchTokens(dmItem, [...explicit, ...prefTerms])
  const titleLower = (p.title ?? '').toLowerCase()
  for (const tok of tokens) {
    const k = tok.trim().toLowerCase()
    if (titleHasToken(titleLower, k)) return true
  }
  const pr = (p.primaryRegion ?? '').trim().toLowerCase()
  if (pr) {
    for (const tok of tokens) {
      const k = tok.trim().toLowerCase()
      if (k.length >= 2 && pr.includes(k)) return true
    }
  }
  if (tokens.length === 0) return true
  return productMatchesOverseasDestinationTerms(
    toOverseasMatchInput({
      title: p.title,
      originSource: p.originSource ?? '',
      primaryDestination: p.primaryDestination ?? null,
      destinationRaw: p.destinationRaw ?? null,
      destination: p.destination ?? null,
      primaryRegion: p.primaryRegion ?? null,
    }),
    tokens
  )
}

function stripNbMDaysForStandaloneDayScan(title: string): string {
  return title.replace(/\d+\s*박\s*\d+\s*일/g, ' ')
}

function hasWeekendDeparture(departures: { departureDate: Date }[] | undefined): boolean {
  if (!departures?.length) return false
  return departures.some((d) => {
    const w = new Date(d.departureDate).getDay()
    return w === 0 || w === 6 || w === 5
  })
}

function hasWeekdayDeparture(departures: { departureDate: Date }[] | undefined): boolean {
  if (!departures?.length) return false
  return departures.some((d) => {
    const w = new Date(d.departureDate).getDay()
    return w >= 1 && w <= 4
  })
}

/**
 * 일정별: 제목 패턴 우선 → tripDays → 기존 약한 문자열(terms)
 */
export function domesticProductMatchesScheduleNavKey(
  p: {
    title: string
    tripDays: number | null
    departures?: { departureDate: Date }[]
  },
  dmItem: string,
  legacyTerms: string[]
): boolean {
  const raw = p.title ?? ''
  const t = raw.toLowerCase()
  const td = p.tripDays
  const deps = p.departures

  const hayLegacy = `${raw}`.toLowerCase()
  const weakHay = legacyTerms.some((x) => x.trim() && hayLegacy.includes(x.trim().toLowerCase()))

  if (dmItem === 'day') {
    if (/(^|[^\d])당일|당일여행|당일치기/.test(t)) return true
    if (td === 1 && !/\d+\s*박/.test(t)) return true
    return weakHay
  }
  if (dmItem === 'mubak') {
    if (/무박/.test(t)) return true
    return weakHay && /무박|당일/.test(t)
  }
  if (dmItem === 'n1') {
    if (/1\s*박\s*2\s*일|1박2일|1박\s*2일/.test(t)) return true
    if (td === 2 && /\d\s*일/.test(t)) return true
    return weakHay
  }
  if (dmItem === 'n2') {
    if (/2\s*박\s*3\s*일|2박3일|2박\s*3일/.test(t)) return true
    if (td === 3 && /2\s*박|2박/.test(t)) return true
    return weakHay
  }
  if (dmItem === 'n3p') {
    if (/\d+\s*박\s*\d+\s*일/.test(t)) {
      const m = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
      if (m) {
        const nights = parseInt(m[1], 10)
        if (!Number.isNaN(nights) && nights >= 3) return true
      }
    }
    if (/(3\s*박\s*4\s*일|3박4일|4\s*박\s*5\s*일|4박5일|5\s*박|장기)/.test(t)) return true
    if (td != null && td >= 4) return true
    return weakHay
  }
  if (dmItem === 'nd3') {
    const cleaned = stripNbMDaysForStandaloneDayScan(raw)
    const cl = cleaned.toLowerCase()
    if (/(?:^|[^\d박\s])(3일)(?:[^\d]|$)/.test(cleaned) || /(?:^|[\s·])3일(?:[\s·]|$)/.test(cl)) {
      if (!/\d+\s*박\s*3일/.test(t) && !/2\s*박\s*3일|2박3일/.test(t)) return true
    }
    if (td === 3 && !/\d+\s*박/.test(t)) return true
    return weakHay
  }
  if (dmItem === 'nd4') {
    const cleaned = stripNbMDaysForStandaloneDayScan(raw)
    const cl = cleaned.toLowerCase()
    if (/(?:^|[^\d박\s])(4일)(?:[^\d]|$)/.test(cleaned) || /(?:^|[\s·])4일(?:[\s·]|$)/.test(cl)) {
      if (!/\d+\s*박\s*4일/.test(t)) return true
    }
    if (td === 4 && !/\d+\s*박/.test(t)) return true
    return weakHay
  }
  if (dmItem === 'weekend') {
    if (/주말|금요일\s*출발|토요일|일요일/.test(t)) return true
    if (hasWeekendDeparture(deps)) return true
    return weakHay
  }
  if (dmItem === 'weekday') {
    if (/평일|월요일|화요일|수요일|목요일/.test(t)) return true
    if (hasWeekdayDeparture(deps)) return true
    return weakHay
  }
  return weakHay
}

export function domesticProductMatchesBus(p: { title: string; includedText?: string | null }): boolean {
  const title = p.title ?? ''
  if (BUS_TITLE.test(title)) return true
  if (BUS_WEAK.test(title)) return true
  const inc = (p.includedText ?? '').slice(0, 1500)
  return BUS_TITLE.test(inc) || BUS_WEAK.test(inc)
}

export function domesticProductMatchesTrain(p: { title: string; includedText?: string | null }): boolean {
  const title = p.title ?? ''
  if (TRAIN_TITLE.test(title)) return true
  if (TRAIN_WEAK.test(title)) return true
  const inc = (p.includedText ?? '').slice(0, 1500)
  return TRAIN_TITLE.test(inc) || TRAIN_WEAK.test(inc)
}

/** 해상·크루즈(단, 레일크루즈·순수 관광열차/바다열차만 있는 경우는 제외) */
const SHIP_KEY =
  /(크루즈\s*여행|크루즈여행|크루즈|크루징|유람선|카페리|페리|여객선|선박\s*여행|선박여행|선상|선내|\b선박\b)/i

export function domesticProductMatchesShip(p: { title: string; includedText?: string | null }): boolean {
  const title = (p.title ?? '').trim()
  if (/레일\s*크루즈|레일크루즈/i.test(title)) return false
  if (/(관광열차|바다\s*열차)/i.test(title) && !SHIP_KEY.test(title)) return false
  if (SHIP_KEY.test(title)) return true
  const inc = (p.includedText ?? '').slice(0, 1500)
  return SHIP_KEY.test(inc)
}

export function domesticDisplayCategoryIsSpecialTheme(displayCategory: string | null | undefined): boolean {
  const s = (displayCategory ?? '').trim().toLowerCase()
  if (!s) return false
  return s.includes(DOMESTIC_SPECIAL_THEME_MARKER.toLowerCase())
}
