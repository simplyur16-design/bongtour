/**
 * 등록 미리보기 `data` — optionalToursStructured·shoppingStops·includedItems SSOT 반영.
 *
 * REGRESSION-FREEZE[register-admin-preview-card-build]: 6공급사 preview data + foreign currency — manifest
 */
import type { RegisterAdminFinalParsed, RegisterAdminPreviewOptionalTour, RegisterAdminPreviewShoppingItem } from '@/lib/register-admin-preview-card-types'
import type { PricePromotionFieldIssue } from '@/lib/price-promotion-lottetour'
import type { RegisterExtractionFieldIssue, RegisterScheduleDay } from '@/lib/register-llm-schema-lottetour'
import type { RegisterPreviewProductDraft } from '@/lib/register-preview-payload-lottetour'

export function normalizeRegisterOptionalTourCurrency(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return 'KRW'
  const up = s.toUpperCase()
  if (up === 'KRW' || s === '원' || s === '￦') return 'KRW'
  if (up === 'USD' || s === '$') return 'USD'
  if (up === 'CAD' || /캐나다\s*달러|canadian/i.test(s)) return 'CAD'
  if (up === 'EUR' || s === '€') return 'EUR'
  if (up === 'JPY' || s === '¥' || s === '￥' || /엔|円/.test(s)) return 'JPY'
  if (/^[A-Z]{3}$/.test(up)) return up
  return up.slice(0, 8) || 'KRW'
}

export function formatRegisterOptionalTourPrice(amount: number, currency: string): string {
  const n = Math.max(0, Math.floor(Number(amount) || 0))
  const c = normalizeRegisterOptionalTourCurrency(currency)
  if (c === 'KRW') return `${n.toLocaleString('ko-KR')}원`
  return `${c} ${n.toLocaleString('en-US')}`
}

function parseOptionalToursFromStructured(raw: string | null | undefined): RegisterAdminPreviewOptionalTour[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return null
        const o = x as Record<string, unknown>
        const name = String(o.name ?? o.tourName ?? o.title ?? '').trim()
        if (!name) return null
        return {
          name,
          description: String(o.description ?? o.summary ?? ''),
          priceAdult: Math.max(0, Math.floor(Number(o.priceAdult ?? o.adultPrice ?? 0))),
          priceChild: Math.max(0, Math.floor(Number(o.priceChild ?? o.childPrice ?? 0))),
          priceInfant: Math.max(0, Math.floor(Number(o.priceInfant ?? o.infantPrice ?? 0))),
          currency: normalizeRegisterOptionalTourCurrency(o.currency ?? o.currencyCode),
          duration: String(o.duration ?? o.durationText ?? ''),
          alternativeProgram: String(o.alternativeProgram ?? o.alternate ?? o.alternateScheduleText ?? ''),
        } satisfies RegisterAdminPreviewOptionalTour
      })
      .filter((x): x is RegisterAdminPreviewOptionalTour => x != null)
  } catch {
    return []
  }
}

function parseShoppingFromStructured(raw: string | null | undefined): RegisterAdminPreviewShoppingItem[] {
  if (!raw?.trim()) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .map((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return null
        const o = x as Record<string, unknown>
        const itemName = String(o.itemName ?? o.itemType ?? o.shoppingItem ?? o.name ?? '').trim()
        if (!itemName) return null
        return {
          itemName,
          shopLocation: String(o.shopLocation ?? o.placeName ?? o.shoppingPlace ?? o.location ?? ''),
          duration: String(o.duration ?? o.durationText ?? o.time ?? ''),
          refundable: String(o.refundable ?? o.refundPolicyText ?? o.cancel ?? o.refund ?? ''),
        } satisfies RegisterAdminPreviewShoppingItem
      })
      .filter((x): x is RegisterAdminPreviewShoppingItem => x != null)
  } catch {
    return []
  }
}

export function buildRegisterAdminPreviewCardData(args: {
  parsed: {
    originCode?: string | null
    title?: string | null
    supplierListingTitleRaw?: string | null
    duration?: string | null
    schedule?: RegisterScheduleDay[] | null
    includedItems?: string[] | null
    includedText?: string | null
    excludedItems?: string[] | null
    excludedText?: string | null
    optionalToursStructured?: string | null
    shoppingStops?: string | null
    shoppingVisitCount?: number | null
    meetingPlaceRaw?: string | null
    meetingInfoRaw?: string | null
    registerPreviewPolicyNotes?: string[] | null
    prices?: Array<{ adultFuel?: number | null }> | null
    priceFrom?: number | null
    productPriceTable?: { adultPrice?: number | null; childExtraBedPrice?: number | null; infantPrice?: number | null } | null
    detailBodyStructured?: { flightStructured?: import('@/lib/detail-body-parser-types').FlightStructured | null } | null
    airlineName?: string | null
    outboundFlightNo?: string | null
    inboundFlightNo?: string | null
    departureDateTimeRaw?: string | null
    arrivalDateTimeRaw?: string | null
  }
  productDraft: RegisterPreviewProductDraft
  schedule: RegisterScheduleDay[]
  originalBodyText: string
  fieldIssues: Array<PricePromotionFieldIssue | RegisterExtractionFieldIssue>
}): RegisterAdminFinalParsed {
  const { parsed, productDraft, schedule, originalBodyText, fieldIssues } = args
  const pt = productDraft.productPriceTable ?? parsed.productPriceTable ?? null
  const priceAdult = Math.max(0, Math.floor(Number(pt?.adultPrice ?? productDraft.priceFrom ?? parsed.priceFrom ?? 0)))
  const priceChild = Math.max(0, Math.floor(Number(pt?.childExtraBedPrice ?? 0)))
  const priceInfant = Math.max(0, Math.floor(Number(pt?.infantPrice ?? 0)))
  const firstPrice = parsed.prices?.[0]
  const fuel =
    firstPrice && typeof firstPrice.adultFuel === 'number' && firstPrice.adultFuel > 0
      ? Math.floor(firstPrice.adultFuel)
      : undefined
  const policy = parsed.registerPreviewPolicyNotes ?? []
  const issueMsgs = fieldIssues.map((i) => i.reason).filter(Boolean)
  const warnings = Array.from(new Set([...policy, ...issueMsgs])).slice(0, 24)

  const scheduleFinal = schedule.map((d) => ({
    dayNumber: d.day,
    title: d.title?.trim() || undefined,
    activities: d.description?.trim() ? [d.description.trim()] : [],
    hotel: d.hotelText?.trim() || undefined,
    meals: {
      breakfast: (d.breakfastText ?? '').trim(),
      lunch: (d.lunchText ?? '').trim(),
      dinner: (d.dinnerText ?? '').trim(),
    },
  }))

  const optionalTours = parseOptionalToursFromStructured(parsed.optionalToursStructured)
  let shoppingItems = parseShoppingFromStructured(parsed.shoppingStops)
  if (shoppingItems.length === 0) {
    const visit = Math.max(0, Math.floor(Number(parsed.shoppingVisitCount ?? 0)))
    if (visit > 0) {
      shoppingItems = [
        {
          itemName: `쇼핑 ${visit}회`,
          shopLocation: '',
          duration: '',
          refundable: '',
        },
      ]
    }
  }
  const meetingLoc = (parsed.meetingPlaceRaw ?? parsed.meetingInfoRaw ?? '').trim()

  const fs = parsed.detailBodyStructured?.flightStructured ?? null
  const flightPreview =
    fs?.airlineName?.trim() && fs.outbound?.flightNo?.trim() && fs.inbound?.flightNo?.trim()
      ? {
          airline: fs.airlineName.trim(),
          outbound: {
            flightNo: fs.outbound.flightNo?.trim() || parsed.outboundFlightNo?.trim() || '—',
            departureDateTime: [fs.outbound.departureDate, fs.outbound.departureTime].filter(Boolean).join(' ').trim() || '—',
            arrivalDateTime: [fs.outbound.arrivalDate, fs.outbound.arrivalTime].filter(Boolean).join(' ').trim() || '—',
          },
          inbound: {
            flightNo: fs.inbound.flightNo?.trim() || parsed.inboundFlightNo?.trim() || '—',
            departureDateTime: [fs.inbound.departureDate, fs.inbound.departureTime].filter(Boolean).join(' ').trim() || '—',
            arrivalDateTime: [fs.inbound.arrivalDate, fs.inbound.arrivalTime].filter(Boolean).join(' ').trim() || '—',
          },
        }
      : parsed.airlineName?.trim() && parsed.outboundFlightNo?.trim() && parsed.inboundFlightNo?.trim()
        ? {
            airline: parsed.airlineName.trim(),
            outbound: {
              flightNo: parsed.outboundFlightNo.trim(),
              departureDateTime: parsed.departureDateTimeRaw?.trim() || '—',
              arrivalDateTime: '—',
            },
            inbound: {
              flightNo: parsed.inboundFlightNo.trim(),
              departureDateTime: '—',
              arrivalDateTime: parsed.arrivalDateTimeRaw?.trim() || '—',
            },
          }
        : null

  return {
    productCode: (parsed.originCode ?? '').trim(),
    title: (parsed.title || productDraft.title || '').trim() || '(제목 없음)',
    durationLabel: (productDraft.duration || parsed.duration || '').trim() || '-',
    expectedDayCount: Math.max(scheduleFinal.length, parsed.schedule?.length ?? 0),
    priceAdult,
    priceChild,
    priceInfant,
    fuelSurcharge: fuel,
    currency: 'KRW',
    flight: flightPreview,
    schedule: scheduleFinal,
    meetingInfo: meetingLoc ? { location: meetingLoc.slice(0, 500), time: '' } : undefined,
    hotelGradeLabel: undefined,
    includedItems:
      parsed.includedItems?.length ? parsed.includedItems : parsed.includedText?.trim() ? [parsed.includedText.trim()] : [],
    excludedItems:
      parsed.excludedItems?.length ? parsed.excludedItems : parsed.excludedText?.trim() ? [parsed.excludedText.trim()] : [],
    optionalTours,
    shoppingItems,
    originalBodyText: originalBodyText.slice(0, 120_000),
    warnings,
  }
}
