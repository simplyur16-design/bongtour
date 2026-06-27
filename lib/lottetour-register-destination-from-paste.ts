/**
 * lottetour(롯데관광) 등록 — 붙여넣기·제목 목적지 SSOT.
 * REGRESSION-FREEZE[lottetour-register-destination]: manifest
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import {
  acceptSupplierRegisterDestinationCandidate,
  isSupplierRegisterDestinationUiLabel,
} from '@/lib/supplier-register-destination-forbidden'
import {
  isSupplierTitlePromoBadgeText,
  normalizeSupplierRegisterListingTitle,
} from '@/lib/supplier-product-title-display'

export type LottetourRegisterDestinationResolved = {
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
}

const MARKETING_DEST_RE =
  /(?:숙박|폭포\s*뷰|폭포뷰|특급|전일정|식사\s*포함|VIP|리무진|품격|노쇼핑|게릴라|스테디|베스트|홈\s*쇼핑)/i

const REGION_TITLE_RE =
  /미동부|미서부|미남부|미국\s*일주|캐나다|미국|동부|서부|남부|유럽|일본|중국|동남아|호주|괌|하와이|싱가포르|태국|베트남|필리핀|대만|홍콩|마카오|다낭|북해도|오사카|도쿄|방콕|튀르키|터키|나트랑|푸꾸옥|코타|발리|세부|치앙/i

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

export function extractLottetourTravelCitiesHintFromTitle(title: string): string | null {
  const bracketParts: string[] = []
  for (const m of String(title ?? '').matchAll(/\[([^\]]{2,32})\]/g)) {
    const inner = m[1]?.trim() ?? ''
    if (!inner || isSupplierTitlePromoBadgeText(inner)) continue
    bracketParts.push(inner)
  }
  let t = String(title ?? '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/#[^\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  t = stripTitleDurationSuffix(t)
  const slashParts = t
    .split(/[/／·+]/)
    .map((p) => stripTitleDurationSuffix(p.replace(/\([^)]*\)/g, ' ')))
    .filter(
      (p) =>
        p.length >= 2 &&
        p.length <= 24 &&
        !/^\d+$/.test(p) &&
        !isTitleDurationToken(p) &&
        !isSupplierTitlePromoBadgeText(p) &&
        !isSupplierRegisterDestinationUiLabel(p),
    )
  const merged = [...new Set([...bracketParts, ...slashParts])]
  return merged.length > 0 ? merged.join(', ') : null
}

function isLottetourMarketingDestination(s: string): boolean {
  const t = String(s ?? '').trim()
  if (!t || t.length < 2) return true
  if (isSupplierRegisterDestinationUiLabel(t)) return true
  if (MARKETING_DEST_RE.test(t)) return true
  return false
}

/** 롯데관광 붙여넣기 — `여행도시`·`여행 주요일정` 라벨 다음 도시 목록 */
export function extractLottetourTravelCitiesRawFromPaste(blob: string): string | null {
  const text = String(blob ?? '').replace(/\r/g, '')
  const block = text.match(
    /(?:여행\s*도시|여행\s*주요\s*일정)\s*(?:\n\s*|\s*[:：]\s*)([\s\S]*?)(?=\n\s*(?:예약|출발|상품\s*가격|포함|불포함|일정표|여행\s*일정|항공|쇼핑|선택관광)|$)/i,
  )
  if (block?.[1]) {
    const line = block[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
    if (line && line.length >= 2 && !/예약|가격|성인|유류/i.test(line)) {
      return line.slice(0, 500)
    }
  }
  const inline = text.match(/(?:여행지|방문도시|목적지)\s*[:：]?\s*([^\n|]+)/i)
  const line = inline?.[1]?.trim()
  return line && line.length >= 2 && !isSupplierRegisterDestinationUiLabel(line) ? line.slice(0, 500) : null
}

function parseCityTokens(raw: string): string[] {
  return raw
    .split(/[,，、/／·|]/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(
      (p) =>
        p.length >= 2 &&
        !/^\d+$/.test(p) &&
        !/^(인천|ICN|서울|한국)$/i.test(p) &&
        !isSupplierRegisterDestinationUiLabel(p),
    )
}

function regionsFromLottetourTitle(title: string): string[] {
  const hits = title.match(new RegExp(REGION_TITLE_RE.source, 'gi')) ?? []
  return [...new Set(hits.map((h) => h.replace(/\s+/g, ' ').trim()))]
}

function buildRepresentative(title: string, citiesRaw: string | null): string {
  const regions = regionsFromLottetourTitle(title)
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

export function resolveLottetourRegisterDestination(input: {
  pastedBody?: string | null
  title: string
  travelCitiesRaw?: string | null
}): LottetourRegisterDestinationResolved {
  const title = normalizeSupplierRegisterListingTitle(String(input.title ?? '').trim())
  const paste = String(input.pastedBody ?? '').slice(0, 12_000)
  const citiesRaw =
    extractLottetourTravelCitiesRawFromPaste(paste) ||
    String(input.travelCitiesRaw ?? '').trim() ||
    extractLottetourTravelCitiesHintFromTitle(title) ||
    null
  const fromPaste = acceptSupplierRegisterDestinationCandidate(buildRepresentative(title, citiesRaw))
  const fromTitle = extractDestinationFromTitle(title)
  const fromTitleOk =
    fromTitle !== '미지정' ? acceptSupplierRegisterDestinationCandidate(fromTitle) : null
  const destination = fromPaste || fromTitleOk || '미지정'
  const destinationRaw =
    citiesRaw && !isLottetourMarketingDestination(citiesRaw) ? citiesRaw : fromTitleOk
  const primary = destination === '미지정' ? '' : destination
  return {
    destination: primary,
    destinationRaw,
    primaryDestination: primary || null,
  }
}
