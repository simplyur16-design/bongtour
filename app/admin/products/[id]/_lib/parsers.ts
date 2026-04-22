import { parseShoppingStopsJson } from '@/lib/public-product-extras'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import { resolvePublicConsumptionModuleKey } from '@/lib/resolve-public-consumption-module-key'
import type { StructuredSignalsView } from '../_types'

export function parseStructuredSignalsView(
  rawMeta: string | null | undefined,
  product?: { optionalToursStructured?: string | null; shoppingShopOptions?: string | null; hotelSummaryRaw?: string | null },
  originSource?: string | null,
  brandKey?: string | null | undefined
): StructuredSignalsView {
  if (!rawMeta?.trim()) return null
  try {
    const parsed = JSON.parse(rawMeta) as Record<string, unknown>
    const s = parsed.structuredSignals as Record<string, unknown> | undefined
    if (!s || typeof s !== 'object') return null
    const reviewRaw = s.detailBodyReview as Record<string, unknown> | undefined
    const toArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [])
    const review = reviewRaw
      ? {
          required: toArr(reviewRaw.required),
          warning: toArr(reviewRaw.warning),
          info: toArr(reviewRaw.info),
        }
      : null
    const fs = s.flightStructured as Record<string, unknown> | undefined
    const fDebug = fs?.debug as Record<string, unknown> | undefined
    const flightStatus =
      fDebug?.status === 'success' || fDebug?.status === 'partial' || fDebug?.status === 'failure'
        ? (fDebug.status as 'success' | 'partial' | 'failure')
        : null
    const exposurePolicy =
      fDebug?.exposurePolicy === 'public_full' ||
      fDebug?.exposurePolicy === 'public_limited' ||
      fDebug?.exposurePolicy === 'admin_only'
        ? (fDebug.exposurePolicy as 'public_full' | 'public_limited' | 'admin_only')
        : null
    const hotelRows = Array.isArray((s.hotelStructured as Record<string, unknown> | undefined)?.rows)
      ? ((s.hotelStructured as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const optionalRows = Array.isArray((s.optionalToursStructuredCanonical as Record<string, unknown> | undefined)?.rows)
      ? ((s.optionalToursStructuredCanonical as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const shoppingRows = Array.isArray((s.shoppingStructured as Record<string, unknown> | undefined)?.rows)
      ? ((s.shoppingStructured as { rows: unknown[] }).rows.length ?? 0)
      : 0
    const includedRows =
      (Array.isArray((s.includedExcludedStructured as Record<string, unknown> | undefined)?.includedItems)
        ? ((s.includedExcludedStructured as { includedItems: unknown[] }).includedItems.length ?? 0)
        : 0) +
      (Array.isArray((s.includedExcludedStructured as Record<string, unknown> | undefined)?.excludedItems)
        ? ((s.includedExcludedStructured as { excludedItems: unknown[] }).excludedItems.length ?? 0)
        : 0)
    const consumptionKey = resolvePublicConsumptionModuleKey(brandKey, originSource)
    const optionalCanonical = s.optionalToursStructuredCanonical as
      | {
          rows?: Array<{
            tourName?: string
            currency?: string
            adultPrice?: number | null
            childPrice?: number | null
            durationText?: string
            minPeopleText?: string
            guide同行Text?: string
            waitingPlaceText?: string
            descriptionText?: string
            noteText?: string
          }>
        }
      | null
      | undefined
    const optionalLegacy = product?.optionalToursStructured ?? null
    const optionalConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveOptionalToursConsumption({
            canonical: optionalCanonical,
            legacyOptionalToursStructured: optionalLegacy,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveOptionalToursConsumption({
              canonical: optionalCanonical,
              legacyOptionalToursStructured: optionalLegacy,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveOptionalToursConsumption({
                canonical: optionalCanonical,
                legacyOptionalToursStructured: optionalLegacy,
              })
            : publicConsumptionHanatour.resolveOptionalToursConsumption({
                canonical: optionalCanonical,
                legacyOptionalToursStructured: optionalLegacy,
              })
    const shoppingCanonical = s.shoppingStructured as
      | {
          rows?: Array<{
            shoppingItem?: string
            shoppingPlace?: string
            durationText?: string
            refundPolicyText?: string
            noteText?: string
          }>
        }
      | null
      | undefined
    const shoppingLegacyDb = parseShoppingStopsJson(product?.shoppingShopOptions ?? null)
    const shoppingLegacyMeta = parseShoppingStopsJson(String(s.shoppingStops ?? '') || null)
    const shoppingConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveShoppingConsumption({
            canonical: shoppingCanonical,
            legacyDbRows: shoppingLegacyDb,
            legacyMetaRows: shoppingLegacyMeta,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveShoppingConsumption({
              canonical: shoppingCanonical,
              legacyDbRows: shoppingLegacyDb,
              legacyMetaRows: shoppingLegacyMeta,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveShoppingConsumption({
                canonical: shoppingCanonical,
                legacyDbRows: shoppingLegacyDb,
                legacyMetaRows: shoppingLegacyMeta,
              })
            : publicConsumptionHanatour.resolveShoppingConsumption({
                canonical: shoppingCanonical,
                legacyDbRows: shoppingLegacyDb,
                legacyMetaRows: shoppingLegacyMeta,
              })
    const hotelCanonical = s.hotelStructured as
      | {
          rows?: Array<{
            dayLabel?: string
            dateText?: string
            cityText?: string
            bookingStatusText?: string
            hotelNameText?: string
            hotelCandidates?: string[]
            noteText?: string
          }>
        }
      | null
      | undefined
    const hotelLegacyPlans = Array.isArray(s.dayHotelPlans) ? (s.dayHotelPlans as any[]) : null
    const hotelLegacyNarrative = Boolean(
      String(s.hotelInfoRaw ?? '').trim() || String(product?.hotelSummaryRaw ?? '').trim()
    )
    const hotelConsumption =
      consumptionKey === 'modetour'
        ? publicConsumptionModetour.resolveHotelConsumption({
            canonical: hotelCanonical,
            legacyStructuredPlans: hotelLegacyPlans,
            hasLegacyNarrativeFallback: hotelLegacyNarrative,
          })
        : consumptionKey === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveHotelConsumption({
              canonical: hotelCanonical,
              legacyStructuredPlans: hotelLegacyPlans,
              hasLegacyNarrativeFallback: hotelLegacyNarrative,
            })
          : consumptionKey === 'ybtour'
            ? publicConsumptionYbtour.resolveHotelConsumption({
                canonical: hotelCanonical,
                legacyStructuredPlans: hotelLegacyPlans,
                hasLegacyNarrativeFallback: hotelLegacyNarrative,
              })
            : publicConsumptionHanatour.resolveHotelConsumption({
                canonical: hotelCanonical,
                legacyStructuredPlans: hotelLegacyPlans,
                hasLegacyNarrativeFallback: hotelLegacyNarrative,
              })

    return {
      review,
      flightStatus,
      exposurePolicy,
      sections: [
        {
          key: 'flight',
          label: '항공',
          rawPresent: Boolean(String(s.flightRaw ?? '').trim()),
          structuredSummary: `status=${flightStatus ?? '-'} / exposure=${exposurePolicy ?? '-'}`,
        },
        {
          key: 'hotel',
          label: '호텔',
          rawPresent: Boolean(String(s.hotelPasteRaw ?? '').trim()),
          structuredSummary: `rows=${hotelRows}`,
        },
        {
          key: 'optional',
          label: '선택관광',
          rawPresent: Boolean(String(s.optionalToursPasteRaw ?? '').trim()),
          structuredSummary: `rows=${optionalRows}`,
        },
        {
          key: 'shopping',
          label: '쇼핑',
          rawPresent: Boolean(String(s.shoppingPasteRaw ?? '').trim()),
          structuredSummary: `rows=${shoppingRows}`,
        },
        {
          key: 'includedExcluded',
          label: '포함/불포함',
          rawPresent: false,
          structuredSummary: `items=${includedRows}`,
        },
      ],
      publicConsumption: [
        {
          key: 'hotel',
          label: '호텔',
          source: hotelConsumption.source,
          mode:
            hotelConsumption.source === 'none'
              ? 'none'
              : hotelConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
        {
          key: 'optional',
          label: '선택관광',
          source: optionalConsumption.source,
          mode:
            optionalConsumption.source === 'none'
              ? 'none'
              : optionalConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
        {
          key: 'shopping',
          label: '쇼핑',
          source: shoppingConsumption.source,
          mode:
            shoppingConsumption.source === 'none'
              ? 'none'
              : shoppingConsumption.usedFallback
                ? 'legacy-fallback'
                : 'canonical-first',
        },
      ],
    }
  } catch {
    return null
  }
}
