'use client'

import type { FlightLegTwoLineDisplay } from '@/lib/flight-user-display'
import { isPlaceholderFlightAirportLabel } from '@/lib/flight-user-display'

function FlightAtTextCell({ atText, dayOffset }: { atText: string; dayOffset?: number | null }) {
  return (
    <span className="inline-flex items-baseline justify-end gap-1">
      {dayOffset != null && dayOffset > 0 ? (
        <span className="shrink-0 text-[11px] font-bold leading-none text-[#D85A30]" aria-label={`${dayOffset}일 후`}>
          +{dayOffset}
        </span>
      ) : null}
      <span className="tabular-nums">{atText}</span>
    </span>
  )
}

/** 패키지·자유여행 hero — 가는편/오는편 2줄(공항 없으면 일시만) */
export default function FlightLegTwoLineBlock({
  label,
  leg,
}: {
  label: string
  leg: FlightLegTwoLineDisplay | null | undefined
}) {
  const rowClass = 'bt-wrap text-sm leading-snug text-[#1F1B2D]'

  return (
    <div className="border-t border-[#DAD4EE]/30 py-1.5 first:border-t-0 first:pt-0">
      {leg ? (
        (() => {
          const departureAirport = isPlaceholderFlightAirportLabel(leg.departureAirport)
            ? ''
            : leg.departureAirport.trim()
          const arrivalAirport = isPlaceholderFlightAirportLabel(leg.arrivalAirport)
            ? ''
            : leg.arrivalAirport.trim()
          const showAirports = Boolean(departureAirport || arrivalAirport)

          if (!showAirports) {
            return (
              <div
                className="grid items-center gap-x-2 gap-y-0.5"
                style={{ gridTemplateColumns: '3.25rem minmax(0, 1fr) auto' }}
              >
                <span className={`${rowClass} col-start-1 row-start-1`}>{label}</span>
                <span className={`${rowClass} col-start-1 row-start-2`}>
                  {leg.flightNo ? `(${leg.flightNo})` : '\u00a0'}
                </span>
                <span className={`${rowClass} col-start-2 row-start-1 text-right`}>
                  <FlightAtTextCell atText={leg.departureAtText} dayOffset={leg.departureDayOffset} />
                </span>
                <span className={`${rowClass} col-start-2 row-start-2 text-right`}>
                  <FlightAtTextCell atText={leg.arrivalAtText} dayOffset={leg.arrivalDayOffset} />
                </span>
              </div>
            )
          }

          return (
            <div
              className="grid items-center gap-x-2 gap-y-0.5"
              style={{ gridTemplateColumns: '3.25rem 1.125rem minmax(0, 1fr) auto' }}
            >
              <span className={`${rowClass} col-start-1 row-start-1`}>{label}</span>
              <span className={`${rowClass} col-start-1 row-start-2`}>
                {leg.flightNo ? `(${leg.flightNo})` : '\u00a0'}
              </span>
              <span
                className={`${rowClass} col-start-2 row-start-2 text-center text-[#1F1B2D]/55`}
                aria-hidden
              >
                →
              </span>
              {departureAirport ? (
                <span className={`${rowClass} col-start-3 row-start-1 min-w-0`}>{departureAirport}</span>
              ) : null}
              {arrivalAirport ? (
                <span className={`${rowClass} col-start-3 row-start-2 min-w-0`}>{arrivalAirport}</span>
              ) : null}
              <span className={`${rowClass} col-start-4 row-start-1 text-right`}>
                <FlightAtTextCell atText={leg.departureAtText} dayOffset={leg.departureDayOffset} />
              </span>
              <span className={`${rowClass} col-start-4 row-start-2 text-right`}>
                <FlightAtTextCell atText={leg.arrivalAtText} dayOffset={leg.arrivalDayOffset} />
              </span>
            </div>
          )
        })()
      ) : (
        <div className="grid grid-cols-[3.25rem_1fr] items-start gap-x-2.5">
          <span className={rowClass}>{label}</span>
          <p className={rowClass}>상담 시 안내</p>
        </div>
      )}
    </div>
  )
}
