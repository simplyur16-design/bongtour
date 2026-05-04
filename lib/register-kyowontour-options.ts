/**
 * 교보이지: 쇼핑 회차·환불 중심 행은 옵션에서 제외.
 * 옵션 붙여넣기: (1) 웹 본문형 `비용60유로` + 소요시간 + 참고사항 (4필드 SSOT)
 * (2) 레거시 `$` + 미참가시 3열 표.
 */
import type { OptionalToursStructured } from '@/lib/detail-body-parser-types'

const SHOPPING_AXIS =
  /(쇼핑\s*\d+\s*회|쇼핑\s*총|총\s*\d+\s*회\s*쇼핑|회차|쇼핑\s*품목|쇼핑\s*장소|쇼핑샵|환불\s*여부|교환\s*환불|면세\s*점|아울렛)/i

const ROOM_META = /(싱글\s*차지|싱글차지|1인실|객실\s*추가|룸차지|가이드\s*경비|인솔자\s*동행)/i

type YbFeeAnchor = { feeLineIdx: number; priceText: string; currency: string }

/** 옵션 칸 전용: UI 잔재 제거(개행 유지). */
export function normalizeYbtourOptionalPasteSection(section: string): string {
  const lines = section.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (!t) {
      out.push('')
      continue
    }
    if (/^더보기$/i.test(t)) continue
    if (/^상품\s*안내\s*더\s*보기$/i.test(t)) continue
    if (/^약관\s*\/\s*취소수수료\s*더\s*보기$/i.test(t)) continue
    out.push(t.replace(/[ \u00a0]{2,}/g, ' '))
  }
  return out.join('\n')
}

function collectKyowontourFeeAnchors(lines: string[]): YbFeeAnchor[] {
  const raw: YbFeeAnchor[] = []
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]!
    const inline = L.match(/^비용\s*\$\s*(\d+)/i)
    if (inline) {
      raw.push({ feeLineIdx: i, priceText: `$${inline[1]}`, currency: '$' })
      continue
    }
    if (/^비용$/i.test(L)) {
      const n = lines[i + 1] ?? ''
      const m = n.match(/^\$\s*(\d+)/i)
      if (m) raw.push({ feeLineIdx: i, priceText: `$${m[1]}`, currency: '$' })
    }
  }
  return dedupeYbtourFeeAnchorsSamePriceWithoutRefBetween(raw, lines)
}

/**
 * 동일 옵션 블록 안에서 `비용60유로` 다음 또 `비용`/`60유로`가 나오는 중복 앵커만 제거.
 * 서로 다른 옵션이 같은 금액(예: 60유로×2)이면 그 사이에 `참고사항`이 있어 구분된다.
 */
function dedupeYbtourFeeAnchorsSamePriceWithoutRefBetween(anchors: YbFeeAnchor[], lines: string[]): YbFeeAnchor[] {
  const out: YbFeeAnchor[] = []
  for (const a of anchors) {
    const prev = out[out.length - 1]
    if (prev) {
      const between = lines.slice(prev.feeLineIdx, a.feeLineIdx).join('\n')
      const hasRef = /참고사항/i.test(between)
      if (!hasRef && a.priceText === prev.priceText && a.feeLineIdx - prev.feeLineIdx < 48) continue
    }
    out.push(a)
  }
  return out
}

/** `비용60유로` / `비용`+`60유로` / `비용: 60유로` */

function ybtourHasDetailEuroFeeBlock(lines: string[], fromIdx: number): boolean {
  for (let k = fromIdx + 1; k < Math.min(lines.length, fromIdx + 45); k++) {
    const a = lines[k] ?? ''
    const b = (lines[k + 1] ?? '').trim()
    if (/^비용$/i.test(a) && /^\s*€\s*\d+/.test(b)) return true
  }
  return false
}

function summarizeYbtourOptionalRefWaiting(noteBlob: string): string {
  const head = noteBlob.split(/※/)[0].replace(/\s+/g, ' ').trim()
  const m = head.match(/미참가\s*시\s*(.+?)(?:입니다|다\.|\.|\(|$)/u)
  if (m?.[1]) return m[1].replace(/\s+/g, '').trim()
  return ''
}

function ybtourEuroPriceDisplay(amount: string): string {
  const d = amount.replace(/^0+/, '') || '0'
  return `€ ${d}`
}

function euroPriceAmountFromText(priceText: string): number | null {
  const m =
    priceText.match(/€\s*(\d+)/) ||
    priceText.match(/(\d+)\s*유로/i) ||
    priceText.match(/(\d+)\s*EUR/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function collectKyowontourEuroFeeAnchors(lines: string[]): YbFeeAnchor[] {
  const raw: YbFeeAnchor[] = []
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]!
    const euroSignInline = L.match(/^비용\s*€\s*(\d+)/i)
    if (euroSignInline) {
      if (!ybtourHasDetailEuroFeeBlock(lines, i)) {
        raw.push({ feeLineIdx: i, priceText: ybtourEuroPriceDisplay(euroSignInline[1]!), currency: 'EUR' })
      }
      continue
    }
    const inline =
      L.match(/^비용\s*[:：]?\s*(\d+)\s*유로/i) ||
      L.match(/^비용\s*(\d+)\s*유로/i) ||
      L.match(/^비용\s*(\d+)\s*EUR/i)
    if (inline) {
      raw.push({ feeLineIdx: i, priceText: ybtourEuroPriceDisplay(inline[1]!), currency: 'EUR' })
      continue
    }
    if (/^비용$/i.test(L)) {
      const n = lines[i + 1] ?? ''
      const mEuro = n.match(/^\s*€\s*(\d+)/) || n.match(/^\s*EUR\s*(\d+)/i)
      if (mEuro) {
        raw.push({ feeLineIdx: i, priceText: ybtourEuroPriceDisplay(mEuro[1]!), currency: 'EUR' })
        continue
      }
      const m = n.match(/^[:：]?\s*(\d+)\s*유로/i) || n.match(/^(\d+)\s*EUR/i)
      if (m) raw.push({ feeLineIdx: i, priceText: ybtourEuroPriceDisplay(m[1]!), currency: 'EUR' })
    }
  }
  return dedupeYbtourFeeAnchorsSamePriceWithoutRefBetween(raw, lines)
}

/** fee 직전까지 스킵해 옵션 제목 줄 인덱스 */
function findTitleLineIndexForFee(lines: string[], feeLineIdx: number): number {
  let j = feeLineIdx - 1
  while (j >= 0) {
    const t = lines[j]!.trim()
    if (!t) {
      j--
      continue
    }
    if (/^더보기$/i.test(t)) {
      j--
      continue
    }
    if (/^[-※•]/.test(t)) {
      j--
      continue
    }
    if (/^비용\s*[:：]?\s*\d+\s*유로/i.test(t)) {
      j--
      continue
    }
    if (/^비용\s*€\s*\d+/i.test(t)) {
      j--
      continue
    }
    if (/^\s*€\s*\d+/.test(t)) {
      j--
      continue
    }
    if (/^비용$/i.test(t)) {
      j--
      continue
    }
    if (/^(\d+)\s*유로$/i.test(t)) {
      j--
      continue
    }
    break
  }
  return j >= 0 ? j : 0
}

function ybtourTitleForEuroAnchor(lines: string[], feeLineIdx: number): string {
  const ti = findTitleLineIndexForFee(lines, feeLineIdx)
  const cand = (lines[ti] ?? '').replace(/\s+/g, ' ').trim()
  if (!cand || /^비용/i.test(cand)) return '옵션'
  return cand.slice(0, 200)
}

function parseKyowontourEuroMetaSlice(slice: string[]): {
  durationText: string
  descriptionText: string
  waitingPlaceText: string
} {
  let durationText = ''
  let i = 0
  while (i < slice.length) {
    const L = slice[i]!
    if (/^소요시간$/i.test(L)) {
      durationText = (slice[i + 1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
      i += 2
      continue
    }
    const inlineDur = L.match(/^소요시간\s*[:：]?\s*(.+)$/i)
    if (inlineDur && (inlineDur[1] ?? '').trim()) {
      durationText = (inlineDur[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
      i += 1
      continue
    }
    if (/^참고사항$/i.test(L)) {
      const rest = slice.slice(i + 1).join('\n').trim()
      const body = rest.slice(0, 8000)
      return {
        durationText,
        descriptionText: body,
        waitingPlaceText: summarizeYbtourOptionalRefWaiting(body),
      }
    }
    i++
  }
  return { durationText, descriptionText: '', waitingPlaceText: '' }
}

function parseKyowontourEuroWebsiteRows(lines: string[], anchors: YbFeeAnchor[]): OptionalToursStructured['rows'] {
  const rows: OptionalToursStructured['rows'] = []
  for (let a = 0; a < anchors.length; a++) {
    const { feeLineIdx, priceText, currency } = anchors[a]!
    const nextTitleIdx =
      a + 1 < anchors.length ? findTitleLineIndexForFee(lines, anchors[a + 1]!.feeLineIdx) : lines.length
    let endExclusive = nextTitleIdx
    if (endExclusive <= feeLineIdx) endExclusive = lines.length
    const metaSlice = lines.slice(feeLineIdx, endExclusive)
    const meta = parseKyowontourEuroMetaSlice(metaSlice)
    const title = ybtourTitleForEuroAnchor(lines, feeLineIdx)
    rows.push({
      tourName: title,
      currency,
      adultPrice: euroPriceAmountFromText(priceText),
      childPrice: null,
      durationText: meta.durationText,
      minPeopleText: '',
      guide同行Text: '',
      waitingPlaceText: meta.waitingPlaceText,
      descriptionText: meta.descriptionText,
      priceText,
      alternateScheduleText: undefined,
    })
  }
  return rows
}

function parseKyowontourEuroWebsiteSection(section: string): OptionalToursStructured {
  const normalized = normalizeYbtourOptionalPasteSection(section)
  const lines = normalized.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
  const anchors = collectKyowontourEuroFeeAnchors(lines)
  if (anchors.length === 0) {
    return { rows: [], reviewNeeded: false, reviewReasons: [] }
  }
  const rows = parseKyowontourEuroWebsiteRows(lines, anchors)
  return { rows, reviewNeeded: false, reviewReasons: [] }
}

function ybtourTitleForAnchor(lines: string[], anchorIdx: number): string {
  if (anchorIdx <= 0) return '옵션'
  let j = anchorIdx - 1
  while (j >= 0 && /^더보기$/i.test(lines[j]!)) j--
  if (j < 0) return '옵션'
  const cand = lines[j]!.replace(/\s+/g, ' ').trim()
  if (!cand || /^비용$/i.test(cand) || /^비용\s*\$/i.test(cand)) return '옵션'
  return cand.slice(0, 200)
}

function parseKyowontourBlock(lines: string[], start: number, end: number): {
  durationText: string
  minPeopleText: string
  alternateScheduleText: string
  waitingPlaceText: string
  guide同行Text: string
} {
  const slice = lines.slice(start, end)
  let durationText = ''
  let minPeopleText = ''
  let alternateScheduleText = ''
  let waitingPlaceText = ''
  let guide同行Text = ''
  let i = 0
  while (i < slice.length) {
    const L = slice[i]!
    if (/^소요시간$/i.test(L)) {
      durationText = (slice[i + 1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
      i += 2
      continue
    }
    if (/^미참가시$/i.test(L)) {
      let k = i + 1
      if (/대기일정/i.test(slice[k] ?? '')) k++
      const dataLine = slice[k] ?? ''
      const parts = dataLine.split(/\t/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
      let triple: string[] = []
      if (parts.length >= 3) triple = parts
      else triple = dataLine.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean)
      if (triple.length >= 3) {
        alternateScheduleText = triple[0]!.slice(0, 300)
        waitingPlaceText = triple[1]!.slice(0, 300)
        guide同行Text = triple[2]!.slice(0, 120)
      }
      i = k + 1
      continue
    }
    if (/^참고사항$/i.test(L)) {
      const rest = slice.slice(i + 1).join('\n')
      const minM = /최소인원\s*[:：]?\s*(\d+)\s*명/i.exec(rest)
      if (minM) minPeopleText = `${minM[1]}명`
      break
    }
    i++
  }
  return { durationText, minPeopleText, alternateScheduleText, waitingPlaceText, guide同行Text }
}

/** 교보이지 관리자 옵션 칸 붙여넣기 — 유로 웹본문 우선, 없으면 `$` 블록. */
export function parseKyowontourOptionalTourPasteSection(section: string): OptionalToursStructured {
  const euroFirst = parseKyowontourEuroWebsiteSection(section)
  if (euroFirst.rows.length > 0) return euroFirst

  const raw = normalizeYbtourOptionalPasteSection(section).replace(/\r/g, '\n')
  const lines = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
  const anchors = collectKyowontourFeeAnchors(lines)
  if (anchors.length === 0) {
    return { rows: [], reviewNeeded: false, reviewReasons: [] }
  }

  const rows: OptionalToursStructured['rows'] = []
  for (let a = 0; a < anchors.length; a++) {
    const { feeLineIdx, priceText, currency } = anchors[a]!
    const nextStart = a + 1 < anchors.length ? anchors[a + 1]!.feeLineIdx : lines.length
    const title = ybtourTitleForAnchor(lines, feeLineIdx)
    const meta = parseKyowontourBlock(lines, feeLineIdx, nextStart)
    const numM = priceText.match(/\$(\d+)/)
    const adultPrice = numM ? Number(numM[1]) : null
    rows.push({
      tourName: title,
      currency,
      adultPrice: adultPrice != null && Number.isFinite(adultPrice) ? adultPrice : null,
      childPrice: null,
      durationText: meta.durationText,
      minPeopleText: meta.minPeopleText,
      guide同行Text: meta.guide同行Text,
      waitingPlaceText: meta.waitingPlaceText,
      descriptionText: '',
      priceText,
      alternateScheduleText: meta.alternateScheduleText || undefined,
    })
  }

  return { rows, reviewNeeded: false, reviewReasons: [] }
}

export function filterKyowontourOptionalTourRows(
  rows: OptionalToursStructured['rows']
): OptionalToursStructured['rows'] {
  return rows.filter((r) => {
    const blob = `${r.tourName} ${r.descriptionText ?? ''} ${r.priceText ?? ''}`
    if (
      SHOPPING_AXIS.test(blob) &&
      !/(선택관광|현지\s*옵션|옵션\s*투어|USD|\$|달러|원\s*\/|유로|EUR|€)/i.test(blob)
    )
      return false
    if (ROOM_META.test(blob) && !r.adultPrice && !/\$|USD|원|유로|EUR|€/.test(blob)) return false
    return true
  })
}

/** 정형 옵션칸이 비정형 본문보다 우선할 때 true (`$` 또는 `유로` 비용 블록). */
export function kyowontourOptionalPasteDominatesUnstructured(section: string, pasteRowCount: number): boolean {
  const flat = section.replace(/\s+/g, ' ')
  if (pasteRowCount <= 0) return false
  if (/비용\s*\$\s*\d+/i.test(flat) || /\$\s*\d+/.test(flat)) return true
  if (/비용\s*\d+\s*유로/i.test(flat) || /\d+\s*유로/i.test(flat)) return true
  if (/비용\s*€\s*\d+/i.test(flat) || /€\s*\d+/.test(flat)) return true
  return false
}
