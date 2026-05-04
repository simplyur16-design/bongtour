/**
 * 교보이지(kyowontour) 관리자 등록 — 「꼭 확인하세요」용 문구만 본문에서 자른다.
 * 일정·호텔·가격·옵션·쇼핑·항공 입력 구조는 건드리지 않는다.
 *
 * 구간: `예약 시 유의 사항`, `여행 시 유의 사항`, 짧은 제목의 입국·비자·전자신고 류 소제목 블록.
 * 문장 단위 후처리는 `must-know-trip-readiness-pipe-kyowontour`와 동일 키워드 기준.
 *
 * 포함/불포함 구조화는 `register-kyowontour-basic`의 `parseKyowontourIncludedExcludedSection`이 담당한다.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import { buildMustKnowPipeResultFromNoticeBlob } from '@/lib/must-know-trip-readiness-pipe-kyowontour'

const NL = /\r?\n/

function linesOf(s: string): string[] {
  return s.split(NL)
}

function trimJoin(lines: string[]): string {
  return lines
    .map((l) => l.replace(/\s+$/g, '').trimEnd())
    .join('\n')
    .trim()
}

function findLineIndex(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (re.test(t)) return i
  }
  return -1
}

function sliceSectionByStartHeader(
  lines: string[],
  startRe: RegExp,
  endRes: RegExp[]
): string[] | null {
  const i0 = findLineIndex(lines, startRe)
  if (i0 < 0) return null
  const out: string[] = []
  for (let i = i0 + 1; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!t) {
      out.push(lines[i]!)
      continue
    }
    if (endRes.some((re) => re.test(t))) break
    out.push(lines[i]!)
  }
  return out
}

/** 노랑풍선/교보이지 붙여넣기 본문과 동일한 섹션 경계(모두투어 SSOT와 동일 앵커 세트). */
const KYOWONTOUR_MUST_KNOW_END_RES: RegExp[] = [
  /^\s*상품\s*가격/,
  /^\s*포함\s*\/\s*불포함/,
  /^\s*포함내역\s*[:：]?\s*$/,
  /^\s*불포함내역\s*[:：]?\s*$/,
  /^\s*일정표\s*$/,
  /^\s*상세일정\s*$/,
  /^\s*간략일정\s*$/,
  /^\s*여행일정\s*$/,
  /^\s*\d{1,2}일차\b/,
  /^\s*항공여정\s*$/,
  /^\s*예정호텔\b/,
  /^\s*호텔정보\s*$/,
  /^\s*쇼핑/,
  /^\s*선택관광|현지옵션/,
  /^\s*미팅|모임장소/,
  /^\s*가이드\s*\/\s*인솔자/,
  /^\s*예약\s*시\s*유의\s*사항$/,
  /^\s*여행\s*시\s*유의\s*사항$/,
]

const KYOWONTOUR_NOTICE_START_HEADERS: RegExp[] = [
  /^예약\s*시\s*유의\s*사항$/,
  /^예약시\s*유의사항$/,
  /^여행\s*시\s*유의\s*사항$/,
  /^여행시\s*유의사항$/,
]

function isImmigrationStyleHeaderLine(t: string): boolean {
  const s = t.replace(/\s+/g, ' ').trim()
  if (s.length < 6 || s.length > 56) return false
  return /전자\s*입국|입국신고|온라인\s*입국|Visit\s*Japan|입국\s*심사|비자\s*필요|무비자|출입국\s*심사|세관\s*신고|e\s*TA\b|ESTA/i.test(s)
}

function collectKyowontourMustKnowSectionLines(lines: string[]): string[] {
  const chunks: string[][] = []

  for (const startRe of KYOWONTOUR_NOTICE_START_HEADERS) {
    const sl = sliceSectionByStartHeader(lines, startRe, KYOWONTOUR_MUST_KNOW_END_RES)
    if (sl?.length) chunks.push(sl)
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!isImmigrationStyleHeaderLine(t)) continue
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sl = sliceSectionByStartHeader(lines.slice(i), new RegExp(`^${escaped}$`), KYOWONTOUR_MUST_KNOW_END_RES)
    if (sl?.length) chunks.push(sl)
  }

  if (!chunks.length) return []
  const seen = new Set<string>()
  const merged: string[] = []
  for (const ch of chunks) {
    for (const raw of ch) {
      const key = raw.replace(/\s+/g, ' ').trim()
      if (!key) continue
      const k = key.slice(0, 200)
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(raw)
    }
  }
  return merged
}

export function extractKyowontourMustKnowFromNormalizedBody(
  normalizedRaw: string,
  extraNoticeBlob?: string | null
): {
  mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> | null
} | null {
  const raw = normalizedRaw?.trim()
  if (!raw && !(extraNoticeBlob ?? '').trim()) return null
  const lines = raw ? linesOf(raw) : []
  const secLines = collectKyowontourMustKnowSectionLines(lines)
  const main = trimJoin(secLines)
  const extra = (extraNoticeBlob ?? '').trim()
  const blob = [main, extra].filter(Boolean).join('\n\n').trim()
  if (!blob) return null
  return buildMustKnowPipeResultFromNoticeBlob(blob)
}

export function applyKyowontourBasicInfoMustKnowExtract(
  parsed: RegisterParsed,
  normalizedRaw: string
): RegisterParsed {
  const visaNote = parsed.detailBodyStructured?.includedExcludedStructured?.noteText?.trim() ?? ''
  const ex = extractKyowontourMustKnowFromNormalizedBody(normalizedRaw, visaNote || null)
  if (!ex?.mustKnowItems?.length) return parsed

  return {
    ...parsed,
    mustKnowItems: ex.mustKnowItems,
    mustKnowRaw: null,
    mustKnowSource: 'supplier',
  }
}
