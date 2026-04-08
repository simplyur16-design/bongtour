import type { ExtractedProduct, ExtractedPricingSchedule } from './extraction-schema'
import type { ParsedProductForDB, ParsedProductPrice, ParsedSurcharge, ParsedItinerary } from './parsed-product-types'

/**
 * B2B 추출 + 가격캘린더 추출 결과 → 새 DB용 ParsedProductForDB 로 매핑
 * [Parsing Rules] 반영: 성인/아동/노베드/유아 분리, 기본가+유류=최종가, 인원별 할증, 현지 가이드비·싱글룸
 *
 * [세트 데이터] AI 추출 정보는 이 결과(parsed) 한 세트로 저장·이동되며, 이동 시 데이터가 정확히 넘어가도록 함.
 */
export function mapToParsedProductForDB(
  product: ExtractedProduct,
  pricing: ExtractedPricingSchedule | null,
  originSource: string
): ParsedProductForDB {
  const originCode = product.productCode?.trim() || pricing?.product_code?.trim() || ''
  const title = product.productName?.trim() || product.productTitle?.trim() || ''
  const primaryDest = product.primaryDestination?.trim() || ''
  const destination = primaryDest || '미지정'
  const duration = inferDuration(product.itinerary)
  const airline = product.airline?.trim() || undefined
  const supplierGroupId = product.groupNumber?.trim() || null
  const firstPrice = pricing?.daily_schedule?.[0]?.pricing?.adult?.total
  const priceFrom = typeof firstPrice === 'number' && !isNaN(firstPrice) ? firstPrice : null
  const priceCurrency = priceFrom != null ? 'KRW' : null

  const prices: ParsedProductPrice[] = []
  const surchargesByProduct: ParsedSurcharge[] = []

  if (pricing?.daily_schedule?.length) {
    for (const row of pricing.daily_schedule) {
      const adult = row.pricing?.adult ?? { base: 0, fuel: 0, total: 0 }
      const childBed = row.pricing?.child_bed ?? row.pricing?.adult
      const childNoBed = row.pricing?.child_nobed
      const infant = row.pricing?.infant ?? { base: 0, fuel: 0, total: 0 }
      const total = (n: number) => (isNaN(n) ? 0 : n)
      prices.push({
        date: String(row.date ?? '').slice(0, 10),
        adultBase: total(adult.base),
        adultFuel: total(adult.fuel),
        childBedBase: childBed ? total(childBed.base) : undefined,
        childNoBedBase: childNoBed ? total(childNoBed.base) : undefined,
        childFuel: childBed ? total((childBed as { fuel?: number }).fuel ?? 0) : 0,
        infantBase: infant?.base != null ? total(infant.base) : undefined,
        infantFuel: infant?.fuel != null ? total(infant.fuel) : 0,
        status:
          row.status === '출발확정' ||
          row.status === '예약가능' ||
          row.status === '마감' ||
          row.status === '대기예약'
            ? row.status
            : '예약가능',
        availableSeats: row.seats ?? 0,
        carrierName: row.carrierName ?? undefined,
        outboundFlightNo: row.outboundFlightNo ?? undefined,
        outboundDepartureAirport: row.outboundDepartureAirport ?? undefined,
        outboundDepartureAt: row.outboundDepartureAt ?? undefined,
        outboundArrivalAirport: row.outboundArrivalAirport ?? undefined,
        outboundArrivalAt: row.outboundArrivalAt ?? undefined,
        inboundFlightNo: row.inboundFlightNo ?? undefined,
        inboundDepartureAirport: row.inboundDepartureAirport ?? undefined,
        inboundDepartureAt: row.inboundDepartureAt ?? undefined,
        inboundArrivalAirport: row.inboundArrivalAirport ?? undefined,
        inboundArrivalAt: row.inboundArrivalAt ?? undefined,
        meetingInfoRaw: row.meetingInfoRaw ?? undefined,
        meetingPointRaw: row.meetingPointRaw ?? undefined,
        meetingTerminalRaw: row.meetingTerminalRaw ?? undefined,
        meetingGuideNoticeRaw: row.meetingGuideNoticeRaw ?? undefined,
      })
      if (row.modifiers?.length && surchargesByProduct.length === 0) {
        for (const m of row.modifiers) {
          surchargesByProduct.push({ minPax: m.min_pax, extraCharge: m.extra })
        }
      }
    }
    if (surchargesByProduct.length === 0 && pricing.daily_schedule[0]?.modifiers?.length) {
      for (const m of pricing.daily_schedule[0].modifiers!) {
        surchargesByProduct.push({ minPax: m.min_pax, extraCharge: m.extra })
      }
    }
  }

  const itineraries: ParsedItinerary[] = (product.itinerary || []).map((d) => ({
    day: d.day ?? 0,
    description: [d.title, ...(d.items || [])].filter(Boolean).join('\n'),
  }))

  return {
    originSource: originSource || '직접입력',
    originCode: originCode || '미지정',
    title: title || '상품명 없음',
    destination: destination || '미지정',
    destinationRaw: primaryDest || null,
    primaryDestination: primaryDest || null,
    supplierGroupId,
    priceFrom,
    priceCurrency,
    duration: duration || '미지정',
    airline,
    prices: prices.length ? prices : [],
    surcharges: surchargesByProduct,
    itineraries: itineraries.length ? itineraries : [],
  }
}

function inferDuration(itinerary: ExtractedProduct['itinerary']): string {
  if (!itinerary?.length) return ''
  const lastDay = Math.max(...itinerary.map((d) => d.day || 0), 0)
  if (lastDay <= 0) return ''
  const nights = lastDay - 1
  return `${nights}박 ${lastDay}일`
}
