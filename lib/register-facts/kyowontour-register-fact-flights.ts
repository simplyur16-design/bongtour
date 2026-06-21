/**
 * kyowontour register-facts — calendar row·미팅 → RegisterFactFlightLeg.
 *
 * REGRESSION-FREEZE[register-facts-completeness]: kyowontourCalendarRowsToRegisterFactFlights — manifest
 */
import type { KyowontourCalendarRow } from '@/lib/kyowontour-departures'
import type { RegisterFactFlightLeg } from '@/lib/register-facts/types'

export function kyowontourCalendarRowsToRegisterFactFlights(
  rows: KyowontourCalendarRow[],
  meetingText: string | null,
): RegisterFactFlightLeg[] {
  const row =
    rows.find((r) => r.airline?.trim() && r.departDate) ??
    rows.find((r) => r.departDate) ??
    null
  if (!row) return []

  const carrier = row.airline?.trim() || null
  const meeting = meetingText?.trim() || null
  const legs: RegisterFactFlightLeg[] = []

  if (carrier || row.departDate) {
    legs.push({
      direction: 'outbound',
      carrier,
      flightNo: null,
      departureCity: meeting,
      departureAt: row.departDate,
      arrivalCity: null,
      arrivalAt: null,
    })
  }

  if (carrier || row.returnDate) {
    legs.push({
      direction: 'inbound',
      carrier,
      flightNo: null,
      departureCity: null,
      departureAt: row.returnDate || null,
      arrivalCity: meeting,
      arrivalAt: row.returnDate || null,
    })
  }

  return legs
}
