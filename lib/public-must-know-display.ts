/**
 * 공개 상세 「꼭 알아야 할 사항」— `mustKnowItems`만 사용(출입국·서류 중심 필터).
 *
 * 소비 규칙(전 공급사 공통):
 * - 데이터 소스는 `mustKnowItems`만 (`reservationNoticeRaw` 미사용)
 * - UI는 `MustKnowEssentialsSection`: 카드 1개 + bullet 리스트
 * - 항목이 없으면 기본 안내 문구(화면 컴포넌트)
 */
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { normalizeMustKnowCardFields } from '@/lib/must-know-card-dedupe'
import {
  normalizeTripReadinessDedupeKey,
  textPassesTripReadinessFilters,
} from '@/lib/must-know-trip-readiness-filters'

export type PublicMustKnowItemInput = {
  category: string
  title: string
  body: string
  raw?: string
}

const WS = /\s+/g

/**
 * 단일 카드 bullet용 1줄 문자열. 저장 구조·필터는 그대로 두고 표시만 합침.
 * 제목+본문이면 `제목: 본문` (본문이 제목으로 이미 시작하면 본문만).
 */
export function mustKnowItemToListLine(it: PublicMustKnowItemInput): string {
  const title = String(it.title ?? '').replace(WS, ' ').trim()
  const body = String(it.body ?? '').replace(WS, ' ').trim()
  if (!title && !body) return ''
  if (!title) return body
  if (!body) return title
  const tl = title.toLowerCase()
  const bl = body.toLowerCase()
  if (bl === tl || bl.startsWith(`${tl} `) || bl.startsWith(`${tl}:`) || bl.startsWith(`${tl}：`)) {
    return body
  }
  return `${title}: ${body}`
}

function hanatourMustKnowPriority(it: PublicMustKnowItemInput): number {
  const blob = `${it.title} ${it.body}`.toLowerCase()
  if (/비자|무비자|입국\s*시\s*유의|입국비자|입국.*비자|뉴질랜드|세관|반입\s*금지|여권\s*유효|전자기기|검사\s*협조/.test(blob))
    return 0
  if (/음식|금지\s*품목|유의\s*사항|취소료|약관/.test(blob)) return 2
  return 5
}

/** 하나투어: 한 줄에 `-`로 나열된 항목을 bullet로 분리 */
function expandHanatourBulletLine(line: string): string[] {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return []
  const parts = t.split(/\s*-\s+/).map((s) => s.trim()).filter((s) => s.length > 1)
  if (parts.length >= 2 && parts.length <= 24) return parts
  return [t]
}

/** 하나투어: 입국·비자 계열을 먼저 묶어 제목+bullet 구조로 쓴다. 구분 불가면 null(평면 리스트). */
export function groupHanatourMustKnowLines(lines: string[]): { primary: string[]; rest: string[] } | null {
  const priRe =
    /비자|무비자|입국|뉴질랜드|여권|유효기간|세관|음식물|전자기기|검사\s*협조|취소료|약관|유의\s*사항/i
  const primary: string[] = []
  const rest: string[] = []
  for (const line of lines) {
    if (priRe.test(line)) primary.push(line)
    else rest.push(line)
  }
  if (primary.length === 0) return null
  return { primary, rest }
}

export type BuildMustKnowDisplayLinesOpts = {
  originSource?: string | null
}

/** 필터·정규화된 `mustKnowItems` → 공개 리스트 줄 (빈 줄 제거) */
export function buildMustKnowDisplayLines(
  items: PublicMustKnowItemInput[],
  opts?: BuildMustKnowDisplayLinesOpts
): string[] {
  const lines = items.map(mustKnowItemToListLine).filter((s) => s.length > 0)
  if (normalizeSupplierOrigin(opts?.originSource ?? '') !== 'hanatour') return lines
  return lines.flatMap((line) => expandHanatourBulletLine(line))
}

export function filterPublicMustKnowItemsForTripReadiness(
  items: PublicMustKnowItemInput[] | null | undefined,
  maxItems = 6,
  originSource?: string | null
): PublicMustKnowItemInput[] {
  if (!items?.length) return []
  const out: PublicMustKnowItemInput[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const norm = normalizeMustKnowCardFields(String(it.title ?? ''), String(it.body ?? ''), {
      maxTitleLen: 48,
      maxBodyLen: 240,
    })
    const blob = `${norm.title} ${norm.body}`.trim()
    if (!textPassesTripReadinessFilters(blob)) continue
    const key = normalizeTripReadinessDedupeKey(norm.body || norm.title)
    if (!key || seen.has(key)) continue
    let dup = false
    for (const ex of seen) {
      if (key.includes(ex) || ex.includes(key)) {
        if (Math.abs(key.length - ex.length) < 8) dup = true
      }
    }
    if (dup) continue
    seen.add(key)
    out.push({
      ...it,
      title: norm.title,
      body: norm.body,
    })
    if (out.length >= maxItems) break
  }
  if (normalizeSupplierOrigin(originSource ?? '') === 'hanatour') {
    return [...out].sort((a, b) => hanatourMustKnowPriority(a) - hanatourMustKnowPriority(b))
  }
  return out
}
