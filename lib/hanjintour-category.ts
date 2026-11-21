/**
 * 한진관광 목록 원문(GNB 분류 경로·상품명)으로 국내 여부와 분류를 정한다.
 * 사장님 2026-11-22 00:46: 국내 목적지 상품은 수집하지 않는다. 지방출발(부산·대구·청주·광주·제주) 해외 상품은 받는다.
 * 분류는 공급사 원문 기준: 패키지 / 자유여행 / 테마여행, 그리고 지방출발 태그.
 * REGRESSION-FREEZE[ingest-domestic-skip-category-1122]: 국내 목적지 skip·원문 분류 — manifest
 */
import { isRegisterIngestDomesticKoreaProduct } from '@/lib/register-ingest-reject-domestic-korea'
import { detectLocalDepartureFromExplicitSignals } from '@/lib/local-departure-detect'
import { LOCAL_DEPARTURE_TAG_VALUES, type LocalDepartureTag } from '@/lib/product-listing-kind'

export type HanjintourCategoryKind = '패키지' | '자유여행' | '테마여행'

export type HanjintourCategory = {
  kind: HanjintourCategoryKind
  travelScope: 'overseas' | 'air_hotel_free'
  /** 테마여행이면 원문 분류 이름(예: 골프) */
  themeTag: string | null
  localDepartureTag: LocalDepartureTag[]
}

/** 분류 경로 맨 앞이 국내 묶음인 경우 */
const DOMESTIC_TOP_RE = /^\s*(?:국내|제주(?:도)?(?:여행)?$)/
/** 호캉스 등 숙박 묶음 아래 국내 지명 */
const KOREA_PLACE_RE = /^\s*(?:제주|서울|경기|인천|강원|경상|경남|경북|전라|전남|전북|충청|충남|충북|부산|대구|광주|대전|울산|여수|경주|속초|강릉|국내)/

const FREE_RE = /자유|에어텔|에어\s*\+\s*호텔|항공\s*\+\s*호텔|호텔\s*팩|FIT/i
const THEME_RE = /골프|크루즈|테마|성지|순례|트레킹|트래킹|산행|허니문|기차|열차|오로라|사파리|축제|스포츠|관람/

function cleanPaths(paths: readonly (readonly string[])[] | null | undefined): string[][] {
  return (paths ?? []).map((p) => p.map((s) => String(s ?? '').trim()).filter(Boolean)).filter((p) => p.length > 0)
}

/** 국내 목적지면 true. 출발지만 지방인 해외 상품은 false. */
export function isHanjintourDomesticListing(
  title: string | null | undefined,
  categoryPaths: readonly (readonly string[])[] | null | undefined,
): boolean {
  const paths = cleanPaths(categoryPaths)
  if (paths.length > 0 && paths.every((p) => DOMESTIC_TOP_RE.test(p[0]!) || (p[0] === '호캉스' && KOREA_PLACE_RE.test(p[1] ?? '')))) {
    return true
  }
  const leafText = paths.map((p) => p.join(' ')).join(' ')
  return isRegisterIngestDomesticKoreaProduct(`${String(title ?? '')} ${leafText}`.trim())
}

const LOCAL_DEP_IN_PATH: Array<[RegExp, LocalDepartureTag]> = [
  [/부산\s*출발|김해\s*출발/, 'busan'],
  [/대구\s*출발/, 'daegu'],
  [/청주\s*출발/, 'cheongju'],
  [/제주\s*출발/, 'jeju'],
]

export function classifyHanjintourCategory(
  title: string | null | undefined,
  categoryPaths: readonly (readonly string[])[] | null | undefined,
): HanjintourCategory {
  const paths = cleanPaths(categoryPaths)
  const tops = paths.map((p) => p[0]!)
  const all = paths.flat().join(' ')
  const freeTop = tops.find((t) => FREE_RE.test(t))
  const themeTop = tops.find((t) => THEME_RE.test(t))
  let kind: HanjintourCategoryKind = '패키지'
  if (freeTop || (!themeTop && FREE_RE.test(all))) kind = '자유여행'
  else if (themeTop || THEME_RE.test(tops.join(' '))) kind = '테마여행'
  const themeTag = kind === '테마여행' ? (themeTop ?? tops.find((t) => THEME_RE.test(t)) ?? null) : null

  const tags = new Set<LocalDepartureTag>(
    detectLocalDepartureFromExplicitSignals({ originalTitle: String(title ?? '') }).tags,
  )
  for (const [re, tag] of LOCAL_DEP_IN_PATH) if (re.test(all)) tags.add(tag)
  return {
    kind,
    travelScope: kind === '자유여행' ? 'air_hotel_free' : 'overseas',
    themeTag,
    localDepartureTag: LOCAL_DEPARTURE_TAG_VALUES.filter((t) => tags.has(t)),
  }
}
