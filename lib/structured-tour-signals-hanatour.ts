/**
 * 하나투어 전용 — structured tour signals (선택관광·쇼핑 등 본문 신호 추출).
 *
 * Gate 연결
 * - 선택관광 행 필터/금칙은 `@/lib/optional-tour-row-gate-hanatour`만 import한다. 공용 `optional-tour-row-gate.ts`는 없다.
 * - gate 분리와 무관한 대규모 리팩터는 여기서 하지 않는다. `guide同行Text` 키는 TS 식별자 제약으로 `guide\u540c\u884cText` 리터럴 타입을 쓴다.
 */
import { MAX_OPTIONAL_TOURS } from '@/lib/optional-tour-limits'
import { filterOptionalTourRows, isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'
import { extractHanatourShoppingVisitCountFromFullBodyText } from '@/lib/register-hanatour-shopping'
import { isShoppingPublicJunkRow } from '@/lib/shopping-public-row-filter'

type GuideFieldKey = 'guide\u540c\u884cText'

export type StructuredOptionalTourRow = {
  name: string
  currency: string | null
  adultPrice: number | null
  childPrice: number | null
  durationText: string | null
  minPaxText: string | null
  waitingPlaceText: string | null
  /** 표 `대체일정` 열 또는 소요시간 셀 내 `대체일정` 서술 분리 */
  alternateScheduleText?: string | null
  raw: string
} & Record<GuideFieldKey, string | null>

export type StructuredShoppingStopRow = {
  itemType: string
  placeName: string
  durationText: string | null
  refundPolicyText: string | null
  raw: string
}

export type StructuredTourSignals = {
  optionalTourNoticeRaw: string | null
  optionalTourNoticeItems: string[]
  optionalTours: StructuredOptionalTourRow[]
  optionalToursStructuredJson: string | null
  hasOptionalTour: boolean
  optionalTourCount: number
  optionalTourSourceCount: number
  optionalTourSummaryText: string
  shoppingNoticeRaw: string | null
  shoppingStops: StructuredShoppingStopRow[]
  shoppingStopsJson: string | null
  hasShopping: boolean
  shoppingVisitCount: number | null
  shoppingSourceCount: number
  shoppingSummaryText: string
  hasFreeTime: boolean
  freeTimeSummaryText: string
  freeTimeRawMentions: string[]
  headerBadges: {
    optionalTour: string
    shopping: string
    freeTime: string
  }
}

const MAX_SHOPPING_STOPS = 15

function toLines(rawText: string): string[] {
  return rawText.replace(/\r/g, '').split('\n').map((x) => x.trim()).filter(Boolean)
}

function parseIntLoose(v: string | null | undefined): number | null {
  if (!v) return null
  const m = String(v).match(/-?\d[\d,]*/)
  if (!m) return null
  const n = Number(m[0].replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function extractBestPriceFromOptionalCell(cell: string | null | undefined): number | null {
  if (!cell?.trim()) return null
  const t = cell.trim()
  const loose = parseIntLoose(t)
  const nums: number[] = []
  for (const m of t.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})\b/g)) {
    const n = Number(m[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 10) nums.push(n)
  }
  const best = nums.length ? Math.max(...nums) : null
  if (best != null && loose != null && loose < 100 && best > loose) return best
  if (best != null && loose == null) return best
  return loose
}

export function splitPasteTableLineCells(line: string): string[] {
  const ln = line.replace(/\r/g, '').trim()
  if (ln.includes('\t')) return ln.split('\t').map((x) => x.trim())
  const slashParts = ln.split(/\s*[/?|?]+\s*/).map((x) => x.trim()).filter(Boolean)
  const spacedSlashes = (ln.match(/\s[/?|?]\s/g) ?? []).length
  if (
    slashParts.length >= 3 &&
    (spacedSlashes >= 2 ||
      /(\uAD00\uAD11\uBA85|\uC120\uD0DD\uAD00\uAD11\uBA85|\uC120\uD0DD\uAD00\uAD11|\uC131\uC778|^\uAD6C\uBD84$|\uBBF8\uCC38\uC5EC|\uD1B5\uD654|\uC544\uB3D9|\uC18C\uC694\uC2DC\uAC04|\uCD5C\uC18C)/i.test(
        ln
      ))
  ) {
    return slashParts
  }
  return ln.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean)
}

function splitTableCells(line: string): string[] {
  return splitPasteTableLineCells(line)
}

/** 소요시간 칸: 시간·분 표기만 남김(동일 셀에 붙은 대체일정 문구는 제외) */
function stripOptionalTourDurationCellToTimeOnly(durationRaw: string | null): string | null {
  if (!durationRaw?.trim()) return null
  const t = durationRaw.replace(/\s+/g, ' ').trim()
  const head = t.split(/\b대체\s*일정\b/i)[0]?.trim() ?? t
  const m =
    head.match(/(?:약\s*)?\d+\s*~\s*\d+\s*(?:시간|분)/i) ||
    head.match(/(?:약\s*)?\d+\s*(?:시간|분)(?:\s*\+\s*(?:약\s*)?\d+\s*(?:시간|분))?/i) ||
    head.match(/(?:약\s*)?\d+(?:\.\d+)?\s*(?:hours?|h|mins?|m)\b/i)
  if (m) return m[0].trim().slice(0, 80)
  if (/^\d+\s*시간|\d+\s*분/i.test(head)) return head.slice(0, 80)
  return head.length <= 48 ? head.slice(0, 80) : null
}

function extractAlternateScheduleAfterKeyword(cell: string | null): string | null {
  if (!cell?.trim()) return null
  const t = cell.replace(/\s+/g, ' ').trim()
  const m = /\b대체\s*일정\b\s*[:：]?\s*(.+)/i.exec(t)
  if (m?.[1]) return m[1].trim().slice(0, 500) || null
  return null
}

function normOptionalHeaderCell(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function findOptionalTourPriceParentColumnIndex(hCols: string[]): number | null {
  for (let i = 0; i < hCols.length; i++) {
    const c = normOptionalHeaderCell(hCols[i] ?? '')
    if (!c) continue
    if (
      /\uBE44\uC6A9\s*\/|\/\s*\uBE44\uC6A9/i.test(c) ||
      /^\uBE44\uC6A9$/i.test(c) ||
      /^\uC120\uD0DD\uACBD\uBE44$/i.test(c)
    )
      return i
  }
  return null
}

function headerHintToDataColIdx(headerColIdx: number | null, priceParentIdx: number | null): number | null {
  if (headerColIdx == null || priceParentIdx == null) return headerColIdx
  if (headerColIdx <= priceParentIdx) return headerColIdx
  return headerColIdx + 1
}

function tryParseOptionalTourSubheaderRow(
  line: string,
  headerCols: string[]
): { adultIdx: number; childIdx: number } | null {
  const cols = splitTableCells(line)
  const priceParentIdx = findOptionalTourPriceParentColumnIndex(headerCols)
  const h0 = normOptionalHeaderCell(headerCols[0] ?? '')

  if (cols.length === 2) {
    const a = normOptionalHeaderCell(cols[0] ?? '')
    const b = normOptionalHeaderCell(cols[1] ?? '')
    if (/^\uC131\uC778$/i.test(a) && /^\uC544\uB3D9$/i.test(b) && priceParentIdx != null) {
      return { adultIdx: 2, childIdx: 3 }
    }
    return null
  }

  if (cols.length < 3) return null
  let adultIdx = -1
  let childIdx = -1
  for (let i = 0; i < cols.length; i++) {
    const c = normOptionalHeaderCell(cols[i] ?? '')
    if (/^\uC131\uC778$/i.test(c)) adultIdx = i
    if (/^\uC544\uB3D9$/i.test(c)) childIdx = i
  }
  if (adultIdx < 0 || childIdx < 0) return null
  const first = normOptionalHeaderCell(cols[0] ?? '')
  if (
    first.length > 12 &&
    !/^(\uC120\uD0DD\uAD00\uAD11\uBA85|\uD1B5\uD654|\uBE44\uC6A9|\uC131\uC778|\uBBF8\uCC38\uC5EC)/i.test(first)
  )
    return null
  if (cols.some((c) => /^\$?\s*[0-9][0-9,]{3,}\s*$/i.test(normOptionalHeaderCell(c)))) return null

  if (adultIdx === 0 && childIdx === 1 && /\uBE44\uC6A9|\uC120\uD0DD\uACBD\uBE44/i.test(h0) && priceParentIdx != null) {
    return { adultIdx: 2, childIdx: 3 }
  }

  return { adultIdx, childIdx }
}

function parseOptionalTourNotice(lines: string[]): { raw: string | null; items: string[]; endIdx: number } {
  const start = lines.findIndex((l) => /\uC120\uD0DD\s*\uAD00\uAD11/i.test(l))
  if (start < 0) return { raw: null, items: [], endIdx: -1 }
  const items: string[] = []
  const buf: string[] = [lines[start]!]
  let end = start
  for (let i = start + 1; i < lines.length; i++) {
    const ln = lines[i]!
    if (
      /\uC1FC\uD551\s*\uC815\uBCF4|\uC790\uC720\s*\uC77C\uC815|\uD3EC\uD568\s*\uBD88\uD3EC\uD568|\uC8FC\uC758\s*\uC0AC\uD56D|\uD2B9\uBCC4\s*\uC548\uB0B4/i.test(
        ln
      )
    )
      break
    if (/^\d+\s*[).]/.test(ln)) items.push(ln.replace(/^\d+\s*[).]\s*/, '').trim())
    buf.push(ln)
    end = i
  }
  return { raw: buf.join('\n').trim() || null, items, endIdx: end }
}

function findOptionalTourMergedHeader(lines: string[]): {
  mergedLine: string
  headerStart: number
  headerLinesConsumed: number
} | null {
  const singleIdx = lines.findIndex(
    (l) =>
      /\uC120\uD0DD\uAD00\uAD11/i.test(l) &&
      /(\uD1B5\uD654|\uC18C\uC694\uC2DC\uAC04|\uCD5C\uC18C\s*\uC778\uC6D0|\uC131\uC778\s*\/\s*\uC544\uB3D9|\uBBF8\uCC38\uC5EC|\uBBF8\uCC38\uAC00|\uB300\uAE30|\uB3D9\uD589)/i.test(
        l
      )
  )
  if (singleIdx >= 0) {
    return { mergedLine: lines[singleIdx]!, headerStart: singleIdx, headerLinesConsumed: 1 }
  }
  for (let i = 0; i + 1 < lines.length; i++) {
    const merged = `${lines[i]!.trim()} / ${lines[i + 1]!.trim()}`
    if (
      /\uC120\uD0DD\uAD00\uAD11/i.test(merged) &&
      /(\uD1B5\uD654|\uC18C\uC694\uC2DC\uAC04|\uCD5C\uC18C\s*\uC778\uC6D0|\uC131\uC778\s*\/\s*\uC544\uB3D9|\uBBF8\uCC38\uC5EC|\uBBF8\uCC38\uAC00|\uB300\uAE30|\uB3D9\uD589)/i.test(
        merged
      )
    ) {
      return { mergedLine: merged, headerStart: i, headerLinesConsumed: 2 }
    }
  }
  return null
}

function findShoppingMergedHeader(lines: string[]): {
  mergedLine: string
  headerStart: number
  headerLinesConsumed: number
} | null {
  const hasShopItem = (s: string) =>
    /\uC1FC\uD551\s*\uD488\uBAA9|\uC1FC\uD551\s*\uD56D\uBAA9|\uC1FC\uD551\uD488\uBAA9|\uC1FC\uD551\uBA85/i.test(s)
  const hasShopPlaceOrMore = (s: string) =>
    /\uC1FC\uD551\s*\uC7A5\uC18C|\uC1FC\uD551\uC7A5\uC18C|\uC608\uC0C1\uC18C\uC694\uC2DC\uAC04|\uC18C\uC694\uC2DC\uAC04|\uD658\uBD88|\uAD6C\uBD84|\uCCB4\uB958/i.test(
      s
    )
  const singleIdx = lines.findIndex((l) => hasShopItem(l) && hasShopPlaceOrMore(l))
  if (singleIdx >= 0) {
    return { mergedLine: lines[singleIdx]!, headerStart: singleIdx, headerLinesConsumed: 1 }
  }
  for (let i = 0; i + 1 < lines.length; i++) {
    const merged = `${lines[i]!.trim()} / ${lines[i + 1]!.trim()}`
    if (hasShopItem(merged) && hasShopPlaceOrMore(merged)) {
      return { mergedLine: merged, headerStart: i, headerLinesConsumed: 2 }
    }
  }
  return null
}

function parseOptionalTourRows(lines: string[], startHint: number): StructuredOptionalTourRow[] {
  const mergedHdr = findOptionalTourMergedHeader(lines)
  const headerIdx = mergedHdr?.headerStart ?? -1
  const headerMergedLine = mergedHdr?.mergedLine ?? null
  const headerLinesConsumed = mergedHdr?.headerLinesConsumed ?? 0

  let adultColIdx: number | null = null
  let childColIdx: number | null = null
  let priceParentIdx: number | null = null
  let headerColHints: {
    durationIdx: number | null
    minPaxIdx: number | null
    guideIdx: number | null
    waitingIdx: number | null
    currencyIdx: number | null
    alternateScheduleIdx: number | null
  } = {
    durationIdx: null,
    minPaxIdx: null,
    guideIdx: null,
    waitingIdx: null,
    currencyIdx: null,
    alternateScheduleIdx: null,
  }

  if (headerMergedLine) {
    const hCols = splitTableCells(headerMergedLine)
    priceParentIdx = findOptionalTourPriceParentColumnIndex(hCols)
    for (let i = 0; i < hCols.length; i++) {
      const c = (hCols[i] ?? '').trim()
      if (/^\uD1B5\uD654$/i.test(c) || /^(USD|KRW|EUR|JPY)$/i.test(c)) headerColHints.currencyIdx = i
      if (/\uC18C\uC694\s*\uC2DC\uAC04|\uC608\uC0C1\uC2DC\uAC04/i.test(c)) headerColHints.durationIdx = i
      if (headerColHints.durationIdx == null && /^\uC2DC\uAC04$/i.test(c)) headerColHints.durationIdx = i
      if (/\uCD5C\uC18C\s*\uC778\uC6D0|\uCD5C\uC18C\uCD9C\uBC1C|\uCD5C\uC18C\uC778\uC6D0|\uCD5C\uC18C\uD589\uC0AC\uC778\uC6D0/i.test(c))
        headerColHints.minPaxIdx = i
      if (/\uB300\uCCB4\s*\uC77C\uC815|\uB300\uCCB4\uC77C\uC815/i.test(c)) headerColHints.alternateScheduleIdx = i
      if (/\uB3D9\uD589|\uC778\uC194|\uAC00\uC774\uB4DC/i.test(c)) headerColHints.guideIdx = i
      if (
        /\uBBF8\uCC38\uC5EC|\uBBF8\uCC38\uAC00|\uB300\uAE30\s*\uC77C\uC815|\uB300\uAE30\s*\uC7A5\uC18C|\uC77C\uC815\s*\uBC0F\s*\uC7A5\uC18C/i.test(
          c
        )
      )
        headerColHints.waitingIdx = i
    }
    const lineAfterHeader =
      headerIdx >= 0 && headerIdx + headerLinesConsumed < lines.length
        ? lines[headerIdx + headerLinesConsumed]!
        : null
    const sub = lineAfterHeader
      ? tryParseOptionalTourSubheaderRow(lineAfterHeader, splitTableCells(headerMergedLine))
      : null
    if (sub) {
      adultColIdx = sub.adultIdx
      childColIdx = sub.childIdx
    }
  }

  const multiPriceHeader = adultColIdx != null && childColIdx != null && priceParentIdx != null
  const durationDataIdx = multiPriceHeader
    ? headerHintToDataColIdx(headerColHints.durationIdx, priceParentIdx)
    : headerColHints.durationIdx
  const minPaxDataIdx = multiPriceHeader
    ? headerHintToDataColIdx(headerColHints.minPaxIdx, priceParentIdx)
    : headerColHints.minPaxIdx
  const guideDataIdx = multiPriceHeader
    ? headerHintToDataColIdx(headerColHints.guideIdx, priceParentIdx)
    : headerColHints.guideIdx
  const waitingDataIdx = multiPriceHeader
    ? headerHintToDataColIdx(headerColHints.waitingIdx, priceParentIdx)
    : headerColHints.waitingIdx
  const alternateScheduleDataIdx = multiPriceHeader
    ? headerHintToDataColIdx(headerColHints.alternateScheduleIdx, priceParentIdx)
    : headerColHints.alternateScheduleIdx

  const start =
    headerIdx >= 0
      ? headerIdx + headerLinesConsumed + (adultColIdx != null && childColIdx != null ? 1 : 0)
      : Math.max(0, startHint + 1)
  const out: StructuredOptionalTourRow[] = []
  const gk: GuideFieldKey = 'guide\u540c\u884cText'
  for (let i = start; i < lines.length; i++) {
    const ln = lines[i]!
    if (
      /\uC1FC\uD551\s*\uC815\uBCF4|\uC790\uC720\s*\uC77C\uC815|\uD3EC\uD568\s*\uBD88\uD3EC\uD568|\uC8FC\uC758\s*\uC0AC\uD56D/i.test(
        ln
      )
    )
      break
    if (/^\d+\s*[).]/.test(ln) || /\uC120\uD0DD\s*\uAD00\uAD11\s*\uC720\uC758/i.test(ln)) continue
    if (/^(\uC120\uD0DD\uACBD\uBE44|\uC131\uC778|\uC544\uB3D9|\uD1B5\uD654|\uBBF8\uCC38\uC5EC\s*\uC2DC)\s*$/i.test(ln.trim()))
      continue
    const cols = splitTableCells(ln)
    if (cols.length === 1 && ln.length > 72 && !/\$|USD|KRW|\uC6D0|EUR|JPY|\d{2,}/i.test(ln)) continue
    if (cols.length < 2 && !/(USD|\uC6D0|\uB2EC\uB7EC|\uC544\uB3D9|\uC131\uC778|\uBE44\uC6A9)/i.test(ln)) continue
    const nameOffset = cols.length >= 2 && /^\d+$/.test((cols[0] ?? '').trim()) ? 1 : 0
    const name = (cols[nameOffset] || '').trim()
    if (!name || /^(\uC131\uC778|\uC544\uB3D9|\uD1B5\uD654|\uC18C\uC694\uC2DC\uAC04|\uC2DC\uAC04)$/i.test(name)) continue
    if (isBannedOptionalTourName(name)) continue
    const currency =
      (headerColHints.currencyIdx != null ? cols[headerColHints.currencyIdx] : undefined)?.trim() ||
      cols.find((c) => /^(USD|\$|KRW|\uC6D0|EUR|JPY)$/i.test(c)) ||
      (/\$|USD/i.test(ln) ? '$' : null)

    let adultPrice: number | null = null
    let childPrice: number | null = null
    if (adultColIdx != null && childColIdx != null && cols.length > Math.max(adultColIdx, childColIdx)) {
      adultPrice = extractBestPriceFromOptionalCell(cols[adultColIdx] ?? '')
      childPrice = extractBestPriceFromOptionalCell(cols[childColIdx] ?? '')
    } else {
      let fromCostCol: number | null = null
      if (priceParentIdx != null && cols.length > priceParentIdx) {
        fromCostCol = extractBestPriceFromOptionalCell(cols[priceParentIdx] ?? '')
      }
      adultPrice =
        fromCostCol ??
        extractBestPriceFromOptionalCell(cols.find((c) => /\uC131\uC778/i.test(c)) ?? '') ??
        extractBestPriceFromOptionalCell(cols[cols.length - 2] ?? '') ??
        extractBestPriceFromOptionalCell(ln)
      childPrice =
        extractBestPriceFromOptionalCell(cols.find((c) => /\uC544\uB3D9/i.test(c)) ?? '') ??
        extractBestPriceFromOptionalCell(cols[cols.length - 1] ?? '')
    }

    let durationRaw =
      (durationDataIdx != null && cols[durationDataIdx]?.trim() ? cols[durationDataIdx] : null) ??
      cols.find((c) => /\uC18C\uC694|hour|min/i.test(c)) ??
      null
    const altFromCol =
      alternateScheduleDataIdx != null && cols[alternateScheduleDataIdx]?.trim()
        ? (cols[alternateScheduleDataIdx] ?? '').trim()
        : null
    const altFromMergedDuration = extractAlternateScheduleAfterKeyword(durationRaw)
    const durationText = stripOptionalTourDurationCellToTimeOnly(durationRaw)
    const alternateScheduleText = altFromCol || altFromMergedDuration || null
    const minPaxText =
      (minPaxDataIdx != null && cols[minPaxDataIdx]?.trim() ? cols[minPaxDataIdx] : null) ??
      (!headerMergedLine
        ? cols.find((c) => /^\s*\d+\s*명\s*$/.test(c.trim()) || /최소\s*\d+\s*명/i.test(c))
        : null) ??
      null
    const guideText =
      (guideDataIdx != null && cols[guideDataIdx]?.trim() ? cols[guideDataIdx] : null) ??
      cols.find((c) => /\uB3D9\uD589|\uC778\uC194|\uAC00\uC774\uB4DC/.test(c)) ??
      null
    const waiting =
      (waitingDataIdx != null && cols[waitingDataIdx]?.trim() ? cols[waitingDataIdx] : null) ??
      cols.find((c) => /\uB300\uAE30|\uBBF8\uCC38\uC5EC|\uBBF8\uCC38\uAC00|\uC77C\uC815/i.test(c)) ??
      null
    const row: StructuredOptionalTourRow = {
      name,
      currency,
      adultPrice,
      childPrice,
      durationText,
      minPaxText,
      waitingPlaceText: waiting,
      alternateScheduleText,
      raw: ln,
      [gk]: guideText,
    }
    out.push(row)
  }
  return filterOptionalTourRows(out.filter((r) => !/^(\uC120\uD0DD\uAD00\uAD11\uBA85)$/.test(r.name)))
}

function parseShopping(lines: string[]): {
  shoppingNoticeRaw: string | null
  shoppingStops: StructuredShoppingStopRow[]
  shoppingVisitCount: number | null
} {
  const shoppingVisitCount = extractHanatourShoppingVisitCountFromFullBodyText(lines.join('\n'))
  const noticeIdx = lines.findIndex((l) =>
    /\uC1FC\uD551\s*\uC815\uBCF4\s*\uC548\uB0B4|\uC1FC\uD551\s*\uC548\uB0B4|\uC1FC\uD551\s*\uC815\uBCF4/i.test(l)
  )
  const noticeRaw = noticeIdx >= 0 ? lines.slice(Math.max(0, noticeIdx - 1), noticeIdx + 1).join('\n') : null
  const shopMerged = findShoppingMergedHeader(lines)
  const headerIdx = shopMerged?.headerStart ?? -1
  const headerLinesConsumed = shopMerged?.headerLinesConsumed ?? 0
  const mergedShoppingHeaderLine = shopMerged?.mergedLine ?? null
  const start =
    headerIdx >= 0 ? headerIdx + headerLinesConsumed : noticeIdx >= 0 ? noticeIdx + 1 : -1
  const rows: StructuredShoppingStopRow[] = []
  if (start < 0) return { shoppingNoticeRaw: noticeRaw, shoppingStops: rows, shoppingVisitCount }

  let colMap: { typeIdx: number | null; itemIdx: number; placeIdx: number; durIdx: number; refIdx: number } | null =
    null
  if (headerIdx >= 0 && mergedShoppingHeaderLine) {
    const h = splitTableCells(mergedShoppingHeaderLine)
    const idx = (pred: (cell: string) => boolean) => h.findIndex((c) => pred(c.trim()))
    const iType = idx((c) => /^\uAD6C\uBD84$/i.test(c))
    const iItem = idx((c) =>
      /\uC1FC\uD551\s*\uD488\uBAA9|\uC1FC\uD551\s*\uD56D\uBAA9|\uC1FC\uD551\uD488\uBAA9|\uC1FC\uD551\uBA85/i.test(c)
    )
    const iPlace = idx(
      (c) => /\uC1FC\uD551\s*\uC7A5\uC18C|\uC1FC\uD551\uC7A5\uC18C/i.test(c) || /^[\uC7A5\uC18C]$/i.test(c.trim())
    )
    const iDur = idx((c) => /\uC18C\uC694|\uC608\uC0C1\uC18C\uC694\uC2DC\uAC04|\uCCB4\uB958/i.test(c) && !/\uD658\uBD88/i.test(c))
    const iRef = idx((c) => /\uD658\uBD88/i.test(c))
    if (iItem >= 0 && iPlace >= 0) {
      colMap = {
        typeIdx: iType >= 0 ? iType : null,
        itemIdx: iItem,
        placeIdx: iPlace,
        durIdx: iDur >= 0 ? iDur : iPlace + 1,
        refIdx: iRef >= 0 ? iRef : Math.max(iDur >= 0 ? iDur : iPlace, iPlace) + 1,
      }
    }
  }

  for (let i = start; i < lines.length; i++) {
    const ln = lines[i]!
    if (
      /\uC120\uD0DD\uAD00\uAD11|\uC790\uC720\s*\uC77C\uC815|\uD3EC\uD568\s*\uBD88\uD3EC\uD568|\uD2B9\uBCC4\s*\uC720\uC758\uC0AC\uD56D/i.test(
        ln
      )
    )
      break
    const cols = splitTableCells(ln)
    if (cols.length < 2) continue
    if (
      /(\uC1FC\uD551\s*\uD488\uBAA9|\uC1FC\uD551\uD488\uBAA9|\uC1FC\uD551\s*\uD56D\uBAA9|\uC1FC\uD551\uC7A5\uC18C|\uC1FC\uD551\s*\uC7A5\uC18C|\uC608\uC0C1\uC18C\uC694\uC2DC\uAC04|\uC18C\uC694\uC2DC\uAC04|\uD658\uBD88\uC5EC\uBD80|\uC1FC\uD551\s*\uD68C\uC218|^\uAD6C\uBD84$|\uCCB4\uB958)/i.test(
        cols[0] ?? ''
      )
    )
      continue
    if (colMap && cols.length > Math.max(colMap.placeIdx, colMap.itemIdx)) {
      const typeV =
        colMap.typeIdx != null && colMap.typeIdx < cols.length ? (cols[colMap.typeIdx] ?? '').trim() : ''
      const itemV = (cols[colMap.itemIdx] ?? '').trim()
      const placeV = (cols[colMap.placeIdx] ?? '').trim()
      const durV =
        colMap.durIdx < cols.length ? ((cols[colMap.durIdx] ?? '').trim() || null) : null
      const refV =
        colMap.refIdx < cols.length ? ((cols[colMap.refIdx] ?? '').trim() || null) : null
      rows.push({
        itemType: typeV && itemV ? `${typeV} ? ${itemV}` : itemV || typeV,
        placeName: placeV,
        durationText: durV,
        refundPolicyText: refV,
        raw: ln,
      })
      continue
    }
    rows.push({
      itemType: cols[0] ?? '',
      placeName: cols[1] ?? '',
      durationText: cols[2] ?? null,
      refundPolicyText: cols[3] ?? null,
      raw: ln,
    })
  }
  const filteredRows = rows.filter(
    (r) =>
      !isShoppingPublicJunkRow({
        itemType: r.itemType,
        placeName: r.placeName,
        durationText: r.durationText,
        refundPolicyText: r.refundPolicyText,
        raw: r.raw,
      })
  )
  const narrativeRows = hanatourNarrativeShoppingStopCandidatesFromLines(lines)
  const seenPlace = new Set(
    filteredRows.map((r) => r.placeName.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean)
  )
  const mergedStops: StructuredShoppingStopRow[] = [...filteredRows]
  for (const nr of narrativeRows) {
    const k = nr.placeName.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!k || seenPlace.has(k)) continue
    seenPlace.add(k)
    mergedStops.push(nr)
  }
  return { shoppingNoticeRaw: noticeRaw, shoppingStops: mergedStops, shoppingVisitCount }
}

/** 일정 `○○ N회 방문`, `○○ 쇼핑몰` 등 — 표 밖 서술 후보지(횟수는 shoppingVisitCount에서 별도). */
function hanatourNarrativeShoppingStopCandidatesFromLines(lines: string[]): StructuredShoppingStopRow[] {
  const out: StructuredShoppingStopRow[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    const mv = t.match(/^(.+?)\s*(\d+)\s*회\s*방문\s*$/)
    if (mv) {
      const place = mv[1]!.trim().replace(/^[·•\-\s]+/, '')
      if (place.length < 2 || place.length > 42) continue
      if (!/(면세|쇼핑|아울렛|몰|백화점|마트|센터)/i.test(place)) continue
      const k = place.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({
        itemType: '',
        placeName: place,
        durationText: null,
        refundPolicyText: null,
        raw: line,
      })
    }
    const mall = t.match(/([가-힣A-Za-z0-9・·\s]{2,36}?)\s*쇼핑몰/)
    if (mall) {
      const name = mall[1]!.replace(/\s+/g, ' ').trim()
      if (name.length < 2) continue
      const k = name.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({
        itemType: '',
        placeName: name,
        durationText: null,
        refundPolicyText: null,
        raw: line,
      })
    }
  }
  return out
}

export function parseShoppingStopsFromLines(lines: string[]): StructuredShoppingStopRow[] {
  return parseShopping(lines).shoppingStops.slice(0, MAX_SHOPPING_STOPS)
}

function parseFreeTime(lines: string[]): {
  hasFreeTime: boolean
  freeTimeSummaryText: string
  freeTimeRawMentions: string[]
} {
  const mentions = lines
    .filter((l) =>
      /(\uC790\uC720\s*\uC77C\uC815|\uC790\uC720\uC2DC\uAC04|\uC790\uC720\s*\uAD00\uAD11|\uBCFC\uAC70\uB9AC\s*\uCD94\uCC9C|free\s*time)/i.test(
        l
      )
    )
    .slice(0, 20)
  if (mentions.length === 0) {
    return {
      hasFreeTime: false,
      freeTimeSummaryText: '\uC790\uC720\uC77C\uC815 \uC5C6\uC74C',
      freeTimeRawMentions: [],
    }
  }
  const combined = mentions.join(' ')
  if (/\uD558\uB8E8|1\s*\uC77C\s*\uC804\uC77C/.test(combined)) {
    return {
      hasFreeTime: true,
      freeTimeSummaryText: '\uC790\uC720\uC77C\uC815 \uD558\uB8E8',
      freeTimeRawMentions: mentions,
    }
  }
  if (/\uBC18\uC77C|\uC624\uC804|\uC624\uD6C4/.test(combined)) {
    return {
      hasFreeTime: true,
      freeTimeSummaryText: '\uC790\uC720\uC77C\uC815 \uBC18\uC77C',
      freeTimeRawMentions: mentions,
    }
  }
  return {
    hasFreeTime: true,
    freeTimeSummaryText: '\uC790\uC720\uC77C\uC815 \uC788\uC74C',
    freeTimeRawMentions: mentions,
  }
}

export function parseOptionalTourTableRowsFromRawText(raw: string): StructuredOptionalTourRow[] {
  const lines = toLines(raw)
  const notice = parseOptionalTourNotice(lines)
  return parseOptionalTourRows(lines, notice.endIdx)
}

export function extractStructuredTourSignals(rawText: string): StructuredTourSignals {
  const lines = toLines(rawText)
  const notice = parseOptionalTourNotice(lines)
  const optionalToursAll = parseOptionalTourRows(lines, notice.endIdx)
  const optionalTours = optionalToursAll.slice(0, MAX_OPTIONAL_TOURS)
  const shopping = parseShopping(lines)
  const freeTime = parseFreeTime(lines)
  const hasOptionalTour = optionalTours.length > 0
  const hasShopping = (shopping.shoppingVisitCount ?? 0) > 0 || shopping.shoppingStops.length > 0
  const optionalTourSummaryText = hasOptionalTour
    ? optionalTours.length === 1
      ? '\uC120\uD0DD\uAD00\uAD11 1\uAC74'
      : `\uC120\uD0DD\uAD00\uAD11 ${optionalTours.length}\uAC74`
    : '\uC120\uD0DD\uAD00\uAD11 \uC5C6\uC74C'
  const shoppingSummaryText = hasShopping
    ? shopping.shoppingVisitCount != null
      ? `\uC1FC\uD551 ${shopping.shoppingVisitCount}\uD68C`
      : '\uC1FC\uD551 \uC788\uC74C'
    : '\uC1FC\uD551 \uC5C6\uC74C'
  return {
    optionalTourNoticeRaw: notice.raw,
    optionalTourNoticeItems: notice.items,
    optionalTours,
    optionalToursStructuredJson: optionalTours.length > 0 ? JSON.stringify(optionalTours) : null,
    hasOptionalTour,
    optionalTourCount: optionalTours.length,
    optionalTourSourceCount: optionalToursAll.length,
    optionalTourSummaryText,
    shoppingNoticeRaw: shopping.shoppingNoticeRaw,
    shoppingStops: shopping.shoppingStops.slice(0, MAX_SHOPPING_STOPS),
    shoppingStopsJson:
      shopping.shoppingStops.length > 0
        ? JSON.stringify(shopping.shoppingStops.slice(0, MAX_SHOPPING_STOPS))
        : null,
    hasShopping,
    shoppingVisitCount: shopping.shoppingVisitCount,
    shoppingSourceCount: shopping.shoppingStops.length,
    shoppingSummaryText,
    hasFreeTime: freeTime.hasFreeTime,
    freeTimeSummaryText: freeTime.freeTimeSummaryText,
    freeTimeRawMentions: freeTime.freeTimeRawMentions,
    headerBadges: {
      optionalTour: hasOptionalTour
        ? '\uC120\uD0DD\uAD00\uAD11 \uC788\uC74C'
        : '\uC120\uD0DD\uAD00\uAD11 \uC5C6\uC74C',
      shopping: shoppingSummaryText,
      freeTime: freeTime.freeTimeSummaryText,
    },
  }
}
