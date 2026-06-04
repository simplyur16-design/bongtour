/**
 * ybtour(노랑풍선) 등록 — 붙여넣기·제목·LLM 목적지 SSOT.
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'

export type YbtourRegisterDestinationResolved = {
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
}

const MARKETING_DEST_RE =
  /(?:숙박|폭포\s*뷰|폭포뷰|특급|전일정|식사\s*포함|VIP|리무진|국립공원|화이트샌드|모뉴먼트|#\d+대)/i

const REGION_TITLE_RE =
  /미서부|미동부|미남부|미국\s*일주|캐나다|미국|동부|서부|남부|유럽|일본|중국|동남아|호주|괌|하와이/i

function isYbtourMarketingDestination(s: string): boolean {
  const t = String(s ?? '').trim()
  if (!t || t.length < 3) return true
  return MARKETING_DEST_RE.test(t)
}

/** `방문도시` — 인천로스엔젤레스… 또는 콤마/하이픈 경로 */
export function extractYbtourVisitCitiesRawFromPaste(blob: string): string | null {
  const text = String(blob ?? '').replace(/\r/g, '')
  const m = text.match(/방문도시\s*[\t：:\s]*([^\n]+)/i)
  if (!m?.[1]) {
    const alt = text.match(/(?:여행지|여행도시)\s*[:：]?\s*([^\n|]+)/i)
    const line = alt?.[1]?.trim()
    return line && line.length >= 2 ? line.slice(0, 500) : null
  }
  let line = m[1].replace(/\s+/g, ' ').trim()
  if (!line || /예약|좌석|출발/i.test(line)) return null
  if (!/[,，]/.test(line) && /\(\d+\)/.test(line)) {
    line = line
      .replace(/\((\d+)\)/g, ', ')
      .replace(/(인천)(?=[가-힣A-Za-z])/g, '$1, ')
      .replace(/,\s*,/g, ', ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return line.slice(0, 500)
}

function parseCityTokens(raw: string): string[] {
  return raw
    .split(/[,，、/／·|]/)
    .map((p) =>
      p
        .replace(/\(\d+\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length >= 2 && !/^(인천|ICN|서울|한국)$/i.test(p))
}

function regionsFromYbtourTitle(title: string): string[] {
  const preHash = title.split('#')[0] ?? title
  const hits = preHash.match(new RegExp(REGION_TITLE_RE.source, 'gi')) ?? []
  return [...new Set(hits.map((h) => h.replace(/\s+/g, ' ').trim()))]
}

function buildRepresentative(title: string, citiesRaw: string | null): string {
  const regions = regionsFromYbtourTitle(title)
  const cities = citiesRaw ? parseCityTokens(citiesRaw) : []
  const lead = cities.slice(0, 2)
  if (regions.length > 0) {
    const region = regions.slice(0, 2).join(' · ')
    if (lead.length > 0) return `${region} (${lead.join(' · ')})`.slice(0, 96)
    return region.slice(0, 96)
  }
  if (lead.length > 0) {
    return (cities.length <= 3 ? cities.join(' · ') : `${lead.join(' · ')} 외`).slice(0, 96)
  }
  return ''
}

export function resolveYbtourRegisterDestination(input: {
  pastedBody?: string | null
  title: string
  llmDestination?: string | null
}): YbtourRegisterDestinationResolved {
  const title = String(input.title ?? '').trim()
  const paste = String(input.pastedBody ?? '').slice(0, 12_000)
  const citiesRaw = extractYbtourVisitCitiesRawFromPaste(paste)
  const fromPaste = buildRepresentative(title, citiesRaw)
  const llm = String(input.llmDestination ?? '').trim()
  const fromLlm = llm && !isYbtourMarketingDestination(llm) ? llm : ''
  const fromTitle = extractDestinationFromTitle(title)
  const destination =
    fromPaste ||
    fromLlm ||
    (fromTitle !== '미지정' ? fromTitle : '') ||
    '미지정'
  const destinationRaw =
    citiesRaw || (fromLlm && !isYbtourMarketingDestination(fromLlm) ? fromLlm : null)
  const primary = destination === '미지정' ? '' : destination
  return {
    destination: primary,
    destinationRaw,
    primaryDestination: primary || null,
  }
}
