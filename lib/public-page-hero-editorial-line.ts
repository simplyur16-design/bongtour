/**
 * 페이지 히어로(해외/국내 허브 상단 등) 전용 1줄 멘트 — 스텁·라벨·월 유틸.
 *
 * - 상품 대표이미지용 `buildPublicProductHeroSeoKeywordOverlay` / 출처 오버레이와 경로를 섞지 않는다.
 * - Gemini 생성: `lib/page-hero-monthly-gemini-server.ts` + `POST /api/public/page-hero-editorial-lines`.
 * - 실패·비키 호출 시 멘트는 `buildPublicPageHeroEditorialLineMonthlyStub` 로 폴백.
 */

export type PublicPageHeroTravelScope = 'overseas' | 'domestic'

const VERBS = ['떠나다', '가다', '만나다', '걷다', '즐기다'] as const
const FALLBACK_VERBS = ['떠나다', '가다', '즐기다'] as const

/** 달력 월(1–12)에 offset을 더한 월(순환). */
export function publicPageHeroMonthPlus(baseMonth1To12: number, offset: number): number {
  return ((baseMonth1To12 - 1 + offset) % 12) + 1
}

function hasBatchimKorean(word: string): boolean {
  if (!word) return false
  const chars = [...word]
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i]!
    const code = c.charCodeAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
    if (/[A-Za-z]/.test(c)) return /[bcdfghjklmnpqrstvwxyz]/i.test(c)
    if (/[0-9]/.test(c)) return c !== '2' && c !== '4' && c !== '5' && c !== '9'
  }
  return false
}

function withRoParticle(dest: string): string {
  if (!dest.trim()) return '해외로'
  return hasBatchimKorean(dest) ? `${dest}으로` : `${dest}로`
}

/**
 * browse 히어로 슬롯용: primaryDestination·title에서 짧은 권역/도시 라벨.
 * (기존 OverseasHero `destinationLabel`과 동일 규칙)
 */
export function browseDestinationDisplayLabelFromBrowseHero(item: {
  primaryDestination: string | null
  title: string
}): string {
  const src = (item.primaryDestination ?? item.title ?? '').trim()
  if (!src) return '해외'
  const token = src.split(/[,\-\/|·\s]+/).find((x) => x.trim().length > 1)
  return (token ?? src).trim().slice(0, 18)
}

/**
 * 페이지 히어로 1줄 멘트(스텁). 입력: 표시 월 + 도시/권역 한 덩어리 + 동사 슬롯.
 * 5단계: 동일 시그니처를 유지한 채 Gemini 응답으로 대체.
 */
export function buildPublicPageHeroEditorialLineMonthlyStub(input: {
  targetMonth1To12: number
  destinationDisplay: string
  verbSlotIndex: number
  travelScope: PublicPageHeroTravelScope
}): string {
  const { targetMonth1To12: month, destinationDisplay, verbSlotIndex, travelScope } = input
  const dest = destinationDisplay.trim() || (travelScope === 'domestic' ? '국내' : '해외')
  const verbPool = dest === '해외' ? FALLBACK_VERBS : VERBS
  const verb = verbPool[verbSlotIndex % verbPool.length]!
  return `${month}월 ${withRoParticle(dest)} ${verb}`
}
