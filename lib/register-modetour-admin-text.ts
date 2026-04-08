/**
 * 모두투어: 관리자·공개 상세로 넘길 포함/불포함/호텔 요약 textarea 정리 (등록 파이프라인 전용).
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'

function countNonEmptyLines(s: string | null | undefined): number {
  if (!s?.trim()) return 0
  return s.split('\n').filter((l) => l.replace(/\s/g, '').length > 0).length
}

function lineKeyForDedup(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

const HEADER_LINE_RES = [
  /^[\s\-•*·]*포함\s*[/／]\s*불포함\s*사항\s*:?\s*$/iu,
  /^[\s\-•*·]*포함\s*사항\s*:?\s*$/iu,
  /^[\s\-•*·]*불포함\s*사항\s*:?\s*$/iu,
]

function isHeaderOnlyLine(line: string): boolean {
  const t = line.trim()
  return HEADER_LINE_RES.some((re) => re.test(t))
}

function stripInlineIncExcHeaders(line: string): string {
  return line
    .replace(
      /^(?:[\-•*·]\s*)?(?:포함\s*[/／]\s*불포함\s*사항|포함\s*사항|불포함\s*사항)\s*:?\s*/iu,
      ''
    )
    .trim()
}

function isLocalJoinLine(line: string): boolean {
  return /현지\s*합류|현지합류/.test(line)
}

function isSingleRoomSurchargeLine(line: string): boolean {
  return /(1\s*인\s*(?:객실|실)|1인실|독실|싱글\s*차지|single\s*(?:room|charge))/i.test(line)
}

function extractKrwFromLine(line: string): number | null {
  const m = line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원?/i)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function buildCanonicalSingleRoomLine(amount: number | null): string | null {
  if (amount != null && amount > 0) {
    return `1인 객실 추가 사용료 ${amount.toLocaleString('ko-KR')}원`
  }
  return '1인 객실 추가 사용료 별도'
}

function splitLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function dedupeLinesPreserveOrder(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ln of lines) {
    const k = lineKeyForDedup(ln)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(ln)
  }
  return out
}

function cleanHotelBullet(line: string): string {
  return line.replace(/^[\s\-•*·︱|]+/, '').replace(/\s+/g, ' ').trim()
}

/** 마지막 줄이 앞 줄들을 합친 합본인 경우 제거 */
function dropTrailingAggregateHotelBlock(lines: string[]): string[] {
  if (lines.length < 2) return lines
  const last = lines[lines.length - 1]!
  const rest = lines.slice(0, -1)
  const lastC = last.replace(/\s+/g, '')
  if (lastC.length < 35) return lines
  let hits = 0
  for (const r of rest) {
    const rc = r.replace(/\s+/g, '')
    if (rc.length < 10) continue
    if (lastC.includes(rc)) hits++
  }
  return hits >= 2 ? rest : lines
}

export function normalizeModetourHotelSummaryComposeBlock(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  let lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => cleanHotelBullet(l))
    .filter(Boolean)
  lines = dedupeLinesPreserveOrder(lines)
  lines = dropTrailingAggregateHotelBlock(lines)
  lines = dedupeLinesPreserveOrder(lines)
  const out = lines.join('\n').trim()
  return out || null
}

function normalizeModetourIncludedBlock(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const rawLines = splitLines(text)
  const out: string[] = []
  for (let ln of rawLines) {
    if (isHeaderOnlyLine(ln)) continue
    ln = stripInlineIncExcHeaders(ln)
    if (!ln || isHeaderOnlyLine(ln)) continue
    if (isLocalJoinLine(ln)) continue
    if (isSingleRoomSurchargeLine(ln)) continue
    out.push(ln)
  }
  const deduped = dedupeLinesPreserveOrder(out)
  return deduped.length ? deduped.join('\n') : null
}

function normalizeModetourExcludedBlock(
  text: string | null | undefined,
  opts: { parsedAmount: number | null }
): { text: string | null; dedupedSingleRoomSurcharge: boolean } {
  if (!text?.trim()) {
    const only =
      opts.parsedAmount != null && opts.parsedAmount > 0 ? buildCanonicalSingleRoomLine(opts.parsedAmount) : null
    return { text: only, dedupedSingleRoomSurcharge: Boolean(only) }
  }
  const rawLines = splitLines(text)
  const nonSingle: string[] = []
  const singleLines: string[] = []

  for (let ln of rawLines) {
    if (isHeaderOnlyLine(ln)) continue
    ln = stripInlineIncExcHeaders(ln)
    if (!ln || isHeaderOnlyLine(ln)) continue
    if (isLocalJoinLine(ln)) continue
    if (isSingleRoomSurchargeLine(ln)) {
      singleLines.push(ln)
      continue
    }
    nonSingle.push(ln)
  }

  let amount: number | null = opts.parsedAmount != null && opts.parsedAmount > 0 ? opts.parsedAmount : null
  for (const sl of singleLines) {
    const a = extractKrwFromLine(sl)
    if (a != null) amount = amount == null ? a : Math.max(amount, a)
  }
  const hadSingle = singleLines.length > 0
  const canonical = hadSingle || amount != null ? buildCanonicalSingleRoomLine(amount) : null
  const dedupedSingleRoomSurcharge = Boolean(
    canonical &&
      (singleLines.length > 1 ||
        singleLines.some((sl) => lineKeyForDedup(sl) !== lineKeyForDedup(canonical)))
  )

  let body = dedupeLinesPreserveOrder(nonSingle)
  if (canonical) {
    const canonAmt = extractKrwFromLine(canonical)
    body = body.filter((ln) => {
      if (isSingleRoomSurchargeLine(ln)) return false
      if (canonAmt != null && extractKrwFromLine(ln) === canonAmt) return false
      return true
    })
    body = dedupeLinesPreserveOrder([...body, canonical])
  }

  const joined = body.join('\n').trim()
  return { text: joined || null, dedupedSingleRoomSurcharge }
}

export function normalizeModetourRegisterAdminTextareas(parsed: RegisterParsed): RegisterParsed {
  const beforeIncludedCount = countNonEmptyLines(parsed.includedText)
  const beforeExcludedCount = countNonEmptyLines(parsed.excludedText)
  const beforeHotelSummaryCount = countNonEmptyLines(parsed.hotelSummaryText)

  const includedText = normalizeModetourIncludedBlock(parsed.includedText)
  const parsedAmt =
    parsed.singleRoomSurchargeAmount != null && Number.isFinite(parsed.singleRoomSurchargeAmount)
      ? Math.round(Number(parsed.singleRoomSurchargeAmount))
      : null
  const { text: excludedText, dedupedSingleRoomSurcharge } = normalizeModetourExcludedBlock(parsed.excludedText, {
    parsedAmount: parsedAmt,
  })
  const hotelSummaryText = normalizeModetourHotelSummaryComposeBlock(parsed.hotelSummaryText)

  const afterIncludedCount = countNonEmptyLines(includedText)
  const afterExcludedCount = countNonEmptyLines(excludedText)
  const afterHotelSummaryCount = countNonEmptyLines(hotelSummaryText)

  let singleRoomSurchargeDisplayText = parsed.singleRoomSurchargeDisplayText ?? null
  if (excludedText) {
    const srLine =
      splitLines(excludedText).find(
        (ln) => isSingleRoomSurchargeLine(ln) && /추가\s*사용료|추가요금|별도/.test(ln)
      ) ?? splitLines(excludedText).find((ln) => isSingleRoomSurchargeLine(ln))
    if (srLine) singleRoomSurchargeDisplayText = srLine
  }

  console.info('[modetour-admin-text-normalize]', {
    beforeIncludedCount,
    afterIncludedCount,
    beforeExcludedCount,
    afterExcludedCount,
    beforeHotelSummaryCount,
    afterHotelSummaryCount,
    dedupedSingleRoomSurcharge,
  })

  return {
    ...parsed,
    includedText,
    excludedText,
    hotelSummaryText,
    ...(singleRoomSurchargeDisplayText !== parsed.singleRoomSurchargeDisplayText
      ? { singleRoomSurchargeDisplayText }
      : {}),
  }
}
