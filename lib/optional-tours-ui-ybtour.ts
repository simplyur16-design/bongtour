/**
 * 노랑풍선(ybtour) 전용 — 공개 상세 현지옵션 JSON → UiOptionalTourRow.
 * 공용 `parseOptionalToursForUi`의 하나투어 게이트 대신 ybtour 게이트·priceText 신호를 쓴다(공용 파일 수정 없음).
 */
import type { UiOptionalTourRow } from '@/lib/optional-tours-ui-model'
import { optionalPasteRawToUiRows } from '@/lib/optional-tours-ui-model'
import { optionalTourRowPassesStrictGate as ybtourOptionalTourRowPassesStrictGate } from '@/lib/optional-tour-row-gate-ybtour'

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function isKrwCurrencyToken(c: string | null | undefined): boolean {
  // ybtour: keep supplier currency symbols (€, $, …); only KRW gets "원" suffix in fee part helper.
  const t = (c ?? '').trim()
  if (!t) return false
  return /^(KRW|원|￦|WON|₩|원화)$/i.test(t)
}

function formatOptionalTourFeePart(label: string, amount: number, currency: string | null): string {
  const n = amount.toLocaleString('ko-KR')
  const code = (currency ?? '').trim()
  if (isKrwCurrencyToken(code)) return `${label} ${n}원`
  if (/^EUR|€$/i.test(code)) return `${label} € ${n}`
  if (/^USD|\$$/i.test(code)) return `${label} $${n}`
  if (code) return `${label} ${code} ${n}`
  return `${label} ${n}`
}

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

function parseYbtourOptionalToursForUi(raw: string | null | undefined): UiOptionalTourRow[] {
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
        const descriptionBody =
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
          descriptionBody && descriptionBody.length < 100 && /(?:약\s*)?\d+\s*(?:시간|분)|소요/i.test(descriptionBody)
            ? descriptionBody
            : null
        const descLooksLikeAlternateOnly =
          !!descriptionBody &&
          /대체\s*일정|미참가|대기|기상|변경|불가|별도/i.test(descriptionBody) &&
          !/(?:약\s*)?\d{1,2}\s*(?:시간|분)/.test(descriptionBody)
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
        else if (typeof row.priceText === 'string' && row.priceText.trim()) priceDisplay = row.priceText.trim()
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
        const showDesc =
          descriptionBody &&
          descriptionBody.replace(/\s+/g, ' ').trim() !==
            [durationText, alternateScheduleText, guideText, waitingText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

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
          descriptionBody:
            showDesc && descriptionBody && descriptionBody.length > 1 ? descriptionBody : undefined,
        } as UiOptionalTourRow
      })
      .filter((x): x is UiOptionalTourRow => {
        if (x == null) return false
        const pd = (x.priceDisplay ?? '').trim()
        return ybtourOptionalTourRowPassesStrictGate({
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
          priceText: pd && pd !== '문의' && pd !== '포함' ? pd : undefined,
        })
      })
  } catch {
    return []
  }
}

export function getYbtourOptionalTourUiRows(
  optionalToursStructured: string | null | undefined,
  optionalToursPasteRaw: string | null | undefined
): UiOptionalTourRow[] {
  const fromJson = parseYbtourOptionalToursForUi(optionalToursStructured)
  if (fromJson.length) return fromJson
  return optionalPasteRawToUiRows(optionalToursPasteRaw)
}
