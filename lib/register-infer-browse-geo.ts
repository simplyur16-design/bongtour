/**
 * 등록 미리보기 등 — 목적지 문자열만으로 browse용 continent/country/city 슬러그 추론.
 * DB 확정 전 단계용. confirm API에서 동일 규칙으로 저장하는 것이 이상적이다.
 */
import {
  matchProductToOverseasNode,
  type MatchProductToOverseasNodeResult,
} from '@/lib/match-overseas-product'
import { findCountryInTree } from '@/lib/overseas-location-tree'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import { collectLeafTerms, continentTabIdForMatch } from '@/lib/unified-location-tree'

export type InferredBrowseGeo = { continent: string; country: string; city: string | null }

/** continent id → Pexels·UI용 한글 권역 라벨 */
export const CONTINENT_ID_TO_PRIMARY_REGION_KR: Record<string, string> = {
  japan: '일본',
  'southeast-asia': '동남아',
  'china-mongolia-ca': '중국',
  'hongkong-macau': '홍콩/마카오',
  'china-hk-mo': '중국/홍콩/마카오/몽골',
  'europe-me': '유럽/중동/아프리카',
  europe: '유럽',
  'me-africa': '중동·아프리카',
  americas: '미주/캐나다/하와이/중남미',
  oceania: '괌/사이판/호주/뉴질랜드',
}

const SEG_SPLIT = /[,，、]/

function uniqueNonEmptyStrings(parts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of parts) {
    const s = raw.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/** 전체 문장 + 콤마 분절 + 개별 필드 — 각각에 대해 트리 매칭 후 최적 1건 선택 */
function candidateDestinationBlobs(input: {
  primaryDestination: string
  destinationRaw: string
  title: string
}): string[] {
  const { primaryDestination: pd, destinationRaw: dr, title: t } = input
  return uniqueNonEmptyStrings([
    [pd, dr, t].filter(Boolean).join(' '),
    pd,
    dr,
    t,
    ...pd.split(SEG_SPLIT).map((x) => x.trim()),
    ...dr.split(SEG_SPLIT).map((x) => x.trim()),
    ...t.split(SEG_SPLIT).map((x) => x.trim()),
  ])
}

const SCOPE_RANK: Record<MatchProductToOverseasNodeResult['scope'], number> = {
  leaf: 3,
  country: 2,
  group: 1,
}

/** 긴 매칭 토큰 우선, 동률이면 원문에서 먼저 등장한 토큰, 그다음 leaf > country > group */
function compareBrowseGeoMatches(
  a: MatchProductToOverseasNodeResult,
  b: MatchProductToOverseasNodeResult,
  sourceForIndex: string
): number {
  const la = a.matchedTerm.length
  const lb = b.matchedTerm.length
  if (la !== lb) return la - lb
  const ia = sourceForIndex.indexOf(a.matchedTerm)
  const ib = sourceForIndex.indexOf(b.matchedTerm)
  if (ia >= 0 && ib >= 0 && ia !== ib) return ia - ib
  return SCOPE_RANK[a.scope] - SCOPE_RANK[b.scope]
}

export function inferBrowseGeoFromDestinationText(input: {
  primaryDestination?: string | null
  destinationRaw?: string | null
  title?: string | null
}): InferredBrowseGeo | null {
  const pd = (input.primaryDestination ?? '').trim()
  const dr = (input.destinationRaw ?? '').trim()
  const t = (input.title ?? '').trim()
  if (!pd && !dr && !t) return null

  const sourceForIndex = [pd, dr, t].filter(Boolean).join(' ')
  const blobs = candidateDestinationBlobs({ primaryDestination: pd, destinationRaw: dr, title: t })
  let best: MatchProductToOverseasNodeResult | null = null

  for (const blob of blobs) {
    const match = matchProductToOverseasNode({
      title: blob,
      originSource: '',
      primaryDestination: input.primaryDestination?.trim() || null,
      destinationRaw: input.destinationRaw?.trim() || null,
    })
    if (!match?.countryKey) continue
    if (!best || compareBrowseGeoMatches(match, best, sourceForIndex) > 0) best = match
  }
  if (!best?.countryKey) return null

  const found = findCountryInTree(best.groupKey, best.countryKey)
  if (!found) return null

  const continent = continentTabIdForMatch(best.groupKey, best.countryKey)
  /** 일본 트리는 `jp-kanto` 등 하위 권역이 country 노드 — browse `country`는 통상 `japan` */
  const country =
    found.group.groupKey === 'japan'
      ? countrySlugFromLabel(found.group.groupLabel)
      : countrySlugFromLabel(found.country.countryLabel)

  if (best.leafKey && best.leafLabel) {
    const leaf = found.country.children.find((l) => l.nodeKey === best.leafKey)
    const isWholeCountryLeaf = best.leafLabel.trim() === found.country.countryLabel.trim()
    if (isWholeCountryLeaf) {
      return { continent, country, city: null }
    }
    const terms = leaf ? collectLeafTerms(found.country, leaf) : [best.leafLabel]
    const city = citySlugFromTermsAndLabel(best.leafLabel, terms)
    return { continent, country, city }
  }

  return { continent, country, city: null }
}
