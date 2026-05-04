/**
 * 히어로·합성 출발일: flightStructured 우선 → 상단 출발/도착 요약 정규식.
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { normalizeCalendarDate } from '@/lib/date-normalize'

export type KyowontourTripAnchors = {
  tripStartIso: string | null
  tripEndIso: string | null
  tripStartSource: string
  tripEndSource: string
}

function isoFromDots(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const iso = normalizeCalendarDate(`${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`)
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

export function extractKyowontourTripAnchorsFromPaste(
  blob: string,
  fs: FlightStructured | null | undefined
): KyowontourTripAnchors {
  let tripStartIso: string | null = null
  let tripEndIso: string | null = null
  let tripStartSource = 'none'
  let tripEndSource = 'none'

  const ob = fs?.outbound
  const ib = fs?.inbound
  if (ob?.departureDate) {
    const iso = isoFromDots(ob.departureDate.replace(/\s*\([^)]*\)\s*$/, '').trim())
    if (iso) {
      tripStartIso = iso
      tripStartSource = 'flight_structured_outbound_departureDate'
    }
  }
  if (ib?.arrivalDate) {
    const ap = (ib.arrivalAirport ?? '').trim()
    if (!ap || /인천|서울/i.test(ap)) {
      const iso = isoFromDots(ib.arrivalDate.replace(/\s*\([^)]*\)\s*$/, '').trim())
      if (iso) {
        tripEndIso = iso
        tripEndSource = 'flight_structured_inbound_arrivalDate'
      }
    }
  }

  if (!tripStartIso) {
    const m = blob.match(/출발\s*[:：]?\s*(\d{4}\.\d{2}\.\d{2})/)
    if (m?.[1]) {
      const iso = isoFromDots(m[1])
      if (iso) {
        tripStartIso = iso
        tripStartSource = 'paste_summary_depart_line'
      }
    }
  }
  if (!tripEndIso) {
    const m = blob.match(/도착\s*[:：]?\s*(\d{4}\.\d{2}\.\d{2})/)
    if (m?.[1]) {
      const iso = isoFromDots(m[1])
      if (iso) {
        tripEndIso = iso
        tripEndSource = 'paste_summary_arrive_line'
      }
    }
  }

  return { tripStartIso, tripEndIso, tripStartSource, tripEndSource }
}
