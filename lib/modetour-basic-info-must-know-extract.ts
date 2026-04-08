/**
 * 모두투어 관리자 등록 — 「꼭 확인하세요」용 문구만 본문에서 자른다.
 * 일정·호텔·가격·옵션·쇼핑·항공 입력 구조는 건드리지 않는다.
 *
 * 구간: `예약 시 유의 사항`, `여행 시 유의 사항`, 짧은 제목의 입국·비자·전자신고 류 소제목 블록.
 * 문장 단위 후처리는 `must-know-trip-readiness-pipe-modetour`와 동일 키워드 기준.
 *
 * 포함/불포함: `포함 사항`~`불포함 사항`~`예약/여행 시 유의 사항` 직전까지 **헤더·번호 줄**만 결정적으로 분리 (줄 전체 `포함` 키워드 매칭 금지).
 */
import type { IncludedExcludedStructured } from '@/lib/detail-body-parser-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import { sanitizeIncludedExcludedItemsLines } from '@/lib/included-excluded-postprocess'
import { buildMustKnowPipeResultFromNoticeBlob } from '@/lib/must-know-trip-readiness-pipe-modetour'

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

const MODETOUR_MUST_KNOW_END_RES: RegExp[] = [
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

const MODETOUR_NOTICE_START_HEADERS: RegExp[] = [
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

function collectModetourMustKnowSectionLines(lines: string[]): string[] {
  const chunks: string[][] = []

  for (const startRe of MODETOUR_NOTICE_START_HEADERS) {
    const sl = sliceSectionByStartHeader(lines, startRe, MODETOUR_MUST_KNOW_END_RES)
    if (sl?.length) chunks.push(sl)
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!isImmigrationStyleHeaderLine(t)) continue
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sl = sliceSectionByStartHeader(lines.slice(i), new RegExp(`^${escaped}$`), MODETOUR_MUST_KNOW_END_RES)
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

export function extractModetourMustKnowFromNormalizedBody(
  normalizedRaw: string,
  extraNoticeBlob?: string | null
): {
  mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> | null
} | null {
  const raw = normalizedRaw?.trim()
  if (!raw && !(extraNoticeBlob ?? '').trim()) return null
  const lines = raw ? linesOf(raw) : []
  const secLines = collectModetourMustKnowSectionLines(lines)
  const main = trimJoin(secLines)
  const extra = (extraNoticeBlob ?? '').trim()
  const blob = [main, extra].filter(Boolean).join('\n\n').trim()
  if (!blob) return null
  return buildMustKnowPipeResultFromNoticeBlob(blob)
}

export function applyModetourBasicInfoMustKnowExtract(
  parsed: RegisterParsed,
  normalizedRaw: string
): RegisterParsed {
  const visaNote = parsed.detailBodyStructured?.includedExcludedStructured?.noteText?.trim() ?? ''
  const ex = extractModetourMustKnowFromNormalizedBody(normalizedRaw, visaNote || null)
  if (!ex?.mustKnowItems?.length) return parsed

  return {
    ...parsed,
    mustKnowItems: ex.mustKnowItems,
    mustKnowRaw: null,
    mustKnowSource: 'supplier',
  }
}

const MODETOUR_INC_EXC_END_RES: RegExp[] = [
  /^예약\s*시\s*유의\s*사항$/,
  /^예약시\s*유의사항$/,
  /^여행\s*시\s*유의\s*사항$/,
  /^여행시\s*유의사항$/,
]

function norm1(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function findLineIndexMod(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(norm1(lines[i]!))) return i
  }
  return -1
}

/** `포함 사항` 블록: 번호·→ 이어붙임 — `제세금 포함` 등 문맥은 줄 단위로만 유지 */
function modetourIncExcLinesToItems(rawLines: string[]): string[] {
  const items: string[] = []
  let buf = ''
  const flush = () => {
    const t = buf.replace(/\s+/g, ' ').trim()
    if (t) items.push(t.slice(0, 480))
    buf = ''
  }
  for (const raw of rawLines) {
    const t = norm1(raw)
    if (!t) continue
    if (/^포함\s*사항|^불포함\s*사항|^포함\s*\/\s*불포함\s*사항/i.test(t)) continue
    if (/^\d+[.)]\s/.test(t)) {
      flush()
      buf = t
    } else if (/^→|^[\-–—]\s+|^※\s*/.test(t) && buf) {
      buf = `${buf} ${t}`
    } else if (buf && !/^\d+[.)]\s/.test(t) && t.length < 200) {
      buf = `${buf} ${t}`
    } else {
      flush()
      buf = t
    }
  }
  flush()
  return items.slice(0, 40)
}

function condenseModetourVisaNoticeLine(s: string): string {
  const t = norm1(s)
  if (t.length <= 220) return t
  const dot = t.search(/[.。]\s/)
  if (dot > 36 && dot < 260) return t.slice(0, dot + 1).trim()
  return `${t.slice(0, 200)}…`
}

/** 불포함 목록에서 비자·입국·무비자·ETA 류 블록을 분리 → must-know 파이프로 병합 */
function partitionModetourExcludedVisaForMustKnow(excludedItems: string[]): {
  excludedItems: string[]
  visaNoticeBlob: string
} {
  const kept: string[] = []
  const visa: string[] = []
  for (const raw of excludedItems) {
    const t = norm1(raw)
    if (!t) continue
    const looksFeeOnly =
      /(?:가이드|기사|개인\s*경비|1인실|싱글|티켓|TAX|조식)/i.test(t) &&
      !/(?:무비자|비자|입국|ETA|eTA|전자\s*입국|온라인\s*입국)/i.test(t)
    if (looksFeeOnly && !/^\[/.test(t)) {
      kept.push(raw)
      continue
    }
    const visaLike =
      (/^\[/.test(t) && /(?:중국|무비자|비자|입국|eTA|ETA|전자\s*입국|온라인\s*입국)/i.test(t)) ||
      (t.length > 140 &&
        /(?:무비자\s*입국|비자\s*필요|전자\s*입국|온라인\s*입국|입국\s*시행|eTA|ETA|방문\s*목적)/i.test(
          t
        ) &&
        !/(?:가이드비|기사비)\s*[:：]?\s*[^\n]*인당/i.test(t))
    if (visaLike) {
      visa.push(condenseModetourVisaNoticeLine(t))
      continue
    }
    kept.push(raw)
  }
  return {
    excludedItems: kept,
    visaNoticeBlob: visa.filter(Boolean).join('\n').trim(),
  }
}

/**
 * 모두투어 전용: `포함 사항` ~ `불포함 사항` ~ (`예약 시 유의 사항`|`여행 시 유의 사항`) 직전.
 */
export function parseModetourIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split(/\r?\n/)
  const iInc = findLineIndexMod(lines, /^포함\s*사항\s*[:：]?\s*$/i)
  const iExc = findLineIndexMod(lines, /^불포함\s*사항\s*[:：]?\s*$/i)
  if (iInc < 0 || iExc < 0 || iExc <= iInc) {
    const empty = section.trim().length > 80
    return {
      includedItems: [],
      excludedItems: [],
      noteText: '',
      reviewNeeded: empty,
      reviewReasons: empty ? ['modetour_include_exclude_header_missing'] : [],
    }
  }
  let excEnd = lines.length
  for (let i = iExc + 1; i < lines.length; i++) {
    const t = norm1(lines[i]!)
    if (MODETOUR_INC_EXC_END_RES.some((re) => re.test(t))) {
      excEnd = i
      break
    }
  }
  const incRaw = lines.slice(iInc + 1, iExc)
  const excRaw = lines.slice(iExc + 1, excEnd)
  const includedItems = sanitizeIncludedExcludedItemsLines(modetourIncExcLinesToItems(incRaw))
  const rawExc = modetourIncExcLinesToItems(excRaw)
  const part = partitionModetourExcludedVisaForMustKnow(rawExc)
  const excludedItems = sanitizeIncludedExcludedItemsLines(part.excludedItems)
  const reviewNeeded =
    includedItems.length === 0 && excludedItems.length === 0 && section.trim().length > 60
  return {
    includedItems,
    excludedItems,
    noteText: part.visaNoticeBlob.slice(0, 8000),
    reviewNeeded,
    reviewReasons: reviewNeeded ? ['modetour_include_exclude_parse_empty'] : [],
  }
}
