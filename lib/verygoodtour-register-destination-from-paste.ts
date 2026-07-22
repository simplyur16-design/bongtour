/**
 * verygoodtour(참좋은여행) 등록 — 붙여넣기·제목·LLM·일정 route 목적지 SSOT.
 * REGRESSION-FREEZE[verygoodtour-register-destination]: hash·route 목적지 — manifest
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { finalizeRegisterDestinationFields } from '@/lib/register-destination-finalize'
import {
  extractNonPolicyDestinationFragment,
  isVerygoodtourPolicyBracketDestination,
} from '@/lib/verygoodtour-listing-title-from-paste'

export type VerygoodtourRegisterDestinationResolved = {
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
}

const MARKETING_DEST_RE =
  /(?:숙박|폭포\s*뷰|폭포뷰|특급|전일정|식사\s*포함|VIP|리무진|버스\s*탑승|캐년\s*숙박|세도나)/i

const REGION_TITLE_RE =
  /미서부|미동부|미남부|미국\s*\d+대도시|캐나다\s*\d|캐나다|미국|5대캐년|동부|서부|유럽|일본|중국|동남아/i

const VERYGOOD_HASH_GEO_SKIP_RE =
  /^(?:전일(?:관광|일정)|(?:NO|노)\s*(?:쇼핑|옵션|팁)|딤섬|세트|제공|특급|출발확정|\d+\s*(?:박|일)|이스타|항공|유류)/i

const VERYGOOD_DOMESTIC_ROUTE_HUB_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주|ICN|GMP|PUS|TAE|CJJ)(?:국제?\s*공항)?$/iu

function isVerygoodMarketingDestination(s: string): boolean {
  const t = String(s ?? '').trim()
  if (!t || t.length < 3) return true
  if (isVerygoodtourPolicyBracketDestination(t)) return true
  return MARKETING_DEST_RE.test(t)
}

/** `여행여정` / `여행지` / `방문도시` 경로 문자열 */
export function extractVerygoodJourneyRawFromPaste(blob: string): string | null {
  const text = String(blob ?? '').replace(/\r/g, '')
  const journey = text.match(/여행여정\s*\n\s*([^\n■]+(?:\n[^\n■]+)?)/i)
  if (journey?.[1]) {
    const line = journey[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
    if (line.length >= 4) return line.slice(0, 500)
  }
  const inline = text.match(/(?:여행지|방문도시|여행도시)\s*[:：]?\s*([^\n|]+)/i)
  const line = inline?.[1]?.trim()
  return line && line.length >= 2 ? line.slice(0, 500) : null
}

function parseRouteCities(raw: string): string[] {
  const stripped = raw.replace(/\([^)]*\)/g, ' ')
  const parts = stripped
    .split(/[-–‑/,，、/／·|]/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2 && !/^(인천|ICN|서울|한국)$/i.test(p))
  return [...new Set(parts)]
}

function regionsFromVerygoodTitle(title: string): string[] {
  const hits = title.match(new RegExp(REGION_TITLE_RE.source, 'gi')) ?? []
  return [...new Set(hits.map((h) => h.replace(/\s+/g, ' ').trim()))]
}

function normalizeVerygoodHashGeoToken(raw: string): string {
  return String(raw ?? '')
    .replace(/_/g, ' ')
    .replace(/(?:딤섬|세트|제공|특가|할인|포함|미포함).*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `#말라카/겐팅` 등 해시 태그에서 지역 토큰 추출 */
export function extractVerygoodGeoTokensFromHashTitle(title: string): string[] {
  const t = String(title ?? '').trim()
  const hashIdx = t.indexOf('#')
  if (hashIdx < 0) return []
  const tail = t.slice(hashIdx + 1)
  const tokens = tail
    .split(/[/／·,，#\s]+/)
    .map((x) => normalizeVerygoodHashGeoToken(x))
    .filter((x) => x.length >= 2 && !VERYGOOD_HASH_GEO_SKIP_RE.test(x))
  return [...new Set(tokens)]
}

/** 일정 routeText에서 국내 허브를 제외한 해외 지명 후보 */
export function inferVerygoodRegisterDestinationFromScheduleRoutes(
  routes: readonly (string | null | undefined)[],
): string | null {
  const seen = new Set<string>()
  const foreign: string[] = []
  for (const raw of routes) {
    const route = String(raw ?? '').trim()
    if (!route) continue
    for (const seg of route
      .split(/\s+-\s+/)
      .map((s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 2)) {
      if (VERYGOOD_DOMESTIC_ROUTE_HUB_RE.test(seg)) continue
      if (seen.has(seg)) continue
      seen.add(seg)
      foreign.push(seg)
      if (foreign.length >= 3) break
    }
    if (foreign.length >= 3) break
  }
  if (foreign.length === 0) return null
  return foreign.slice(0, 3).join(' · ').slice(0, 96)
}

function buildFromHashAndScheduleRoutes(
  title: string,
  scheduleRouteTexts?: readonly (string | null | undefined)[],
): string {
  const hashGeo = extractVerygoodGeoTokensFromHashTitle(title)
  if (hashGeo.length >= 2) {
    return hashGeo.slice(0, 3).join(' · ').slice(0, 96)
  }
  const fromRoutes = scheduleRouteTexts?.length
    ? inferVerygoodRegisterDestinationFromScheduleRoutes(scheduleRouteTexts)
    : null
  if (fromRoutes) return fromRoutes
  if (hashGeo.length === 1 && !isVerygoodMarketingDestination(hashGeo[0]!)) {
    return hashGeo[0]!.slice(0, 96)
  }
  return ''
}

function buildRepresentative(title: string, journeyRaw: string | null): string {
  const regions = regionsFromVerygoodTitle(title)
  const cities = journeyRaw ? parseRouteCities(journeyRaw) : []
  const lead = cities.slice(0, 2)
  if (regions.length >= 2) {
    return regions.slice(0, 3).join(' · ').slice(0, 96)
  }
  if (regions.length === 1 && lead.length > 0) {
    return `${regions[0]} (${lead.join(' · ')})`.slice(0, 96)
  }
  if (regions.length === 1) return regions[0]!.slice(0, 96)
  if (lead.length > 0) {
    return (cities.length <= 3 ? cities.join(' · ') : `${lead.join(' · ')} 외`).slice(0, 96)
  }
  return ''
}

export function resolveVerygoodtourRegisterDestination(input: {
  pastedBody?: string | null
  title: string
  llmDestination?: string | null
  /** 제목 괄호에서 추출한 지명(정책 뱃지 제외) */
  bracketDestination?: string | null
  /** PackageDetail·facts 일정 routeText — 제목이 기간만 있을 때 해외 지명 폴백 */
  scheduleRouteTexts?: readonly (string | null | undefined)[]
}): VerygoodtourRegisterDestinationResolved {
  const title = String(input.title ?? '').trim()
  const paste = String(input.pastedBody ?? '').slice(0, 12_000)
  const journeyRaw = extractVerygoodJourneyRawFromPaste(paste)
  const fromPaste = buildRepresentative(title, journeyRaw)
  const fromHashOrRoutes = buildFromHashAndScheduleRoutes(title, input.scheduleRouteTexts)
  const bracket =
    extractNonPolicyDestinationFragment(String(input.bracketDestination ?? '').trim()) || null
  const llm = String(input.llmDestination ?? '').trim()
  const llmUsable = llm && !isVerygoodMarketingDestination(llm) ? llm : ''
  const fromTitle = extractDestinationFromTitle(title)
  const destination =
    bracket ||
    fromPaste ||
    fromHashOrRoutes ||
    (fromTitle !== '미지정' ? fromTitle : '') ||
    llmUsable ||
    '미지정'
  const destinationRaw =
    journeyRaw || bracket || fromHashOrRoutes || (llmUsable || null)
  // REGRESSION-FREEZE[register-destination-reject-ilju]: finalize pollution scrub — manifest
  return finalizeRegisterDestinationFields({
    title,
    destination,
    destinationRaw,
    primaryDestination: destination === '미지정' ? null : destination,
  })
}
