/**
 * 하나투어 관리자 등록 — 본문 **헤더 한 줄** 기준으로만 구간을 자른다.
 * 일정·호텔 SSOT는 건드리지 않으며, 포함/불포함/선택경비·유의·미팅·상품가격 보강만 수행한다.
 *
 * 「꼭 확인하세요」는 **`mustKnowItems`만** — `예약시 유의사항` 구간에서 문장 단위로 골라 채운다.
 * `mustKnowRaw` / `reservationNoticeRaw` 폴백 없음(`must-know-trip-readiness-pipe-hanatour`).
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import type { IncludedExcludedStructured } from '@/lib/detail-body-parser-types'
import { sanitizeIncludedExcludedItemsLines } from '@/lib/included-excluded-postprocess'
import { normalizeMustKnowCardFields } from '@/lib/must-know-card-dedupe'
import { buildMustKnowPipeResultFromNoticeBlob } from '@/lib/must-know-trip-readiness-pipe-hanatour'

const NL = /\r?\n/

/** `포함/불포함/선택경비 정보` 블록 종료 후보(다음 대제목 한 줄) */
const TRIPLE_BLOCK_END_LINE_RES: RegExp[] = [
  /^\s*상품\s*가격(?:\s|$)/,
  /^\s*예약시\s*유의사항/,
  /^\s*가이드\/인솔자\s*및\s*미팅정보/,
  /^\s*일정표\s*$/,
  /^\s*상세일정\s*$/,
  /^\s*간략일정\s*$/,
  /^\s*여행일정\s*$/,
  /^\s*\d{1,2}일차\b/,
  /^\s*항공여정\s*$/,
  /^\s*예정호텔\b/,
  /^\s*호텔정보\s*$/,
  /^\s*쇼핑정보\s*$/,
  /^\s*선택관광\b/,
  /^\s*현지옵션\s*$/,
  /^\s*상품\s*약관/,
  /^\s*약관상세\s*보기/,
  /^\s*약관\s*상세\s*보기/,
]

function linesOf(s: string): string[] {
  return s.split(NL)
}

function trimJoin(lines: string[]): string {
  return lines
    .map((l) => l.replace(/\s+$/g, '').trimEnd())
    .join('\n')
    .trim()
}

/** 시작 헤더 줄 인덱스(전체 일치·앞뒤 공백 허용) */
function findLineIndex(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (re.test(t)) return i
  }
  return -1
}

function sliceBlockFromLine(lines: string[], startIdx: number, endRes: RegExp[]): string[] {
  const out: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i]!
    const t = raw.replace(/\s+/g, ' ').trim()
    if (!t) {
      out.push(raw)
      continue
    }
    if (endRes.some((re) => re.test(t))) break
    out.push(raw)
  }
  return out
}

const PRICE_BLOCK_END_LINE_RES: RegExp[] = [
  /^\s*예약시\s*유의사항/,
  /^\s*가이드\/인솔자\s*및\s*미팅정보/,
  /^\s*포함\s*\/\s*불포함\s*\/\s*선택경비\s*정보/,
  /^\s*일정표\s*$/,
  /^\s*상세일정\s*$/,
  /^\s*간략일정\s*$/,
  /^\s*여행일정\s*$/,
  /^\s*\d{1,2}일차\b/,
  /^\s*항공여정\s*$/,
  /^\s*예정호텔\b/,
  /^\s*호텔정보\s*$/,
  /^\s*쇼핑정보\s*$/,
  /^\s*선택관광\b/,
  /^\s*현지옵션\s*$/,
]

function normLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function findSubHeaderLineIndex(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(normLine(lines[i]!))) return i
  }
  return -1
}

/**
 * `포함내역` / `불포함내역` / `선택경비` 줄 **정확히 일치**한 다음 줄부터 다음 헤더 직전까지만 슬라이스.
 * 헤더 없이 나온 상단 문구는 포함으로 승격하지 않는다.
 */
function sliceTripleSubblocksByHeaders(blockLines: string[]): {
  included: string[]
  excluded: string[]
  selection: string[]
  hadAnySubHeader: boolean
} {
  const lines = blockLines
  const iInc = findSubHeaderLineIndex(lines, /^포함\s*내역\s*[:：]?\s*$/i)
  const iExc = findSubHeaderLineIndex(lines, /^불포함\s*내역\s*[:：]?\s*$/i)
  const iSel = findSubHeaderLineIndex(lines, /^선택\s*경비\s*[:：]?\s*$/i)
  const hadAnySubHeader = iInc >= 0 || iExc >= 0 || iSel >= 0
  if (!hadAnySubHeader) {
    return { included: [], excluded: [], selection: [], hadAnySubHeader: false }
  }

  const sliceBetween = (startHeader: number, endHeader: number) => {
    if (startHeader < 0) return [] as string[]
    const from = startHeader + 1
    const to = endHeader >= 0 ? endHeader : lines.length
    return lines.slice(from, to)
  }

  const incEnd = iExc >= 0 ? iExc : iSel >= 0 ? iSel : lines.length
  const included = sliceBetween(iInc, incEnd)
  const excEnd = iSel >= 0 ? iSel : lines.length
  const excluded = sliceBetween(iExc, excEnd)
  let selection = sliceBetween(iSel, -1)
  selection = trimSelectionLinesAtPackageDetailStop(selection)

  return { included, excluded, selection, hadAnySubHeader: true }
}

/** 종료/제외 문장(선택관광·기항지… 참고) 및 그 이후는 선택경비 병합 대상에서 제외 */
function trimSelectionLinesAtPackageDetailStop(selectionLines: string[]): string[] {
  const STOP =
    /선택관광\s*[\/／,]\s*기항지관광|기항지관광\s*[\/／,]\s*현지투어|패키지\s*상품상세를\s*참고|상품\s*상세를\s*참고/i
  const out: string[] = []
  for (const raw of selectionLines) {
    const t = normLine(raw)
    if (STOP.test(t)) break
    out.push(raw)
  }
  return out
}

function lineLooksLikeHanatourOptionalOrPromo(line: string): boolean {
  const t = normLine(line)
  if (!t) return false
  if (/^\[스페셜포함\]|^\[하나팩|스페셜\s*포함\s*2[.,]?\s*0|하나팩\s*2[.,]?\s*0/i.test(t)) return true
  if (/이용요금|성인\s*\(|USD|EUR|현지\s*지불|현장\s*지불|사전\s*신청/i.test(t)) return true
  if (/^\[[\d.]+\]/.test(t) && /\d/.test(t)) return true
  return false
}

/** 포함내역 블록 안에서도 제외할 자동가격·옵션·홍보 줄 */
function filterHanatourIncludedBlockLine(raw: string): boolean {
  const t = normLine(raw)
  if (!t) return false
  if (lineLooksLikeHanatourOptionalOrPromo(t)) return false
  if (/유류\s*할증[^\n]{0,80}제세\s*공과금[^\n]{0,40}포함/i.test(t)) return false
  if (/포함\s*✅|포함✅/i.test(t)) return false
  return true
}

/** 선택경비 → 불포함 병합 시 제외할 줄(옵션·안내·종료문) */
function filterHanatourSelectionLineForExcluded(raw: string): boolean {
  const t = normLine(raw)
  if (!t) return false
  if (lineLooksLikeHanatourOptionalOrPromo(t)) return false
  if (/유류\s*할증[^\n]{0,80}제세\s*공과금[^\n]{0,40}포함/i.test(t)) return false
  if (/포함\s*✅|포함✅/i.test(t)) return false
  if (t.length > 500) return false
  return true
}

function linesForLocalJoinPriceBlob(selectionLines: string[]): string[] {
  const out: string[] = []
  for (const raw of selectionLines) {
    const t = normLine(raw)
    if (/현지\s*합류/i.test(t) && /(?:[\d,]+\s*원|JPY|USD|\$)/i.test(t)) out.push(raw)
  }
  return out
}

function trimLineEnd(raw: string): string {
  return raw.replace(/\s+$/g, '').trimEnd()
}

function dedupeNormalizedLines(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of lines) {
    const k = normLine(raw).toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(trimLineEnd(raw))
  }
  return out
}

function dedupeExcludedAgainstIncluded(excludedLines: string[], includedLines: string[]): string[] {
  const incKeys = new Set(includedLines.map((l) => normLine(l).toLowerCase()).filter(Boolean))
  const incBlob = includedLines.map((l) => normLine(l)).join('\n').toLowerCase()
  return excludedLines.filter((raw) => {
    const k = normLine(raw).toLowerCase()
    if (!k) return false
    if (incKeys.has(k)) return false
    if (k.length > 80 && incBlob.includes(k)) return false
    return true
  })
}

/**
 * `객실 1인 사용료` : 금액 있는 한 줄을 우선 남기고, 동의어 설명 줄은 제거.
 */
function dedupeHanatourSingleRoomLines(lines: string[]): string[] {
  const withAmount = lines.filter((l) =>
    /객실\s*1인\s*사용료\s*[:：]?\s*[\d,]+\s*원/i.test(normLine(l))
  )
  const canonical = withAmount[0] ?? null
  const dropAux = [
    /1인실\s*객실\s*추가\s*요금\s*별도/i,
    /1인\s*객실\s*사용\s*시\s*추가\s*요금/i,
    /객실\s*1인\s*사용료\s*반드시\s*확인/i,
    /싱글\s*차지|싱글차지/i,
  ]
  return lines.filter((raw) => {
    const t = normLine(raw)
    if (!t) return false
    if (canonical && dropAux.some((re) => re.test(t))) return false
    if (withAmount.length > 1 && /객실\s*1인\s*사용료/i.test(t)) {
      return withAmount.length === 1 || raw === canonical
    }
    return true
  })
}

function filterHanatourExcludedSectionLine(raw: string): boolean {
  const t = normLine(raw)
  if (!t) return false
  if (lineLooksLikeHanatourOptionalOrPromo(t)) return false
  if (/유류\s*할증[^\n]{0,80}제세\s*공과금[^\n]{0,40}포함/i.test(t)) return false
  return true
}

function finalizeHanatourTripleTextLines(
  includedRaw: string[],
  excludedRaw: string[],
  selectionRaw: string[]
): { includedLines: string[]; excludedLines: string[]; localJoinForPriceBlob: string[] } {
  const includedLines = dedupeNormalizedLines(includedRaw.filter(filterHanatourIncludedBlockLine))
  const excludedBase = dedupeNormalizedLines(excludedRaw.filter(filterHanatourExcludedSectionLine))
  const selectionMerged = selectionRaw.filter(filterHanatourSelectionLineForExcluded)
  const localJoinForPriceBlob = linesForLocalJoinPriceBlob(selectionRaw)
  let excludedLines = dedupeNormalizedLines([...excludedBase, ...selectionMerged])
  excludedLines = dedupeExcludedAgainstIncluded(excludedLines, includedLines)
  excludedLines = dedupeHanatourSingleRoomLines(excludedLines)
  return {
    includedLines: sanitizeIncludedExcludedItemsLines(includedLines),
    excludedLines: sanitizeIncludedExcludedItemsLines(excludedLines),
    localJoinForPriceBlob,
  }
}

/** 불포함·선택경비 원문에서 비자·입국·ETA 류만 must-know 파이프 병합용으로 추출 */
function extractHanatourVisaStyleSnippetsForMustKnow(
  excludedLines: string[],
  selectionLines: string[]
): string[] {
  const out: string[] = []
  for (const raw of [...excludedLines, ...selectionLines]) {
    const t = normLine(raw)
    if (!t || t.length > 520) continue
    if (
      /(?:가이드|기사|1인실|싱글차지|싱글\s*차지|리턴\s*변경|객실\s*1인)/i.test(t) &&
      !/(?:무비자|비자|입국|ETA|eTA|전자\s*여행|전자\s*입국|온라인\s*입국)/i.test(t)
    ) {
      continue
    }
    if (/(?:무비자|비자|입국|ETA|eTA|전자\s*여행|전자\s*입국|온라인\s*입국)/i.test(t)) {
      out.push(t.slice(0, 480))
    }
  }
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const x of out) {
    const k = normLine(x).toLowerCase().slice(0, 200)
    if (!k || seen.has(k)) continue
    seen.add(k)
    uniq.push(x)
  }
  return uniq.slice(0, 14)
}

/** 불포함 본문에서 가이드/기사 인당 금액 */
export function extractHanatourMandatoryLocalFromExcludedLines(excludedLines: string[]): {
  fee: number | null
  currency: string | null
  matchedLine: string | null
} {
  const blob = excludedLines.join('\n')
  const re =
    /가이드\s*\/\s*기사[^\n]{0,100}[:：]?\s*[^\n]*인당\s*([A-Z]{3})\s*([\d,]+)/i
  const m = blob.match(re)
  if (m?.[1] && m[2]) {
    const cur = m[1]!.toUpperCase()
    const n = Number(m[2]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return { fee: Math.round(n), currency: cur, matchedLine: m[0]!.trim() }
  }
  const reWon = /가이드\s*\/\s*기사[^\n]{0,100}[:：]?\s*[^\n]*인당\s*([\d,]+)\s*원/i
  const m2 = blob.match(reWon)
  if (m2?.[1]) {
    const n = Number(m2[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0)
      return { fee: Math.round(n), currency: 'KRW', matchedLine: m2[0]!.trim() }
  }
  const reUsd = /가이드\s*\/\s*기사[^\n]{0,100}[:：]?\s*[^\n]*인당\s*\$\s*([\d,]+)/i
  const m3 = blob.match(reUsd)
  if (m3?.[1]) {
    const n = Number(m3[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0)
      return { fee: n, currency: 'USD', matchedLine: m3[0]!.trim() }
  }
  return { fee: null, currency: null, matchedLine: null }
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

const NOTICE_END_RES: RegExp[] = [
  /^\s*가이드\/인솔자\s*및\s*미팅정보/,
  /^\s*상품\s*가격(?:\s|$)/,
  /^\s*포함\s*\/\s*불포함\s*\/\s*선택경비\s*정보/,
  /^\s*일정표\s*$/,
  /^\s*상세일정\s*$/,
  /^\s*간략일정\s*$/,
  /^\s*여행일정\s*$/,
  /^\s*항공여정\s*$/,
  /^\s*쇼핑정보\s*$/,
  /^\s*선택관광\b/,
  /^\s*현지옵션\s*$/,
]

const MEETING_END_RES: RegExp[] = [
  /^\s*예약시\s*유의사항/,
  /^\s*상품\s*가격(?:\s|$)/,
  /^\s*포함\s*\/\s*불포함\s*\/\s*선택경비\s*정보/,
  /^\s*일정표\s*$/,
  /^\s*상세일정\s*$/,
  /^\s*간략일정\s*$/,
  /^\s*여행일정\s*$/,
  /^\s*항공여정\s*$/,
  /^\s*쇼핑정보\s*$/,
]

function condenseMeetingLines(blockLines: string[]): string | null {
  const useful = blockLines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((t) => t && !/^(가이드|인솔자|미팅)\s*$/i.test(t))
  if (!useful.length) return null
  const joined = useful.join(' · ')
  return joined.length > 420 ? `${joined.slice(0, 417)}…` : joined
}

export type HanatourBasicInfoExtract = {
  includedText: string | null
  excludedAppend: string | null
  priceTableAppend: string | null
  localJoinPriceBlobAppend: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> | null
  meetingCondensed: string | null
  /** 포함/불포함/선택경비 헤더로 블록 분리 성공 시 true — apply 시 merge 대신 치환 */
  replacedIncludedExcludedFromTriple: boolean
}

/**
 * 정규화된 상세 본문에서 하나투어 헤더 구간만 추출.
 */
export function extractHanatourBasicInfoFromNormalizedBody(normalizedRaw: string): HanatourBasicInfoExtract | null {
  const raw = normalizedRaw?.trim()
  if (!raw) return null

  const lines = linesOf(raw)

  const tripleIdx = findLineIndex(lines, /^포함\s*\/\s*불포함\s*\/\s*선택경비\s*정보/)
  let includedText: string | null = null
  let excludedAppend: string | null = null
  let localJoinPriceBlobAppend: string | null = null
  let replacedIncludedExcludedFromTriple = false
  let excludedLinesForMandatory: string[] = []
  let visaSnippetsFromTriple: string[] = []

  if (tripleIdx >= 0) {
    const blockLines = sliceBlockFromLine(lines, tripleIdx, TRIPLE_BLOCK_END_LINE_RES)
    const { included, excluded, selection, hadAnySubHeader } = sliceTripleSubblocksByHeaders(blockLines)
    if (hadAnySubHeader) {
      visaSnippetsFromTriple = extractHanatourVisaStyleSnippetsForMustKnow(excluded, selection)
      replacedIncludedExcludedFromTriple = true
      const fin = finalizeHanatourTripleTextLines(included, excluded, selection)
      excludedLinesForMandatory = fin.excludedLines
      const incT = trimJoin(fin.includedLines)
      includedText = incT || null
      const exT = trimJoin(fin.excludedLines)
      excludedAppend = exT || null
      if (fin.localJoinForPriceBlob.length) {
        localJoinPriceBlobAppend = trimJoin(fin.localJoinForPriceBlob)
      }
    }
  }

  const { fee, currency } = extractHanatourMandatoryLocalFromExcludedLines(
    excludedLinesForMandatory.length ? excludedLinesForMandatory : excludedAppend ? linesOf(excludedAppend) : []
  )

  let priceTableAppend: string | null = null
  const priceIdx = findLineIndex(lines, /^상품\s*가격$|^상품가격$/)
  if (priceIdx >= 0) {
    const pl = sliceBlockFromLine(lines, priceIdx, PRICE_BLOCK_END_LINE_RES)
    const pt = trimJoin(pl)
    if (pt) priceTableAppend = trimJoin([lines[priceIdx]!, ...pl])
  }

  let mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> | null = null
  const noticeStartRes = [/^예약\s*시\s*유의\s*사항$/, /^예약시\s*유의사항$/]
  let noticeLines: string[] | null = null
  for (const re of noticeStartRes) {
    const sl = sliceSectionByStartHeader(lines, re, NOTICE_END_RES)
    if (sl?.length) {
      noticeLines = sl
      break
    }
  }
  if (noticeLines?.length || visaSnippetsFromTriple.length) {
    const noticeText = noticeLines?.length ? trimJoin(noticeLines) : ''
    const visaPart = visaSnippetsFromTriple.length ? visaSnippetsFromTriple.join('\n') : ''
    const mergedNotice = [noticeText, visaPart].filter(Boolean).join('\n\n').trim()
    if (mergedNotice) {
      const pipe = buildMustKnowPipeResultFromNoticeBlob(mergedNotice, {
        maxCards: 8,
        maxBodyChars: 180,
      })
      mustKnowItems = pipe.mustKnowItems
        ? finalizeHanatourMustKnowDisplayItems(pipe.mustKnowItems)
        : null
    }
  }

  let meetingCondensed: string | null = null
  const meetIdx = findLineIndex(lines, /^가이드\s*\/\s*인솔자\s*및\s*미팅정보/)
  if (meetIdx >= 0) {
    const sub = lines.slice(meetIdx)
    const ml = sliceSectionByStartHeader(sub, /^가이드\s*\/\s*인솔자\s*및\s*미팅정보/, MEETING_END_RES)
    if (ml?.length) meetingCondensed = condenseMeetingLines(ml)
  }

  if (
    !includedText &&
    !excludedAppend &&
    !priceTableAppend &&
    !localJoinPriceBlobAppend &&
    fee == null &&
    !mustKnowItems?.length &&
    !meetingCondensed &&
    !replacedIncludedExcludedFromTriple
  ) {
    return null
  }

  return {
    includedText,
    excludedAppend,
    priceTableAppend,
    localJoinPriceBlobAppend,
    mandatoryLocalFee: fee,
    mandatoryCurrency: currency,
    mustKnowItems,
    meetingCondensed,
    replacedIncludedExcludedFromTriple,
  }
}

/**
 * 하나투어 예약시 유의사항 → 공개 카드: 짧은 제목·최대 4개·운영상 제외 항목 삭제.
 * (등록 시점에만 적용 — 타 공급사 경로 없음)
 */
function finalizeHanatourMustKnowDisplayItems(
  items: NonNullable<RegisterParsed['mustKnowItems']>
): NonNullable<RegisterParsed['mustKnowItems']> {
  const dropBlobRes = [
    /음식물\s*반입|호주\s*내\s*음식|식물\s*류|검역\s*신고/i,
    /^입국\s*시\s*유의사항\s*$/i,
  ]
  const filtered = items.filter((it) => {
    const title = (it.title ?? '').replace(/\s+/g, ' ').trim()
    const body = (it.body ?? '').replace(/\s+/g, ' ').trim()
    const blob = `${title} ${body}`
    if (!blob.trim()) return false
    if (dropBlobRes.some((re) => re.test(blob))) return false
    if (/^입국\s*시\s*유의사항/i.test(title) && body.length < 28) return false
    if (
      /^입국\s*시\s*유의사항/i.test(title) &&
      !/(비자|ETA|eTA|여권|서류|미성년|자녀|국적|동반)/i.test(blob)
    ) {
      return false
    }
    return true
  })

  function shortTitle(blob: string, fallback: string): string {
    const b = blob.replace(/\s+/g, ' ').trim()
    if (/호주.*(?:ETA|eTA)|(?:ETA|eTA).*호주|호주\s*전자\s*여행|전자\s*여행\s*허가/i.test(b)) {
      return '호주 ETA 필요'
    }
    if (/여권.*6\s*개월|6\s*개월.*여권|여권\s*유효/i.test(b)) {
      return '여권 유효기간 6개월 이상'
    }
    if (/(미성년|자녀\s*동반|아동\s*동반).*(서류|출입국|동반|여권)/i.test(b)) {
      return '미성년 자녀 동반 서류 확인'
    }
    if (/외국\s*국적|이중\s*국적|별도\s*확인/i.test(b)) {
      return '외국 국적자 별도 확인'
    }
    const fb = fallback.trim()
    return fb.length <= 44 ? fb : `${fb.slice(0, 41)}…`
  }

  return filtered.slice(0, 4).map((it) => {
    const blob = `${it.title} ${it.body}`
    const headline = shortTitle(blob, it.title)
    const bodyRaw = (it.body ?? '').trim()
    const merged = normalizeMustKnowCardFields(headline, bodyRaw, {
      maxTitleLen: 44,
      maxBodyLen: 180,
    })
    return { ...it, title: merged.title, body: merged.body }
  })
}

function mergeTextBlocks(base: string | null | undefined, add: string | null): string | null {
  const b = (base ?? '').trim()
  const a = (add ?? '').trim()
  if (!a) return b || null
  if (!b) return a
  if (b.includes(a.slice(0, Math.min(40, a.length)))) return b
  return `${b}\n\n${a}`
}

/**
 * `parseForRegister` 직후·가격 finalize 직전에 병합. LLM/레거시 필드가 있으면 비어 있을 때만 덮어쓰지 않고 **보강**한다.
 */
export function applyHanatourBasicInfoBodyExtract(
  parsed: RegisterParsed,
  normalizedRaw: string
): RegisterParsed {
  const ex = extractHanatourBasicInfoFromNormalizedBody(normalizedRaw)
  if (!ex) return parsed

  let next = { ...parsed }

  if (ex.replacedIncludedExcludedFromTriple) {
    next.includedText = ex.includedText?.trim() || null
    next.excludedText = ex.excludedAppend?.trim() || null
  } else {
    if (ex.includedText?.trim()) {
      next.includedText = mergeTextBlocks(next.includedText, ex.includedText) ?? ex.includedText
    }
    if (ex.excludedAppend?.trim()) {
      next.excludedText = mergeTextBlocks(next.excludedText, ex.excludedAppend) ?? ex.excludedAppend
    }
  }

  if (ex.priceTableAppend?.trim()) {
    const pt = (next.priceTableRawText ?? '').trim()
    const add = ex.priceTableAppend.trim()
    if (!pt || !pt.includes('상품가격')) {
      next.priceTableRawText = mergeTextBlocks(next.priceTableRawText, add) ?? add
    } else if (!pt.replace(/\s+/g, ' ').includes(add.replace(/\s+/g, ' ').slice(0, 60))) {
      next.priceTableRawText = mergeTextBlocks(next.priceTableRawText, add) ?? add
    }
  }

  if (ex.localJoinPriceBlobAppend?.trim()) {
    const tail = ex.localJoinPriceBlobAppend.trim()
    const pt = (next.priceTableRawText ?? '').trim()
    if (!pt.replace(/\s+/g, ' ').includes(tail.replace(/\s+/g, ' ').slice(0, 24))) {
      next.priceTableRawText = mergeTextBlocks(next.priceTableRawText, tail) ?? tail
    }
  }

  if (ex.mandatoryLocalFee != null && ex.mandatoryCurrency) {
    if (next.mandatoryLocalFee == null || !Number.isFinite(next.mandatoryLocalFee)) {
      next.mandatoryLocalFee = ex.mandatoryLocalFee
      next.mandatoryCurrency = ex.mandatoryCurrency
    }
  }

  if (ex.mustKnowItems?.length) {
    next = {
      ...next,
      mustKnowItems: ex.mustKnowItems,
      mustKnowRaw: null,
      mustKnowSource: 'supplier',
    }
  }

  if (ex.meetingCondensed?.trim()) {
    const m = ex.meetingCondensed.trim()
    if (!(next.meetingNoticeRaw ?? '').trim() && !(next.meetingInfoRaw ?? '').trim()) {
      next.meetingNoticeRaw = m
    } else {
      next.meetingNoticeRaw = mergeTextBlocks(next.meetingNoticeRaw, m) ?? m
    }
  }

  return next
}

/**
 * 하나투어: `포함/불포함/선택경비 정보` + `포함내역`/`불포함내역`/`선택경비` 서브헤더만 사용.
 * 선택경비는 `finalizeHanatourTripleTextLines`에서 불포함 병합과 동일 규칙으로 반영.
 * 앵커 슬라이스에 트리플이 없으면 `fullBodyFallback`(전체 본문)에서 한 번 더 시도.
 */
export function parseHanatourIncludedExcludedStructured(
  section: string,
  fullBodyFallback?: string | null
): IncludedExcludedStructured {
  const empty = (review: boolean): IncludedExcludedStructured => ({
    includedItems: [],
    excludedItems: [],
    noteText: '',
    reviewNeeded: review,
    reviewReasons: review ? ['hanatour_triple_block_unparsed'] : [],
  })

  const tryBlob = (blob: string): IncludedExcludedStructured | null => {
    const raw = blob?.trim()
    if (!raw) return null
    const lines = linesOf(raw)
    const tripleIdx = findLineIndex(lines, /^포함\s*\/\s*불포함\s*\/\s*선택경비\s*정보/)
    if (tripleIdx < 0) return null
    const blockLines = sliceBlockFromLine(lines, tripleIdx, TRIPLE_BLOCK_END_LINE_RES)
    const { included, excluded, selection, hadAnySubHeader } = sliceTripleSubblocksByHeaders(blockLines)
    if (!hadAnySubHeader) return null
    const fin = finalizeHanatourTripleTextLines(included, excluded, selection)
    const z = fin.includedLines.length + fin.excludedLines.length === 0
    return {
      includedItems: fin.includedLines,
      excludedItems: fin.excludedLines,
      noteText: '',
      reviewNeeded: z,
      reviewReasons: z ? ['hanatour_triple_subheaders_empty'] : [],
    }
  }

  return (
    tryBlob(section) ??
    (fullBodyFallback && fullBodyFallback.trim() !== section.trim()
      ? tryBlob(fullBodyFallback)
      : null) ??
    empty(section.replace(/\s+/g, ' ').trim().length > 120)
  )
}
