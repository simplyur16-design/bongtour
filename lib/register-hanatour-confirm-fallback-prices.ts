/**
 * 하나투어 confirm 전용: productPriceTable만 있고 prices[] 달력 행이 비어
 * departureInputs가 0이 되는 경우를 완화(스크래퍼/캘린더 미사용).
 *
 * SSOT: `adultBase`·child·infant는 **`register-hanatour-price`가 확정한 기본상품 3슬롯**만 사용한다.
 * 현지합류·1인 객실 사용료는 기본가·출발가 축이 아니므로 합성 행에도 넣지 않는다.
 * (방어) 슬롯이 본문의 1인 객실 금액과 같으면 붙여넣기 본문에서 기본상품 3슬롯을 다시 읽어 교체한다.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import { extractIsoDate } from '@/lib/hero-date-utils'
import {
  extractBasicProductThreeSlotsFromBlob,
  extractHanatourSingleRoomKrwAmountFromBlob,
} from '@/lib/register-hanatour-price'

function firstDepartureIsoFromHanatour(parsed: RegisterParsed, rawText: string): string | null {
  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  if (ob?.departureDate?.trim()) {
    const d = ob.departureDate.trim()
    const iso = extractIsoDate(d) ?? extractIsoDate(d.replace(/\./g, '-'))
    if (iso) return iso
  }
  const fromRaw =
    extractIsoDate(parsed.departureDateTimeRaw ?? '') ??
    extractIsoDate(parsed.departureSegmentText ?? '') ??
    extractIsoDate(rawText.slice(0, 120000))
  if (fromRaw) return fromRaw

  const y = rawText.match(/(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (y?.[1] && y[2] && y[3]) {
    return `${y[1]}-${String(y[2]).padStart(2, '0')}-${String(y[3]).padStart(2, '0')}`
  }
  const m = rawText.match(/1\s*일차[^\n]{0,120}?(\d{1,2})[./](\d{1,2})/)
  const y2 = rawText.match(/(20\d{2})\s*년/)
  if (m && y2?.[1]) {
    return `${y2[1]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  }
  return null
}

/**
 * prices[]가 비어 있고 본문 표·항공에서 성인가·출발일을 확보할 때 단일 행만 보강.
 */
export function applyHanatourSyntheticPriceRowIfNeeded(
  parsed: RegisterParsed,
  rawText: string,
  brandKeyLower: string
): RegisterParsed {
  if (brandKeyLower !== 'hanatour') return parsed
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const pt = parsed.productPriceTable
  if (!pt) return parsed
  const srAmt = extractHanatourSingleRoomKrwAmountFromBlob(rawText)
  const basicFromBody = extractBasicProductThreeSlotsFromBlob(rawText)

  let adultBase = pt.adultPrice
  if (adultBase == null || !Number.isFinite(adultBase) || adultBase <= 0) return parsed

  let child: number | undefined =
    pt.childExtraBedPrice != null && Number.isFinite(pt.childExtraBedPrice)
      ? pt.childExtraBedPrice
      : pt.childNoBedPrice != null && Number.isFinite(pt.childNoBedPrice)
        ? pt.childNoBedPrice
        : undefined

  let infantBase: number | undefined =
    pt.infantPrice != null && Number.isFinite(pt.infantPrice) ? pt.infantPrice : undefined

  if (srAmt != null && basicFromBody?.adultPrice != null) {
    if (adultBase === srAmt) adultBase = basicFromBody.adultPrice
    if (child === srAmt && basicFromBody.childPrice != null) child = basicFromBody.childPrice
    if (infantBase === srAmt && basicFromBody.infantPrice != null) infantBase = basicFromBody.infantPrice
  }

  if (adultBase == null || !Number.isFinite(adultBase) || adultBase <= 0) return parsed

  const iso = firstDepartureIsoFromHanatour(parsed, rawText)
  if (!iso || iso.length !== 10) return parsed

  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  const ib = fs?.inbound

  const row: ParsedProductPrice = {
    date: iso,
    adultBase,
    adultFuel: 0,
    childBedBase: child,
    childFuel: 0,
    infantBase,
    infantFuel: 0,
    status: '예약가능',
    availableSeats: 0,
    carrierName: fs?.airlineName ?? parsed.airlineName ?? null,
    outboundFlightNo: ob?.flightNo ?? parsed.outboundFlightNo ?? null,
    outboundDepartureAirport: ob?.departureAirport ?? null,
    outboundDepartureAt:
      ob?.departureDate || ob?.departureTime
        ? `${(ob.departureDate ?? '').trim()} ${(ob.departureTime ?? '').trim()}`.trim()
        : null,
    outboundArrivalAirport: ob?.arrivalAirport ?? null,
    outboundArrivalAt:
      ob?.arrivalDate || ob?.arrivalTime
        ? `${(ob.arrivalDate ?? '').trim()} ${(ob.arrivalTime ?? '').trim()}`.trim()
        : null,
    inboundFlightNo: ib?.flightNo ?? parsed.inboundFlightNo ?? null,
    inboundDepartureAirport: ib?.departureAirport ?? null,
    inboundDepartureAt:
      ib?.departureDate || ib?.departureTime
        ? `${(ib.departureDate ?? '').trim()} ${(ib.departureTime ?? '').trim()}`.trim()
        : null,
    inboundArrivalAirport: ib?.arrivalAirport ?? null,
    inboundArrivalAt:
      ib?.arrivalDate || ib?.arrivalTime
        ? `${(ib.arrivalDate ?? '').trim()} ${(ib.arrivalTime ?? '').trim()}`.trim()
        : null,
  }

  return { ...parsed, prices: [row] }
}
