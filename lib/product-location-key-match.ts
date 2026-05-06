/**
 * 상품 → 해외 목적지 트리 SSOT(`overseas-location-tree`) 키 추론.
 * - 등록 실패를 유발하지 않음(항상 try/catch, null 허용).
 * - 기존 `matchProductToOverseasNode` 재사용.
 */
import type {
  MatchProductToOverseasNodeResult,
  OverseasProductMatchInput,
} from '@/lib/match-overseas-product'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { countrySlugFromLabel, citySlugFromTermsAndLabel } from '@/lib/location-url-slugs'
import {
  OVERSEAS_LOCATION_TREE_CLEAN,
  findCountryInTree,
  matchTokensForCountryShallow,
  matchTokensForLeaf,
} from '@/lib/overseas-location-tree'
import { inferBrowseGeoFromDestinationText } from '@/lib/register-infer-browse-geo'
import { collectLeafTerms, continentTabIdForMatch } from '@/lib/unified-location-tree'

export type ProductLocationKeyMatchInput = {
  title: string
  originSource: string
  primaryDestination?: string | null
  destinationRaw?: string | null
  primaryRegion?: string | null
  destination?: string | null
  /** 일정 제목·본문 등 추가 힌트(길면 잘림) */
  bodyText?: string | null
  /**
   * DB `Product.country` / `city` — 백필·재동기화 시에만 넣어도 됨.
   * 한글이면 blob 좁히기 1순위 힌트(제목·일정에 다른 국가가 섞여도 DB browse 국가 우선).
   */
  browseHintCountry?: string | null
  browseHintCity?: string | null
}

/** Prisma `Product`에 그대로 spread 가능한 보조 필드만 */
export type ProductLocationKeyPrismaFields = {
  countryKey: string | null
  nodeKey: string | null
  groupKey: string | null
  locationMatchConfidence: string | null
  locationMatchSource: string | null
  /** 메가메뉴 탭 id 계열 (`inferBrowseGeoFromDestinationText`) */
  continent: string | null
  /** I-6: `Continent.continentKey` — 마스터 보강 시 채움 */
  continentKey: string | null
  /** I-6: `City.cityKey` — 단일 도시 마스터 매칭 시만 */
  cityKey: string | null
  /** 내부 추론값 — 저장 SSOT 한글은 `normalizeProductGeoForPrisma` 사용 */
  country: string | null
  city: string | null
}

const BODY_MAX = 8000

const SEG_SPLIT_DEST = /[,，、]/

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

/** `inferBrowseGeoFromDestinationText`와 동일한 blob 목록 — 토큰 길이·등장 순으로 최적 매치를 고른다. */
function candidateDestinationBlobsForMatch(input: {
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
    ...pd.split(SEG_SPLIT_DEST).map((x) => x.trim()),
    ...dr.split(SEG_SPLIT_DEST).map((x) => x.trim()),
    ...t.split(SEG_SPLIT_DEST).map((x) => x.trim()),
  ])
}

/** browseHint → primaryDestination → destinationRaw → destination → title 순 한글 토큰(첫 힌트 우선) */
function orderedHangulHintsFromStructuredFields(input: ProductLocationKeyMatchInput): string[] {
  const ordered: Array<string | null | undefined> = [
    input.browseHintCountry,
    input.primaryDestination,
    input.destinationRaw,
    input.destination,
    input.title,
  ]
  const out: string[] = []
  for (const p of ordered) {
    const s = String(p ?? '').trim()
    if (!s) continue
    for (const seg of s.split(SEG_SPLIT_DEST)) {
      const t = seg.trim()
      if (t && /[가-힣]/.test(t) && !out.includes(t)) out.push(t)
    }
    if (/[가-힣]/.test(s) && !out.includes(s)) out.push(s)
  }
  return out
}

/**
 * DB·폼에 이미 적힌 한글 목적지가 있으면, 제목만으로 뜬 다른 국가(leaf)가 이기지 못하게 blob을 좁힌다.
 * (예: 스페인 상품인데 제목/부제에 포르투갈이 길게 나오는 경우)
 */
function narrowBlobsByPrimaryHangulHint(
  blobs: string[],
  input: ProductLocationKeyMatchInput,
): string[] {
  const hints = orderedHangulHintsFromStructuredFields(input)
  if (hints.length === 0) return blobs
  const primary = hints[0]!
  const filtered = blobs.filter((b) => b.includes(primary))
  return filtered.length > 0 ? filtered : blobs
}

const SCOPE_RANK_MATCH: Record<MatchProductToOverseasNodeResult['scope'], number> = {
  leaf: 3,
  country: 2,
  group: 1,
}

/**
 * `matchProductToOverseasNode`는 `matchedTerm` 길이 ≥2만 허용해 한 글자 한글(예: 괌)이 leaf에서 누락된다.
 * DB browse 힌트가 정확히 트리 토큰과 일치할 때만 보조 매칭한다.
 */
function matchOverseasNodeByExactHangulHint(hint: string): MatchProductToOverseasNodeResult | null {
  const h = hint.trim()
  if (!h || !/[가-힣]/.test(h)) return null
  for (const group of OVERSEAS_LOCATION_TREE_CLEAN) {
    for (const country of group.countries) {
      for (const leaf of country.children) {
        for (const t of matchTokensForLeaf(country, leaf)) {
          if (t === h) {
            return {
              scope: 'leaf',
              groupKey: group.groupKey,
              groupLabel: group.groupLabel,
              countryKey: country.countryKey,
              countryLabel: country.countryLabel,
              leafKey: leaf.nodeKey,
              leafLabel: leaf.nodeLabel,
              matchedTerm: t,
            }
          }
        }
      }
      for (const t of matchTokensForCountryShallow(country)) {
        if (t === h) {
          return {
            scope: 'country',
            groupKey: group.groupKey,
            groupLabel: group.groupLabel,
            countryKey: country.countryKey,
            countryLabel: country.countryLabel,
            matchedTerm: t,
          }
        }
      }
    }
  }
  return null
}

function compareOverseasMatchCandidates(
  a: MatchProductToOverseasNodeResult,
  b: MatchProductToOverseasNodeResult,
  sourceForIndex: string,
): number {
  const la = a.matchedTerm.length
  const lb = b.matchedTerm.length
  if (la !== lb) return la - lb
  const ia = sourceForIndex.indexOf(a.matchedTerm)
  const ib = sourceForIndex.indexOf(b.matchedTerm)
  if (ia >= 0 && ib >= 0 && ia !== ib) return ia - ib
  return SCOPE_RANK_MATCH[a.scope] - SCOPE_RANK_MATCH[b.scope]
}

/**
 * 단일 haystack 매칭보다 안전한 1순위: 제목·목적지를 쪼갠 blob마다 `matchProductToOverseasNode`를 돌려
 * 가장 그럴듯한 leaf/country를 고른다 (`inferBrowseGeoFromDestinationText`와 동일 전략).
 */
function bestOverseasMatchFromDestinationBlobs(
  input: ProductLocationKeyMatchInput,
): MatchProductToOverseasNodeResult | null {
  const pd = (input.primaryDestination ?? '').trim()
  const dr = (input.destinationRaw ?? '').trim()
  const t = (input.title ?? '').trim()
  if (!pd && !dr && !t) return null

  const sourceForIndex = [pd, dr, t].filter(Boolean).join(' ')
  const blobs = narrowBlobsByPrimaryHangulHint(
    candidateDestinationBlobsForMatch({ primaryDestination: pd, destinationRaw: dr, title: t }),
    input,
  )
  let best: MatchProductToOverseasNodeResult | null = null
  for (const blob of blobs) {
    const match = matchProductToOverseasNode({
      title: blob,
      originSource: '',
      primaryDestination: input.primaryDestination?.trim() || null,
      destinationRaw: input.destinationRaw?.trim() || null,
    })
    if (!match?.countryKey) continue
    if (!best || compareOverseasMatchCandidates(match, best, sourceForIndex) > 0) best = match
  }
  return best
}

function trimHaystackBody(body: string | null | undefined): string | null {
  const t = (body ?? '').trim()
  if (!t) return null
  return t.length > BODY_MAX ? t.slice(0, BODY_MAX) : t
}

/**
 * `matchProductToOverseasNode` 결과( leaf / country )에서 browse continent·country slug·city slug를 복원.
 * `inferBrowseGeoFromDestinationText`와 동일한 라벨→슬러그 규칙 — 단일 소스로 country/city 표기를 맞춘다.
 */
function browseGeoFromTreeMatch(m: MatchProductToOverseasNodeResult): {
  continent: string
  country: string
  city: string | null
} | null {
  if (m.scope === 'group' || !m.countryKey) return null
  const found = findCountryInTree(m.groupKey, m.countryKey)
  if (!found) return null

  const continent = continentTabIdForMatch(m.groupKey, m.countryKey)
  const country =
    found.group.groupKey === 'japan'
      ? countrySlugFromLabel(found.group.groupLabel)
      : countrySlugFromLabel(found.country.countryLabel)

  if (m.scope === 'leaf' && m.leafKey && m.leafLabel) {
    const leaf = found.country.children.find((l) => l.nodeKey === m.leafKey)
    const isWholeCountryLeaf = m.leafLabel.trim() === found.country.countryLabel.trim()
    if (isWholeCountryLeaf) {
      return { continent, country, city: null }
    }
    const terms = leaf ? collectLeafTerms(found.country, leaf) : [m.leafLabel]
    const city = citySlugFromTermsAndLabel(m.leafLabel, terms)
    return { continent, country, city }
  }

  return { continent, country, city: null }
}

/**
 * 트리 매칭으로 `countryKey` / `nodeKey` / `groupKey` 및 신뢰도 메타를 채운다.
 * 매칭 실패 시 전부 null.
 */
export function deriveProductLocationKeyFieldsForPrisma(
  input: ProductLocationKeyMatchInput
): ProductLocationKeyPrismaFields {
  const empty: ProductLocationKeyPrismaFields = {
    countryKey: null,
    nodeKey: null,
    groupKey: null,
    locationMatchConfidence: null,
    locationMatchSource: null,
    continent: null,
    continentKey: null,
    cityKey: null,
    country: null,
    city: null,
  }

  try {
    const title = (input.title ?? '').trim()
    const originSource = (input.originSource ?? '').trim()
    if (!title && !originSource) return empty

    const body = trimHaystackBody(input.bodyText)
    /**
     * D-3-FIX: 일정 본문을 `destinationRaw`에 합치면 이탈리아+스위스 경유 등 **다른 국가 토큰**이
     * 더 길게 매칭되어 키·표기가 뒤틀린다. 목적지 메타가 이미 있으면 본문은 매칭 힙에 넣지 않는다.
     * (목적지가 비어 있을 때만 본문을 `destinationRaw` 대용으로 사용)
     */
    const hasStructuredDestination = Boolean(
      String(input.destinationRaw ?? '').trim() ||
        String(input.primaryDestination ?? '').trim() ||
        String(input.destination ?? '').trim(),
    )
    const destinationRawForMatch = hasStructuredDestination
      ? input.destinationRaw || null
      : body || input.destinationRaw || null

    const matchInput: OverseasProductMatchInput = {
      title: title || ' ',
      originSource: originSource || ' ',
      primaryDestination: input.primaryDestination,
      destinationRaw: destinationRawForMatch,
      primaryRegion: input.primaryRegion,
      destination: input.destination,
    }

    const bhCountry = String(input.browseHintCountry ?? '').trim()
    const bhCity = String(input.browseHintCity ?? '').trim()
    let m: MatchProductToOverseasNodeResult | null = null
    /**
     * DB browse 한글 국가(+도시)를 단독 힌트로 매칭 — 제목·일정에 섞인 다른 국가 토큰보다 우선.
     * 도시 힌트가 있으면 `베트남 나트랑`처럼 붙여 leaf까지 맞춘다. `일본`만 있으면 group만 걸릴 수 있어 그때는 앵커 미사용.
     */
    if (bhCountry && /[가-힣]/.test(bhCountry)) {
      const anchorTitle =
        bhCity &&
        /[가-힣]/.test(bhCity) &&
        bhCity !== bhCountry
          ? `${bhCountry} ${bhCity}`
          : bhCountry
      let anchor = matchProductToOverseasNode({
        title: anchorTitle,
        originSource: originSource || ' ',
        primaryDestination: null,
        destinationRaw: null,
        destination: null,
      })
      if ((!anchor || anchor.scope === 'group') && anchorTitle) {
        const exact = matchOverseasNodeByExactHangulHint(anchorTitle)
        if (exact && exact.scope !== 'group') anchor = exact
      }
      if (anchor && anchor.scope !== 'group') m = anchor
    }

    if (!m) {
      m =
        bestOverseasMatchFromDestinationBlobs(input) ?? matchProductToOverseasNode(matchInput)

      if (!m && hasStructuredDestination && body) {
        m = matchProductToOverseasNode({
          ...matchInput,
          destinationRaw:
            [String(input.destinationRaw ?? '').trim(), body].filter(Boolean).join(' \n ') || body,
        })
      }
    }

    if (!m) return empty

    const confidence = m.scope === 'leaf' ? 'high' : m.scope === 'country' ? 'medium' : 'low'
    const nodeKey = m.scope === 'leaf' && m.leafKey ? m.leafKey : null
    const countryKey = m.countryKey ?? null

    const browseGeoFromM = browseGeoFromTreeMatch(m)
    const browseGeo =
      browseGeoFromM ??
      (m.scope === 'group' || !m.countryKey
        ? inferBrowseGeoFromDestinationText({
            primaryDestination: input.primaryDestination,
            destinationRaw: input.destinationRaw,
            title: title || null,
          })
        : null)

    const continent =
      browseGeo?.continent ??
      (m.countryKey ? continentTabIdForMatch(m.groupKey, m.countryKey) : null)

    return {
      countryKey,
      nodeKey,
      groupKey: m.groupKey,
      locationMatchConfidence: confidence,
      locationMatchSource: `overseas-tree:${m.scope}`,
      continent,
      continentKey: null,
      cityKey: null,
      country: browseGeo?.country ?? null,
      city: browseGeo?.city ?? null,
    }
  } catch {
    return empty
  }
}

/** `ParsedProductForDB` + 일정 설명 blob → 관리자 직접 등록 경로용 */
export function itineraryDescriptionsBlob(
  itineraries: { description: string }[] | null | undefined
): string | null {
  if (!itineraries?.length) return null
  const t = itineraries
    .map((i) => (i.description ?? '').trim())
    .filter(Boolean)
    .join('\n')
  return trimHaystackBody(t)
}
