/**
 * verygoodtour(참좋은여행) 등록 — 붙여넣기·제목·LLM 목적지 SSOT.
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
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
}): VerygoodtourRegisterDestinationResolved {
  const title = String(input.title ?? '').trim()
  const paste = String(input.pastedBody ?? '').slice(0, 12_000)
  const journeyRaw = extractVerygoodJourneyRawFromPaste(paste)
  const fromPaste = buildRepresentative(title, journeyRaw)
  const bracket =
    extractNonPolicyDestinationFragment(String(input.bracketDestination ?? '').trim()) || null
  const llm = String(input.llmDestination ?? '').trim()
  const llmUsable = llm && !isVerygoodMarketingDestination(llm) ? llm : ''
  const fromTitle = extractDestinationFromTitle(title)
  const destination =
    bracket ||
    fromPaste ||
    (fromTitle !== '미지정' ? fromTitle : '') ||
    llmUsable ||
    '미지정'
  const destinationRaw = journeyRaw || bracket || (llmUsable || null)
  const primary = destination === '미지정' ? '' : destination
  return {
    destination: primary,
    destinationRaw,
    primaryDestination: primary || null,
  }
}
