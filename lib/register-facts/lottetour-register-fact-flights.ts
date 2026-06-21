/**
 * lottetour register-facts — evtListAjax 행·미팅 → RegisterFactFlightLeg.
 *
 * REGRESSION-FREEZE[register-facts-completeness]: lottetourCalendarRowToRegisterFactFlights — manifest
 */
import type { LottetourCalendarRow } from '@/lib/lottetour-departures'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

function extractFlightNoFromText(text: string | null | undefined): string | null {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const m = raw.match(/\b([A-Z0-9]{2}\d{2,4})\b/i)
  return m?.[1]?.toUpperCase() ?? null
}

function firstTimeToken(text: string | null | undefined): string | null {
  const parts = String(text ?? '')
    .split(/\s*~\s*|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.find((p) => /\d{1,2}:\d{2}/.test(p)) ?? parts[0] ?? null
}

function secondTimeToken(text: string | null | undefined): string | null {
  const parts = String(text ?? '')
    .split(/\s*~\s*|\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const times = parts.filter((p) => /\d{1,2}:\d{2}/.test(p))
  return times[1] ?? null
}

function combineDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
  const d = String(date ?? '').trim()
  const t = String(time ?? '').trim()
  if (!d) return null
  if (!t) return d
  return `${d}T${t}`
}

function meetingOnlyFlights(meetingPlaceRaw: string | null): RegisterFactFlightLeg[] {
  const place = meetingPlaceRaw?.trim()
  if (!place) return []
  return [
    {
      direction: 'outbound',
      carrier: null,
      flightNo: null,
      departureCity: place,
      departureAt: null,
      arrivalCity: null,
      arrivalAt: null,
    },
  ]
}

export function lottetourCalendarRowToRegisterFactFlights(
  row: LottetourCalendarRow | null | undefined,
  meetingPlaceRaw: string | null,
): RegisterFactFlightLeg[] {
  if (!row) return meetingOnlyFlights(meetingPlaceRaw)

  const carrier = row.carrierText?.trim() || null
  const outboundTime = firstTimeToken(row.departTimeText)
  const inboundDepTime = firstTimeToken(row.returnTimeText)
  const outboundFlightNo = extractFlightNoFromText(row.departTimeText) ?? extractFlightNoFromText(carrier)
  const inboundFlightNo = extractFlightNoFromText(row.returnTimeText) ?? outboundFlightNo
  const meeting = meetingPlaceRaw?.trim() || null

  const legs: RegisterFactFlightLeg[] = []

  if (carrier || outboundTime || row.departDate) {
    legs.push({
      direction: 'outbound',
      carrier,
      flightNo: outboundFlightNo,
      departureCity: meeting,
      departureAt: combineDateTime(row.departDate, outboundTime),
      arrivalCity: null,
      arrivalAt: combineDateTime(row.departDate, secondTimeToken(row.departTimeText)),
    })
  }

  if (carrier || inboundDepTime || row.returnDate) {
    legs.push({
      direction: 'inbound',
      carrier,
      flightNo: inboundFlightNo,
      departureCity: null,
      departureAt: combineDateTime(row.returnDate ?? row.departDate, inboundDepTime),
      arrivalCity: meeting,
      arrivalAt: combineDateTime(row.returnDate ?? row.departDate, secondTimeToken(row.returnTimeText)),
    })
  }

  return legs.length > 0 ? legs : meetingOnlyFlights(meetingPlaceRaw)
}
