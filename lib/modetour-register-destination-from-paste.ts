/**
 * modetour(모두투어) 등록 — 붙여넣기·제목·LLM 목적지 SSOT.
 * 공급사 공용 모듈로 합치지 않는다.
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { filterRegisterDestinationTitlePlaceTokens } from '@/lib/register-destination-tour-style-noise'

export type ModetourRegisterDestinationResolved = {
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
}

const MARKETING_DEST_RE =
  /(?:숙박|폭포\s*뷰|폭포뷰|특급|전일정|식사\s*포함|게릴라|품격|노쇼핑|VIP|리무진|버스\s*탑승|이상\s*객실|뷰\s*객실|나이아가라\s*\d+층)/i

const REGION_TITLE_RE =
  /미동부|미서부|미남부|미국\s*일주|캐나다|미국|동부|서부|남부|유럽|일본|중국|동남아|호주|괌|하와이|싱가포르|태국|베트남|필리핀|대만|홍콩|마카오|다낭|북해도|오사카|도쿄|방콕/i

const TITLE_PROMO_BRACKET_RE =
  /출발\s*확정|노옵션|노쇼핑|게릴라|품격|스테디|베스트|홈\s*쇼핑|HIT|오전\s*출발|저녁\s*출발|휴양형/i

const TITLE_DURATION_RE = /\d+\s*(?:박\s*\d+\s*)?일(?:\s|$)/i
const TITLE_DURATION_TOKEN_RE = /^\d+\s*(?:박\s*\d+\s*)?일$/i

function stripTitleDurationSuffix(s: string): string {
  return String(s ?? '')
    .replace(TITLE_DURATION_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isTitleDurationToken(s: string): boolean {
  return TITLE_DURATION_TOKEN_RE.test(String(s ?? '').trim())
}

/** API-only·붙여넣기 없을 때 — `[다낭]`·`홍콩/마카오` 등 제목 힌트 */
export function extractModetourTravelCitiesHintFromTitle(title: string): string | null {
  const bracketParts: string[] = []
  for (const m of String(title ?? '').matchAll(/\[([^\]]{2,32})\]/g)) {
    const inner = m[1]?.trim() ?? ''
    if (!inner || TITLE_PROMO_BRACKET_RE.test(inner)) continue
    bracketParts.push(inner)
  }
  let t = String(title ?? '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/#[^\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = stripTitleDurationSuffix(t)
  const slashParts = filterRegisterDestinationTitlePlaceTokens(
    t
      .split(/[/／·+]/)
      .map((p) => stripTitleDurationSuffix(p.replace(/\([^)]*\)/g, ' ')))
      .filter(
        (p) =>
          p.length >= 2 &&
          p.length <= 20 &&
          !/^\d+$/.test(p) &&
          !isTitleDurationToken(p) &&
          !TITLE_PROMO_BRACKET_RE.test(p),
      ),
  )
  // REGRESSION-FREEZE[register-destination-reject-ilju]: drop bare 일주 tokens — manifest
  const merged = [...new Set([...bracketParts, ...slashParts])]
  return merged.length > 0 ? merged.join(', ') : null
}

function isModetourMarketingDestination(s: string): boolean {
  const t = String(s ?? '').trim()
  if (!t || t.length < 3) return true
  if (MARKETING_DEST_RE.test(t)) return true
  if (/^\[.+\]$/.test(t) && /노쇼핑|노옵션|노팁|VIP|품격|게릴라/i.test(t)) return true
  return false
}

/** 상세 붙여넣기 — `여행도시` 라벨 다음 줄(또는 동일 줄) 도시 목록 */
export function extractModetourTravelCitiesRawFromPaste(blob: string): string | null {
  const text = String(blob ?? '').replace(/\r/g, '')
  const block = text.match(
    /여행도시\s*(?:\n\s*|\s*[:：]\s*)([\s\S]*?)(?=\n\s*(?:예약인원|상품가격|포함\s*사항|불포함|선택경비|여행\s*후기)|$)/i,
  )
  if (!block?.[1]) {
    const inline = text.match(/(?:여행지|방문도시|목적지)\s*[:：]?\s*([^\n|]+)/i)
    const line = inline?.[1]?.trim()
    return line && line.length >= 2 ? line.slice(0, 500) : null
  }
  const line = block[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!line || /예약|가격|성인|유류/i.test(line)) return null
  return line.slice(0, 500)
}

function parseCityTokens(raw: string): string[] {
  return raw
    .split(/[,，、/／·|]/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2 && !/^\d+$/.test(p) && !/^(인천|ICN|서울|한국)$/i.test(p))
}

function regionsFromModetourTitle(title: string): string[] {
  const hits = title.match(new RegExp(REGION_TITLE_RE.source, 'gi')) ?? []
  return [...new Set(hits.map((h) => h.replace(/\s+/g, ' ').trim()))]
}

function buildRepresentative(title: string, citiesRaw: string | null): string {
  const regions = regionsFromModetourTitle(title)
  const cities = citiesRaw ? parseCityTokens(citiesRaw) : []
  const lead = cities.slice(0, 2)
  if (regions.length > 0) {
    const region = regions.slice(0, 2).join(' · ')
    const leadDistinct = lead.filter((c) => !regions.some((r) => r.includes(c) || c.includes(r)))
    if (leadDistinct.length > 0) return `${region} (${leadDistinct.join(' · ')})`.slice(0, 96)
    return region.slice(0, 96)
  }
  if (cities.length > 0) {
    return (cities.length <= 3 ? cities.join(' · ') : `${lead.join(' · ')} 외 ${cities.length - 2}도시`).slice(
      0,
      96,
    )
  }
  return ''
}

export function resolveModetourRegisterDestination(input: {
  pastedBody?: string | null
  title: string
  llmDestination?: string | null
  travelCitiesRaw?: string | null
}): ModetourRegisterDestinationResolved {
  const title = String(input.title ?? '').trim()
  const paste = String(input.pastedBody ?? '').slice(0, 12_000)
  const citiesRaw =
    extractModetourTravelCitiesRawFromPaste(paste) ||
    String(input.travelCitiesRaw ?? '').trim() ||
    extractModetourTravelCitiesHintFromTitle(title) ||
    null
  const fromPaste = buildRepresentative(title, citiesRaw)
  const llm = String(input.llmDestination ?? '').trim()
  const fromLlm = llm && !isModetourMarketingDestination(llm) ? llm : ''
  const fromTitle = extractDestinationFromTitle(title)
  const destination =
    fromPaste ||
    fromLlm ||
    (fromTitle !== '미지정' ? fromTitle : '') ||
    '미지정'
  const destinationRaw =
    citiesRaw || (fromLlm && !isModetourMarketingDestination(fromLlm) ? fromLlm : null)
  const primary = destination === '미지정' ? '' : destination
  return {
    destination: primary,
    destinationRaw,
    primaryDestination: primary || null,
  }
}
