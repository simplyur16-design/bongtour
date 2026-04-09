import { parseOptionalPasteForPublicDisplay } from '@/lib/paste-block-display'
import { isBannedOptionalTourName, optionalTourRowPassesStrictGate } from '@/lib/optional-tour-row-gate-hanatour'

/** Gemini/레거시 JSON (name, priceValue, rawText …) */
export type LegacyStructuredOptionalTour = {
  id?: string
  name: string
  priceText?: string
  priceValue?: number
  currency?: string
  description?: string
  bookingType?: 'onsite' | 'pre' | 'inquire' | 'unknown'
  rawText?: string
}

export function parseLegacyStructuredOptionalTours(raw: string | null | undefined): LegacyStructuredOptionalTour[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x, i) => {
        const row = x as Record<string, unknown>
        const name = typeof row.name === 'string' ? row.name.trim() : ''
        if (!name) return null
        const priceValueRaw =
          typeof row.priceValue === 'number'
            ? row.priceValue
            : typeof row.priceUsd === 'number'
              ? row.priceUsd
              : typeof row.adultPrice === 'number'
                ? row.adultPrice
                : undefined
        return {
          id: typeof row.id === 'string' ? row.id : `structured-${i}`,
          name,
          priceText: typeof row.priceText === 'string' ? row.priceText : undefined,
          priceValue: priceValueRaw,
          currency: typeof row.currency === 'string' ? row.currency : undefined,
          description: typeof row.description === 'string' ? row.description : undefined,
          bookingType:
            row.bookingType === 'onsite' || row.bookingType === 'pre' || row.bookingType === 'inquire' || row.bookingType === 'unknown'
              ? row.bookingType
              : 'unknown',
          rawText: typeof row.rawText === 'string' ? row.rawText : undefined,
        } as LegacyStructuredOptionalTour
      })
      .filter((x): x is LegacyStructuredOptionalTour => {
        if (x == null) return false
        // 레거시 행은 가격 없이도 있을 수 있음 — 금지명만 제거(상품행 게이트는 parseOptionalToursForUi)
        return !isBannedOptionalTourName(x.name)
      })
  } catch {
    return []
  }
}

export function toLegacyBookingTypeLabel(v: string | undefined): 'onsite' | 'pre' | 'inquire' | 'unknown' {
  if (v === 'onsite' || v === 'pre' || v === 'inquire' || v === 'unknown') return v
  return 'unknown'
}

/**
 * optionalToursStructured JSON → 공개 상세 UI용 행 (레거시 추출 + 신규 구조화 행 호환)
 */
export type UiOptionalTourRow = {
  id: string
  name: string
  currency: string | null
  adultPrice: number | null
  childPrice: number | null
  durationText: string | null
  minPaxText: string | null
  guideText: string | null
  waitingText: string | null
  priceDisplay: string
  bookingType: 'onsite' | 'pre' | 'inquire' | 'unknown'
  raw?: string
  /** 하나투어 옵션칸 배지 */
  supplierTags?: string[]
  /** 스페셜포함 등 — 가격 칸에 포함/추가요금 없음 */
  includedNoExtraCharge?: boolean
  /** 대체일정 (본문 설명과 분리) */
  alternateScheduleText?: string | null
  /** 소개 문단 (표/요약과 중복 없이 카드 본문용) */
  descriptionBody?: string | null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function normOptionalTourWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * 비고(`description`/`descriptionText`)가 저장용 **원문 한 줄**(`raw`/`rawText`)과 동일할 때만 표시하지 않음.
 * 등록·파서가 따로 넣은 짧은 메모·비고는 건드리지 않는다(과거 토큰 일괄 제거는 파서 산출물을 망가뜨릴 수 있음).
 */
function pruneOptionalTourUiDescription(rawDesc: string | null, row: Record<string, unknown>): string | null {
  if (!rawDesc?.trim()) return null
  const d = normOptionalTourWs(rawDesc)
  const rawLine =
    typeof row.raw === 'string' && row.raw.trim()
      ? normOptionalTourWs(row.raw)
      : typeof row.rawText === 'string' && row.rawText.trim()
        ? normOptionalTourWs(row.rawText)
        : ''
  if (rawLine && (d === rawLine || d === rawLine.replace(/\t/g, ' '))) return null
  return rawDesc.trim()
}

function isKrwCurrencyToken(c: string | null | undefined): boolean {
  const t = (c ?? '').trim()
  if (!t) return false
  return /^(KRW|원|￦|WON|₩|원화)$/i.test(t)
}

/** 공개 옵션 표: 통화 원문 유지, 숫자만일 때 임의 `원` 부착 금지 */
function formatOptionalTourFeePart(label: string, amount: number, currency: string | null): string {
  const n = amount.toLocaleString('ko-KR')
  if (isKrwCurrencyToken(currency)) return `${label} ${n}원`
  const code = (currency ?? '').trim()
  if (code) return `${label} ${code.toUpperCase()} ${n}`
  return `${label} ${n}`
}

/**
 * 저장 JSON에 성인/아동이 비고 소요시간 칸에 가격 숫자만 들어간 경우 등 —
 * 탭 원문(raw) 열 순서(통화 다음 성인·아동·소요…)로 복구
 */
function repairOptionalTourFromTabRaw(row: Record<string, unknown>): {
  adultPrice: number | null
  childPrice: number | null
  durationText: string | null
  minPaxText: string | null
} {
  const raw =
    (typeof row.raw === 'string' && row.raw.includes('\t') ? row.raw : null) ??
    (typeof row.rawText === 'string' && row.rawText.includes('\t') ? row.rawText : null)
  if (!raw) return { adultPrice: null, childPrice: null, durationText: null, minPaxText: null }
  const cols = raw.split('\t').map((x) => x.trim())
  if (cols.length < 5) return { adultPrice: null, childPrice: null, durationText: null, minPaxText: null }
  const p2 = cols[2] ?? ''
  const p3 = cols[3] ?? ''
  const p4 = cols[4] ?? ''
  if (!/^\d+$/.test(p2) || !/^\d+$/.test(p3)) return { adultPrice: null, childPrice: null, durationText: null, minPaxText: null }
  if (!/(?:분|시간|hour|min)/i.test(p4)) return { adultPrice: null, childPrice: null, durationText: null, minPaxText: null }
  const p5 = cols[5]?.trim() ?? ''
  const minPax = p5 && /명/.test(p5) ? p5 : null
  return {
    adultPrice: Number(p2),
    childPrice: Number(p3),
    durationText: p4,
    minPaxText: minPax,
  }
}

export function parseOptionalToursForUi(raw: string | null | undefined): UiOptionalTourRow[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x, i) => {
        const row = x as Record<string, unknown>
        const name =
          (typeof row.name === 'string' ? row.name.trim() : '') ||
          (typeof row.tourName === 'string' ? row.tourName.trim() : '')
        if (!name) return null
        const supplierTags = Array.isArray(row.supplierTags)
          ? row.supplierTags.map((t) => String(t).trim()).filter(Boolean)
          : []
        const includedNoExtraCharge = row.includedNoExtraCharge === true
        const altFromJson =
          typeof row.alternateScheduleText === 'string' && row.alternateScheduleText.trim()
            ? String(row.alternateScheduleText).trim()
            : null
        const noteFromRow =
          typeof row.noteText === 'string' && row.noteText.trim() ? String(row.noteText).trim() : null
        const rawDescription =
          (typeof row.description === 'string' && row.description.trim()) ||
          (typeof row.descriptionText === 'string' && row.descriptionText.trim()) ||
          null
        const repaired = repairOptionalTourFromTabRaw(row)
        const adultPrice =
          num(row.adultPrice) ?? num(row.priceValue) ?? num(row.priceUsd) ?? repaired.adultPrice
        const childPrice = num(row.childPrice) ?? repaired.childPrice
        const currency =
          typeof row.currency === 'string' && row.currency.trim() ? row.currency.trim() : null
        let durationText = (typeof row.durationText === 'string' && row.durationText.trim()) || null
        const descForDuration =
          rawDescription && rawDescription.length < 100 && /(?:약\s*)?\d+\s*(?:시간|분)|소요/i.test(rawDescription)
            ? rawDescription
            : null
        const descLooksLikeAlternateOnly =
          !!rawDescription &&
          /대체\s*일정|미참가|대기|기상|변경|불가|별도/i.test(rawDescription) &&
          !/(?:약\s*)?\d{1,2}\s*(?:시간|분)/.test(rawDescription)
        if (!durationText && descForDuration && !descLooksLikeAlternateOnly) durationText = descForDuration
        if (repaired.durationText) {
          const dt = durationText?.trim() ?? ''
          if (!dt || /^\d{1,6}$/.test(dt)) durationText = repaired.durationText
        }
        let minPaxText = typeof row.minPaxText === 'string' ? row.minPaxText.trim() : null
        if (typeof row.minPeopleText === 'string' && row.minPeopleText.trim()) {
          minPaxText = minPaxText ?? row.minPeopleText.trim()
        }
        if (repaired.minPaxText && !minPaxText?.trim()) minPaxText = repaired.minPaxText
        const durNorm = durationText?.replace(/\s+/g, ' ').trim() ?? ''
        let alternateScheduleText = altFromJson
        if (!alternateScheduleText && noteFromRow) {
          const nn = noteFromRow.replace(/\s+/g, ' ').trim()
          if (nn && nn !== durNorm && !(durNorm && nn === durNorm)) alternateScheduleText = nn
        }
        const guideText =
          (typeof row.guide同行Text === 'string' && row.guide同行Text.trim()) ||
          (typeof (row as { guideText?: string }).guideText === 'string'
            ? (row as { guideText?: string }).guideText?.trim()
            : null) ||
          null
        const waitingText =
          (typeof row.waitingPlaceText === 'string' && row.waitingPlaceText.trim()) ||
          (typeof row.waitPlaceIfNotJoined === 'string' ? row.waitPlaceIfNotJoined.trim() : null) ||
          null
        let priceDisplay = ''
        if (typeof row.priceDisplay === 'string' && row.priceDisplay.trim()) priceDisplay = row.priceDisplay.trim()
        else if (adultPrice != null || childPrice != null) {
          const parts: string[] = []
          if (adultPrice != null) parts.push(formatOptionalTourFeePart('성인', adultPrice, currency))
          if (childPrice != null) parts.push(formatOptionalTourFeePart('아동', childPrice, currency))
          priceDisplay = parts.join(' · ')
        } else if (includedNoExtraCharge || supplierTags.some((t) => /스페셜/i.test(t))) {
          priceDisplay = '포함'
        } else if (typeof row.raw === 'string' && row.raw.trim()) priceDisplay = row.raw.trim().slice(0, 80)
        const bookingType =
          row.bookingType === 'onsite' || row.bookingType === 'pre' || row.bookingType === 'inquire' || row.bookingType === 'unknown'
            ? row.bookingType
            : 'unknown'
        const descriptionBody = pruneOptionalTourUiDescription(rawDescription, row)
        const showDesc =
          descriptionBody &&
          descriptionBody.replace(/\s+/g, ' ').trim() !==
            [durationText, alternateScheduleText, guideText, waitingText, minPaxText]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()

        return {
          id: typeof row.id === 'string' ? row.id : `opt-${i}`,
          name,
          currency,
          adultPrice,
          childPrice,
          durationText,
          minPaxText,
          guideText,
          waitingText,
          priceDisplay:
            priceDisplay ||
            (includedNoExtraCharge || supplierTags.some((t) => /스페셜/i.test(t)) ? '포함' : '문의'),
          bookingType,
          raw: typeof row.raw === 'string' ? row.raw : typeof row.rawText === 'string' ? row.rawText : undefined,
          supplierTags: supplierTags.length ? supplierTags : undefined,
          includedNoExtraCharge: includedNoExtraCharge || undefined,
          alternateScheduleText,
          descriptionBody: showDesc && descriptionBody && descriptionBody.length > 1 ? descriptionBody : undefined,
        } as UiOptionalTourRow
      })
      .filter((x): x is UiOptionalTourRow => {
        if (x == null) return false
        return optionalTourRowPassesStrictGate({
          name: x.name,
          currency: x.currency,
          adultPrice: x.adultPrice,
          childPrice: x.childPrice,
          durationText: x.durationText,
          minPaxText: x.minPaxText,
          guide同行Text: x.guideText,
          waitingPlaceText: x.waitingText,
          raw: x.raw ?? x.name,
          supplierTags: x.supplierTags,
          includedNoExtraCharge: x.includedNoExtraCharge,
        })
      })
  } catch {
    return []
  }
}

export function sumOptionalTourUsdApprox(rows: UiOptionalTourRow[]): number {
  return rows.reduce((sum, r) => sum + (r.adultPrice ?? 0), 0)
}

function parseWonInt(chunk: string | undefined): number | null {
  if (!chunk) return null
  const n = parseInt(String(chunk).replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function parseAdultChildFromPriceBlob(blob: string): { adult: number | null; child: number | null } {
  const t = blob.replace(/\s+/g, ' ').trim()
  const am = t.match(/성인\s*[:：]?\s*([\d,]+)\s*원?/i)
  const cm = t.match(/아동\s*[:：]?\s*([\d,]+)\s*원?/i)
  return { adult: am ? parseWonInt(am[1]) : null, child: cm ? parseWonInt(cm[1]) : null }
}

function extractMinAltGuideFromText(blob: string): {
  minPaxText: string | null
  alternateScheduleText: string | null
  guideText: string | null
} {
  const t = blob.replace(/\r/g, '\n')
  const minM = t.match(/최소(?:\s*행사)?\s*인원\s*[:：]?\s*([^\n]+)/i)
  const altM = t.match(/대체\s*일정\s*[:：]?\s*([^\n]+)/i)
  const gM = t.match(/(?:미선택\s*시\s*)?(?:가이드\s*동행|가이드\s*동행\s*여부)\s*[:：]?\s*([^\n]+)/i)
  return {
    minPaxText: minM?.[1]?.trim() ?? null,
    alternateScheduleText: altM?.[1]?.trim() ?? null,
    guideText: gM?.[1]?.trim() ?? null,
  }
}

function optionalTourRowFromTsvLine(line: string, i: number): UiOptionalTourRow | null {
  const cols = line.split('\t').map((c) => c.replace(/\s+/g, ' ').trim())
  if (cols.length < 2) return null
  const name = cols[0] ?? ''
  if (!name || isBannedOptionalTourName(name)) return null
  let idx = 1
  let currency: string | null = null
  if (/^[A-Z]{3}$/.test(cols[idx] ?? '')) {
    currency = cols[idx]!
    idx++
  }
  let adultPrice: number | null = null
  let childPrice: number | null = null
  if (/^\d+$/.test(cols[idx] ?? '')) {
    adultPrice = Number(cols[idx])
    idx++
    if (/^\d+$/.test(cols[idx] ?? '')) {
      childPrice = Number(cols[idx])
      idx++
    }
  }
  const durationText = cols[idx] || null
  idx++
  const minPaxText = cols[idx] || null
  idx++
  const alternateScheduleText = cols[idx] || null
  idx++
  const guideText = cols[idx] || null
  idx++
  const waitingText = cols[idx] || null
  const parts: string[] = []
  if (adultPrice != null) parts.push(formatOptionalTourFeePart('성인', adultPrice, currency))
  if (childPrice != null) parts.push(formatOptionalTourFeePart('아동', childPrice, currency))
  let priceDisplay = parts.join(' / ')
  if (!priceDisplay && currency) priceDisplay = currency
  return {
    id: `paste-tsv-${i}`,
    name,
    currency,
    adultPrice,
    childPrice,
    durationText: durationText?.trim() || null,
    minPaxText: minPaxText?.trim() || null,
    guideText: guideText?.trim() || null,
    waitingText: waitingText?.trim() || null,
    priceDisplay: priceDisplay || '문의',
    bookingType: 'unknown',
    raw: line,
    alternateScheduleText: alternateScheduleText?.trim() || null,
  }
}

/**
 * 구조화 JSON이 비었을 때 관리자 paste만으로 UiOptionalTourRow 생성(LLM 없음).
 */
export function optionalPasteRawToUiRows(raw: string | null | undefined): UiOptionalTourRow[] {
  if (!raw?.trim()) return []
  const lines = raw.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim())
  const tsvLines = lines.filter((l) => l.includes('\t') && l.split('\t').length >= 3)
  if (tsvLines.length >= 1) {
    const rows = tsvLines
      .map((l, i) => optionalTourRowFromTsvLine(l, i))
      .filter((x): x is UiOptionalTourRow => x != null)
      .filter((r) => optionalTourRowPassesStrictGate({ ...r, guide同行Text: r.guideText, waitingPlaceText: r.waitingText, raw: r.raw ?? r.name }))
    if (rows.length) return rows
  }
  const blocks = parseOptionalPasteForPublicDisplay(raw)
  return blocks
    .map((b, i) => {
      const blob = [b.description, b.note, b.price, b.duration].filter(Boolean).join('\n')
      const { adult, child } = parseAdultChildFromPriceBlob(`${b.price}\n${blob}`)
      const extra = extractMinAltGuideFromText(blob)
      const adultPrice = adult
      const childPrice = child
      const hasForeignInPrice = /USD|EUR|JPY|GBP|\$|€|£|달러|유로|엔|파운드/i.test(`${b.price ?? ''}\n${blob}`)
      const parts: string[] = []
      if (adultPrice != null && !hasForeignInPrice) parts.push(`성인 ${adultPrice.toLocaleString('ko-KR')}원`)
      if (childPrice != null && !hasForeignInPrice) parts.push(`아동 ${childPrice.toLocaleString('ko-KR')}원`)
      const priceDisplay =
        parts.join(' / ') || (b.price?.trim() ? b.price.trim() : b.duration?.trim() ? b.duration.trim() : '문의')
      const row: UiOptionalTourRow = {
        id: `paste-blk-${i}`,
        name: b.title || `옵션 ${i + 1}`,
        currency:
          hasForeignInPrice && (adultPrice != null || childPrice != null)
            ? null
            : adultPrice != null || childPrice != null
              ? 'KRW'
              : null,
        adultPrice,
        childPrice,
        durationText: b.duration?.trim() || null,
        minPaxText: extra.minPaxText,
        guideText: extra.guideText,
        waitingText: null,
        priceDisplay,
        bookingType: 'unknown',
        raw: [b.title, b.description, b.price, b.duration, b.note].filter(Boolean).join('\n'),
        alternateScheduleText: extra.alternateScheduleText,
        descriptionBody: b.description?.trim() && b.description.trim() !== b.title ? b.description.trim() : undefined,
      }
      return optionalTourRowPassesStrictGate({
        name: row.name,
        currency: row.currency,
        adultPrice: row.adultPrice,
        childPrice: row.childPrice,
        durationText: row.durationText,
        minPaxText: row.minPaxText,
        guide同行Text: row.guideText,
        waitingPlaceText: row.waitingText,
        raw: row.raw ?? row.name,
      })
        ? row
        : null
    })
    .filter((x): x is UiOptionalTourRow => x != null)
}

export function getPublicOptionalTourRowsFromProduct(
  optionalToursStructured: string | null | undefined,
  optionalToursPasteRaw: string | null | undefined
): UiOptionalTourRow[] {
  const fromJson = parseOptionalToursForUi(optionalToursStructured)
  if (fromJson.length) return fromJson
  return optionalPasteRawToUiRows(optionalToursPasteRaw)
}

/** 리스트 표 — 이용요금 칸(성인·아동 동시 표시 우선) */
export function formatOptionalTourFeeCellForPublicTable(row: UiOptionalTourRow): string {
  if (row.includedNoExtraCharge || row.priceDisplay === '포함') return '포함 · 추가요금 없음'
  const pd = row.priceDisplay?.trim()
  if (pd && pd !== '문의') return pd
  if (row.adultPrice != null && row.childPrice != null) {
    return `${formatOptionalTourFeePart('성인', row.adultPrice, row.currency)} / ${formatOptionalTourFeePart('아동', row.childPrice, row.currency)}`
  }
  if (row.adultPrice != null) return formatOptionalTourFeePart('성인', row.adultPrice, row.currency)
  if (row.childPrice != null) return formatOptionalTourFeePart('아동', row.childPrice, row.currency)
  return '문의'
}

/** 미선택 시 가이드 동행 칸 */
export function formatOptionalTourGuideFollowCell(row: UiOptionalTourRow): string {
  const g = row.guideText?.trim()
  if (g) return g
  const w = row.waitingText?.trim()
  if (w) return w
  return '—'
}

/** 공개 표 — 대체일정 칸(구조화 대체일정 우선, 없으면 미참여 시 대기 장소 등 원문 보존) */
export function formatOptionalTourAlternateScheduleCell(row: UiOptionalTourRow): string {
  const a = row.alternateScheduleText?.trim()
  if (a) return a
  const w = row.waitingText?.trim()
  if (w) return w
  return '—'
}

/** 공개 표 — 미선택 시 가이드 동행(가이드 필드만; 대기 장소는 대체일정 칸으로 분리) */
export function formatOptionalTourGuideOnlyCell(row: UiOptionalTourRow): string {
  return row.guideText?.trim() || '—'
}
