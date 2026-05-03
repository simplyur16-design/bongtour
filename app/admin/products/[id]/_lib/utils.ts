import type { FlightStructured } from '@/lib/detail-body-parser'
import * as fmcHanatour from '@/lib/flight-manual-correction-hanatour'
import * as fmcModetour from '@/lib/flight-manual-correction-modetour'
import * as fmcVerygood from '@/lib/flight-manual-correction-verygoodtour'
import * as fmcYbtour from '@/lib/flight-manual-correction-ybtour'
import type { FlightManualCorrectionPayload } from '@/lib/flight-manual-correction-hanatour'
import {
  resolvePublicConsumptionModuleKey,
  type PublicConsumptionModuleKey,
} from '@/lib/resolve-public-consumption-module-key'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_HANATOUR } from '@/lib/admin-register-verification-meta-hanatour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_MODETOUR } from '@/lib/admin-register-verification-meta-modetour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_VERYGOODTOUR } from '@/lib/admin-register-verification-meta-verygoodtour'
import { REGISTER_PUBLIC_PAGE_TRACE_BULLETS as REGISTER_PUBLIC_PAGE_TRACE_BULLETS_YBTOUR } from '@/lib/admin-register-verification-meta-ybtour'
import { repairUtf8MisreadAsLatin1 } from '@/lib/encoding-repair'
import { adminProductBgImageSourceTypeLabel } from '@/lib/product-bg-image-attribution'
import type {
  DepartureRow,
  FlightManualFormDraft,
  FlightManualFormLegDraft,
  OptionalTourDraft,
  ScheduleEntry,
} from '../_types'

export function fmcModuleForAdminProduct(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
) {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'modetour':
      return fmcModetour
    case 'verygoodtour':
      return fmcVerygood
    case 'ybtour':
      return fmcYbtour
    default:
      return fmcHanatour
  }
}

const REGISTER_PUBLIC_PAGE_TRACE_BULLETS_BY_MODULE: Record<
  PublicConsumptionModuleKey,
  readonly string[]
> = {
  hanatour: REGISTER_PUBLIC_PAGE_TRACE_BULLETS_HANATOUR,
  modetour: REGISTER_PUBLIC_PAGE_TRACE_BULLETS_MODETOUR,
  verygoodtour: REGISTER_PUBLIC_PAGE_TRACE_BULLETS_VERYGOODTOUR,
  ybtour: REGISTER_PUBLIC_PAGE_TRACE_BULLETS_YBTOUR,
}

export function registerPublicPageTraceBulletsForProduct(
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): readonly string[] {
  const key = resolvePublicConsumptionModuleKey(brandKey, originSource)
  return REGISTER_PUBLIC_PAGE_TRACE_BULLETS_BY_MODULE[key]
}

export function formatDepartureDt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

/** UTF-8→latin1 오인 한글 깨짐(상태·항공 등) 복구 후 표시 */
export function adminDepartureText(s: string | null | undefined): string {
  if (s == null || s === '') return ''
  return repairUtf8MisreadAsLatin1(s)
}

export function hasFlightOrMeeting(r: DepartureRow): boolean {
  return !!(
    r.carrierName ||
    r.outboundFlightNo ||
    r.outboundDepartureAirport ||
    r.outboundDepartureAt ||
    r.outboundArrivalAirport ||
    r.outboundArrivalAt ||
    r.inboundFlightNo ||
    r.inboundDepartureAirport ||
    r.inboundDepartureAt ||
    r.inboundArrivalAirport ||
    r.inboundArrivalAt ||
    r.meetingInfoRaw ||
    r.meetingPointRaw ||
    r.meetingTerminalRaw ||
    r.meetingGuideNoticeRaw
  )
}

export const FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"%3E%3Crect fill="%23e2e8f0" width="200" height="120"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12"%3E이미지 없음%3C/text%3E%3C/svg%3E'

export function parseSchedule(schedule: string | null): ScheduleEntry[] {
  if (!schedule || typeof schedule !== 'string') return []
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: Record<string, unknown>) => ({
      day: Number(item.day) ?? 0,
      title: typeof item.title === 'string' ? item.title : undefined,
      description: typeof item.description === 'string' ? item.description : undefined,
      imageKeyword: typeof item.imageKeyword === 'string' ? item.imageKeyword : undefined,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : (item.imageUrl as string | null) ?? null,
      imageSource:
        item.imageSource && typeof item.imageSource === 'object'
          ? (item.imageSource as ScheduleEntry['imageSource'])
          : undefined,
    }))
  } catch {
    return []
  }
}

export function parseAirtelHotelInfo(raw: string | null | undefined): Record<string, string> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

export function parseOptionalToursDraft(raw: string | null | undefined): OptionalTourDraft[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row, idx) => {
        const bookingType: OptionalTourDraft['bookingType'] =
          row.bookingType === 'onsite' || row.bookingType === 'pre' || row.bookingType === 'inquire' || row.bookingType === 'unknown'
            ? row.bookingType
            : 'unknown'
        return {
          id: typeof row.id === 'string' ? row.id : `tour-${idx + 1}`,
          name: typeof row.name === 'string' ? row.name : '',
          priceText: typeof row.priceText === 'string' ? row.priceText : '',
          priceValue: typeof row.priceValue === 'number' ? String(row.priceValue) : '',
          currency: typeof row.currency === 'string' ? row.currency : '',
          description: typeof row.description === 'string' ? row.description : '',
          bookingType,
          sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : idx,
          rawText: typeof row.rawText === 'string' ? row.rawText : '',
          autoExtracted: row.autoExtracted === true,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } catch {
    return []
  }
}

export function parseDetailBodyReviewFromRawMeta(
  rawMeta: string | null | undefined
): { required: string[]; warning: string[]; info: string[] } | null {
  if (!rawMeta?.trim()) return null
  try {
    const parsed = JSON.parse(rawMeta) as Record<string, unknown>
    const structured = parsed.structuredSignals as Record<string, unknown> | undefined
    const review = structured?.detailBodyReview as Record<string, unknown> | undefined
    if (!review || typeof review !== 'object') return null
    const toArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])
    return {
      required: toArr(review.required),
      warning: toArr(review.warning),
      info: toArr(review.info),
    }
  } catch {
    return null
  }
}

export function parseFlightStructuredFromRawMeta(rawMeta: string | null | undefined): FlightStructured | null {
  if (!rawMeta?.trim()) return null
  try {
    const o = JSON.parse(rawMeta) as Record<string, unknown>
    const s = o.structuredSignals as Record<string, unknown> | undefined
    const fs = s?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    return fs as FlightStructured
  } catch {
    return null
  }
}

export function parseFlatFlightNosFromRawMeta(rawMeta: string | null | undefined): {
  outboundFlightNo: string | null
  inboundFlightNo: string | null
} {
  if (!rawMeta?.trim()) return { outboundFlightNo: null, inboundFlightNo: null }
  try {
    const o = JSON.parse(rawMeta) as Record<string, unknown>
    const s = o.structuredSignals as Record<string, unknown> | undefined
    if (!s) return { outboundFlightNo: null, inboundFlightNo: null }
    return {
      outboundFlightNo: typeof s.outboundFlightNo === 'string' ? s.outboundFlightNo.trim() || null : null,
      inboundFlightNo: typeof s.inboundFlightNo === 'string' ? s.inboundFlightNo.trim() || null : null,
    }
  } catch {
    return { outboundFlightNo: null, inboundFlightNo: null }
  }
}

export function emptyFlightManualLegDraft(): FlightManualFormLegDraft {
  return {
    airline: '',
    departureAirport: '',
    departureDate: '',
    departureTime: '',
    arrivalAirport: '',
    arrivalDate: '',
    arrivalTime: '',
    flightNo: '',
  }
}

export function emptyFlightManualFormDraft(): FlightManualFormDraft {
  return {
    outbound: emptyFlightManualLegDraft(),
    inbound: emptyFlightManualLegDraft(),
  }
}

function trimField(s: string): string | null {
  const t = s.trim()
  return t || null
}

function legFinalFromDraft(d: FlightManualFormLegDraft) {
  return {
    airline: trimField(d.airline),
    departureAirport: trimField(d.departureAirport),
    departureDate: trimField(d.departureDate),
    departureTime: trimField(d.departureTime),
    arrivalAirport: trimField(d.arrivalAirport),
    arrivalDate: trimField(d.arrivalDate),
    arrivalTime: trimField(d.arrivalTime),
    flightNo: trimField(d.flightNo),
  }
}

export function buildFlightManualCorrectionForSave(
  draft: FlightManualFormDraft,
  rawMeta: string | null | undefined,
  brandKey: string | null | undefined,
  originSource: string | null | undefined
): FlightManualCorrectionPayload | null {
  const f = fmcModuleForAdminProduct(brandKey, originSource)
  const fs = parseFlightStructuredFromRawMeta(rawMeta)
  let auto = f.extractFlightLegAutoFromFlightStructured(fs)
  auto = f.mergeFlatFlightNoIntoAuto(auto, parseFlatFlightNosFromRawMeta(rawMeta))
  const obF = legFinalFromDraft(draft.outbound)
  const ibF = legFinalFromDraft(draft.inbound)
  const hasOb = f.manualFinalLegHasAny(obF)
  const hasIb = f.manualFinalLegHasAny(ibF)
  if (!hasOb && !hasIb) return null
  return {
    outbound: {
      auto: auto.outbound,
      final: hasOb ? obF : null,
      reviewState: hasOb ? 'manually_edited' : 'auto',
    },
    inbound: {
      auto: auto.inbound,
      final: hasIb ? ibF : null,
      reviewState: hasIb ? 'manually_edited' : 'auto',
    },
  }
}

export function draftFromFlightManualCorrection(fc: FlightManualCorrectionPayload | null | undefined): FlightManualFormDraft {
  const d = emptyFlightManualFormDraft()
  if (!fc) return d
  const ob = fc.outbound?.final
  const ib = fc.inbound?.final
  if (ob) {
    d.outbound = {
      airline: ob.airline ?? '',
      departureAirport: ob.departureAirport ?? '',
      departureDate: ob.departureDate ?? '',
      departureTime: ob.departureTime ?? '',
      arrivalAirport: ob.arrivalAirport ?? '',
      arrivalDate: ob.arrivalDate ?? '',
      arrivalTime: ob.arrivalTime ?? '',
      flightNo: ob.flightNo ?? '',
    }
  }
  if (ib) {
    d.inbound = {
      airline: ib.airline ?? '',
      departureAirport: ib.departureAirport ?? '',
      departureDate: ib.departureDate ?? '',
      departureTime: ib.departureTime ?? '',
      arrivalAirport: ib.arrivalAirport ?? '',
      arrivalDate: ib.arrivalDate ?? '',
      arrivalTime: ib.arrivalTime ?? '',
      flightNo: ib.flightNo ?? '',
    }
  }
  return d
}

/** 대표 이미지 출처 편집(URL 유지) — 라벨은 image-asset SSOT + 상품 전용 키 */
export const HERO_SOURCE_SELECT: { value: string; label: string }[] = [
  'photopool',
  'photo_owned',
  'istock',
  'pexels',
  'gemini',
  'gemini_auto',
  'gemini_manual',
  'manual',
  'other',
  'destination-set',
  'city-asset',
  'attraction-asset',
].map((value) => ({ value, label: adminProductBgImageSourceTypeLabel(value) }))
