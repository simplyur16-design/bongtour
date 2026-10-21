/**
 * 공개 상품 짧은 제목(A) · 보조(B) SSOT — product-surface v1.
 * Product.title 저장·R-5 marketing compose와 분리. confirm 경로 미연결.
 *
 * REGRESSION-FREEZE[bongtour-ocean-warm-design-l0]: heroShortTitle 계약 — manifest
 */

import { getProductTotalDays } from '@/lib/package-rules'
import { BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS } from '@/lib/bongtour-product-title-tone-ssot'

export const BONGTOUR_PRODUCT_DISPLAY_TITLE_VERSION = 'v1-2026-10-15'

/** 도시가 브랜드급일 때 short title에 국가 대신 도시 사용 */
export const BONGTOUR_HERO_BRAND_CITIES: readonly string[] = [
  '다낭',
  '푸켓',
  '세부',
  '보라카이',
  '발리',
  '방콕',
  '치앙마이',
  '나트랑',
  '푸꾸옥',
  '호이안',
  '괌',
  '사이판',
  '하와이',
  '오키나와',
  '삿포로',
  '오사카',
  '도쿄',
  '후쿠오카',
  '타이베이',
  '홍콩',
  '마카오',
  '싱가포르',
  '두바이',
  '파리',
  '런던',
  '로마',
  '바르셀로나',
  '프라하',
  '부다페스트',
  '이스탄불',
  '카파도키아',
  '시드니',
  '멜버른',
  '뉴욕',
  '밴쿠버',
] as const

/** 나라+테마+일수 허용 테마 (1토큰) */
export const BONGTOUR_HERO_THEME_WHITELIST: readonly string[] = [
  '오로라',
  '성지순례',
  '크루즈',
  '골프',
  '트레킹',
  '다이빙',
  '온천',
] as const

const REGION_LABELS: readonly string[] = [
  '동유럽',
  '북유럽',
  '서유럽',
  '남유럽',
  '발칸',
  '중동',
  '아프리카',
  '중남미',
  '남미',
  '미동부',
  '미서부',
  '캐나다',
  '호주',
  '뉴질랜드',
  '동남아',
  '서남아',
  '중앙아시아',
  '지중해',
] as const

export type BongtourDisplayTitleInput = {
  duration?: string | null
  totalDays?: number | null
  /** 국가 한글 라벨 1개 (단일국) */
  countryLabel?: string | null
  /** 방문 도시 (순서 유지, 중복 제거는 호출측 또는 여기) */
  cities?: readonly string[] | null
  /** 다국가·일주 등 권역 라벨 */
  regionLabel?: string | null
  /** 원제목·destination — 테마·폴백 스캔 */
  haystack?: string | null
  multiCountry?: boolean | null
}

export type BongtourDisplayTitleResult = {
  heroShortTitle: string | null
  heroSubtitle: string | null
  placeKind: 'city' | 'country' | 'region' | 'theme' | 'fallback' | null
  dayToken: string | null
}

function cleanToken(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  for (const tok of BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS) {
    if (!tok.trim()) continue
    const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    t = t.replace(re, '')
  }
  return t.replace(/\s{2,}/g, ' ').trim()
}

/** 짧은 제목용 장소 — 괄호 조각·반쪽 ( 제거 (예: 규슈 (후쿠오카 → 규슈) */
export function sanitizePlaceLabel(s: string): string {
  let t = cleanToken(s)
  if (!t) return ''
  // 완결된 괄호 구간 통째 제거: 규슈 (후쿠오카·벳푸) → 규슈
  t = t.replace(/[（(][^）)]*[）)]/g, ' ')
  // 닫히지 않은 여는 괄호 이후 버림
  t = t.replace(/[（(][^）)]*$/g, ' ')
  t = t.replace(/[）)]+/g, ' ')
  t = t.replace(/\s{2,}/g, ' ').trim()
  // 쉼표·슬래시 나열이면 앞 토큰만 (동남아, 싱가포르 → 동남아는 split에서 처리; 잔여 방어)
  if (/[,，、]/.test(t)) t = (t.split(/[,，、]/)[0] ?? t).trim()
  return t
}

/** DB duration 없을 때 원제목에서 N박 M일 / M일 추출 */
export function durationHintFromTitle(title: string): string | null {
  const hay = String(title || '')
  const nm = hay.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) return `${nm[1]}박 ${nm[2]}일`
  const only = hay.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (only) return `${only[1]}일`
  return null
}

function uniqPreserve(list: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const s = sanitizePlaceLabel(String(raw || ''))
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** duration `N박 M일` → 공개도 `N박 M일` (카드에서 숙박·일수 함께 읽히게) */
export function composeHeroDayToken(
  duration?: string | null,
  totalDays?: number | null
): string | null {
  const d = String(duration || '').trim()
  const m = d.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (m) return `${m[1]}박 ${m[2]}일`
  const onlyDay = d.match(/(?<!\d)(\d+)\s*일(?!\d)/)
  if (onlyDay) {
    const days = Number(onlyDay[1])
    if (days > 1) return `${days - 1}박 ${days}일`
    return `${days}일`
  }
  const n = getProductTotalDays({ duration: duration ?? null }, totalDays ?? null)
  if (n > 1) return `${n - 1}박 ${n}일`
  if (n > 0) return `${n}일`
  return null
}

function pickBrandCity(cities: readonly string[]): string | null {
  for (const c of cities) {
    if (BONGTOUR_HERO_BRAND_CITIES.includes(c)) return c
  }
  return null
}

function detectTheme(hay: string): string | null {
  for (const t of BONGTOUR_HERO_THEME_WHITELIST) {
    if (hay.includes(t)) return t
  }
  return null
}

function detectRegion(hay: string, regionLabel?: string | null): string | null {
  const r = cleanToken(String(regionLabel || ''))
  if (r) return r
  for (const lab of REGION_LABELS) {
    if (hay.includes(lab)) return lab
  }
  if (/일주/.test(hay)) {
    if (/유럽/.test(hay)) return '유럽'
    if (/미주|미국|캐나다/.test(hay)) return '미주'
  }
  return null
}

/**
 * 공개 카드·히어로용 짧은 제목 + 보조 한 줄.
 * 실패 시 short=null → UI는 기존 title 폴백.
 */
export function composeBongtourHeroDisplayTitle(
  input: BongtourDisplayTitleInput
): BongtourDisplayTitleResult {
  const cities = uniqPreserve(input.cities ?? [])
  const country = cleanToken(String(input.countryLabel || ''))
  const hay = cleanToken(String(input.haystack || ''))
  const dayToken = composeHeroDayToken(input.duration, input.totalDays)
  const multi = Boolean(input.multiCountry) || Boolean(input.regionLabel && !country)
  const theme = detectTheme(hay)
  const region = detectRegion(hay, input.regionLabel)

  let place: string | null = null
  let placeKind: BongtourDisplayTitleResult['placeKind'] = null

  const brandCity = pickBrandCity(cities)
  if (!multi && brandCity && country) {
    place = brandCity
    placeKind = 'city'
  } else if (theme && country && dayToken) {
    // 아이슬란드 오로라 7일
    place = `${country} ${theme}`
    placeKind = 'theme'
  } else if (multi || (!country && region)) {
    place = region || country || cities[0] || null
    placeKind = region ? 'region' : place ? 'fallback' : null
  } else if (country) {
    place = country
    placeKind = 'country'
  } else if (brandCity || cities[0]) {
    place = brandCity || cities[0]!
    placeKind = 'city'
  } else if (hay) {
    const raw = sanitizePlaceLabel(hay.slice(0, 16).replace(/[^\p{L}\p{N}\s]/gu, ' '))
    place = raw || '여행'
    placeKind = 'fallback'
  }

  place = place ? sanitizePlaceLabel(place) : null
  if (!place || !dayToken) {
    return { heroShortTitle: null, heroSubtitle: null, placeKind: null, dayToken }
  }

  const shortFinal = cleanToken(`${place} ${dayToken}`)
  if ([...shortFinal].length < 4 || /[（(）)]/.test(shortFinal)) {
    return { heroShortTitle: null, heroSubtitle: null, placeKind: null, dayToken }
  }

  let heroSubtitle: string | null = null
  if (placeKind === 'country') {
    const subCities = cities.filter((c) => c !== place).slice(0, 2)
    heroSubtitle = subCities.length ? subCities.join(' · ') : null
  } else if (placeKind === 'city') {
    if (country && country !== place) heroSubtitle = country
    else if (cities.length > 1) {
      const second = cities.find((c) => c !== place)
      heroSubtitle = second ?? null
    }
  } else if (placeKind === 'region') {
    if (country) heroSubtitle = country
    else if (cities.length) heroSubtitle = cities.slice(0, 2).join(' · ')
  } else if (placeKind === 'theme') {
    // short already has country+theme — subtitle = cities only
    if (cities.length) heroSubtitle = cities.slice(0, 2).join(' · ')
  }

  return { heroShortTitle: shortFinal, heroSubtitle, placeKind, dayToken }
}

function splitPlaceTokens(...parts: (string | null | undefined)[]): string[] {
  const out: string[] = []
  for (const raw of parts) {
    const s = String(raw ?? '').trim()
    if (!s || s === '—') continue
    for (const piece of s.split(/[·/,|，、]+|\s{2,}/)) {
      const t = sanitizePlaceLabel(piece)
      if (t) out.push(t)
    }
  }
  return uniqPreserve(out)
}

/**
 * 국내 출발 허브·「X출발」라벨 — 해외 상품 short 제목 place로 쓰지 않음.
 * REGRESSION-FREEZE[public-card-no-kr-departure-place]: 부산·대구 등 출발지≠목적지 — manifest
 */
export function isKrHomeDeparturePlaceLabel(s: string): boolean {
  const t = sanitizePlaceLabel(s)
  if (!t) return false
  if (/^(?:부산|대구|청주|김해|김포|인천|서울|제주)(?:공항)?$/u.test(t)) return true
  if (/^(?:부산|대구|청주|김해|제주|인천)\s*출발$/u.test(t)) return true
  // 「인천출발」「청주출발」단독 토큰
  if (/출발$/u.test(t) && /(?:부산|대구|청주|김해|김포|인천|제주)/u.test(t) && t.length <= 8) {
    return true
  }
  return false
}

function stripKrDepartureMarkersFromTitle(title: string): string {
  return String(title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/(?:부산|대구|청주|김해|제주|인천)\s*출발/gu, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 목적지 라벨로 쓰기엔 부적합한 마케팅·조건·출발시각 토큰 */
function isNonPlaceMarketingToken(s: string): boolean {
  const t = sanitizePlaceLabel(s)
  if (!t) return true
  if (
    /최소화|포함|리무진|노쇼핑|노옵션|특가|긴급|모집|마감|확정|대기|할인|혜택|자유일정|핵심쏙쏙/u.test(
      t,
    )
  ) {
    return true
  }
  // 「밤출발」「새벽출발」등 — 도시명 아님
  if (/^(?:밤|새벽|오전|오후|저녁|아침)?출발$/u.test(t)) return true
  return false
}

function filterKrDeparturePlaceTokens(cities: readonly string[]): string[] {
  return cities.filter((c) => !isKrHomeDeparturePlaceLabel(c) && !isNonPlaceMarketingToken(c))
}

/**
 * 공개 목적지 라벨에서 국내출발 허브 토큰 제거 (`부산 · 마츠야마` → `마츠야마`).
 * 전부 출발 허브·마케팅이면 빈 문자열 (원문 유지 금지 — UI에서 `|| destination` 폴백 금지).
 * REGRESSION-FREEZE[public-card-no-kr-departure-place]: dest scrub 빈결과 — manifest
 */
export function scrubKrDepartureFromPlaceLabel(label: string | null | undefined): string {
  const raw = String(label ?? '').trim()
  if (!raw || raw === '—') return raw
  const parts = raw
    .split(/[·/,|，、]+/)
    .map((p) => sanitizePlaceLabel(p))
    .filter(Boolean)
  const kept = filterKrDeparturePlaceTokens(parts)
  if (kept.length === 0) return ''
  return kept.join(' · ')
}

/**
 * 히어로 메타·travelCities 공개 한 줄. scrub 후 비면 `—`.
 * REGRESSION-FREEZE[public-card-no-kr-departure-place]: 공개 dest 메타 — manifest
 */
export function formatPublicDestinationDisplayLabel(
  ...labels: Array<string | null | undefined>
): string {
  const kept: string[] = []
  const seen = new Set<string>()
  for (const label of labels) {
    const scrubbed = scrubKrDepartureFromPlaceLabel(label)
    if (!scrubbed) continue
    for (const part of scrubbed.split(/\s*·\s*/)) {
      const t = part.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      kept.push(t)
    }
  }
  return kept.length ? kept.join(' · ') : '—'
}

export type PublicBrowseCardTitleInput = {
  /** Plan B / DB 원문 제목 — 폴백·haystack */
  title: string
  duration?: string | null
  primaryDestination?: string | null
  destination?: string | null
  destinationRaw?: string | null
  primaryRegion?: string | null
  countryRowLabel?: string | null
}

export type PublicBrowseCardTitleResult = {
  /** 카드 h2 — short 우선, 실패 시 Plan B 정리 제목 */
  cardTitle: string
  heroSubtitle: string | null
  usedHeroShort: boolean
}

/**
 * 홈·browse 카드 공개 제목 — DB Product.title 덮어쓰지 않음.
 * REGRESSION-FREEZE[public-card-hero-short-title]: 카드는 heroShort · 원문은 폴백 — manifest
 */
export function resolvePublicBrowseCardTitle(
  input: PublicBrowseCardTitleInput,
  fallbackTitle: string,
): PublicBrowseCardTitleResult {
  // REGRESSION-FREEZE[public-card-no-kr-departure-place]: 출발 허브 도시 제거 — manifest
  let cities = filterKrDeparturePlaceTokens(
    splitPlaceTokens(input.primaryDestination, input.destination, input.destinationRaw),
  )
  if (cities.length === 0) {
    cities = filterKrDeparturePlaceTokens(
      splitPlaceTokens(stripKrDepartureMarkersFromTitle(input.title)),
    )
  }
  const countryLabel = cleanToken(String(input.countryRowLabel || ''))
  const regionLabel = cleanToken(String(input.primaryRegion || ''))
  const multiCountry =
    Boolean(regionLabel) &&
    (/유럽|미주|중동|아프리카|중남미|남미|동남아|서남아|일주/.test(regionLabel) ||
      cities.length >= 3)

  const duration =
    String(input.duration || '').trim() || durationHintFromTitle(input.title) || null
  const regionClean = sanitizePlaceLabel(regionLabel)
  let countryClean = sanitizePlaceLabel(countryLabel)
  if (countryClean && isKrHomeDeparturePlaceLabel(countryClean)) countryClean = ''

  const composed = composeBongtourHeroDisplayTitle({
    duration,
    countryLabel: countryClean || null,
    cities,
    regionLabel: regionClean || null,
    haystack: [
      stripKrDepartureMarkersFromTitle(input.title),
      ...cities,
      input.primaryDestination,
      input.destination,
    ]
      .filter(Boolean)
      .join(' '),
    multiCountry,
  })

  if (composed.heroShortTitle) {
    return {
      cardTitle: composed.heroShortTitle,
      heroSubtitle: composed.heroSubtitle,
      usedHeroShort: true,
    }
  }

  // short 실패 시에도 해시태그·반쪽 괄호는 카드에 안 남김
  const fbRaw = String(fallbackTitle || input.title || '').trim() || '여행'
  const fb = sanitizePlaceLabel(fbRaw.replace(/#[^\s#]+/g, ' ')).replace(/\s{2,}/g, ' ').trim() || '여행'
  return { cardTitle: fb, heroSubtitle: null, usedHeroShort: false }
}

export type PublicDetailHeroTitlesResult = {
  /** 히어로 오버레이 — short 우선 */
  heroTitle: string
  /** 히어로 옆(정보 카드) — Plan B·원 상품명 */
  listingTitle: string
  heroSubtitle: string | null
  usedHeroShort: boolean
}

/**
 * 상품 상세 히어로 — 짧은 제목(오버레이) + 원 상품명(옆 정보 카드).
 * REGRESSION-FREEZE[public-detail-hero-short-listing]: 상세 short·원명 분리 — manifest
 */
export function resolvePublicDetailHeroTitles(
  input: PublicBrowseCardTitleInput,
): PublicDetailHeroTitlesResult {
  const listingTitle =
    String(input.title || '').trim() ||
    String(input.primaryDestination || '').trim() ||
    '여행'
  const card = resolvePublicBrowseCardTitle(input, listingTitle)
  return {
    heroTitle: card.cardTitle,
    listingTitle,
    heroSubtitle: card.heroSubtitle,
    usedHeroShort: card.usedHeroShort,
  }
}
