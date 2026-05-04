import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { createEmptyFlightLeg, stripLogoNoise } from '@/lib/flight-parser-generic'
import {
  parseKyowontourTravelMainScheduleFlight,
  parseKyowontourTravelMainScheduleFlightFromTable,
  tryParseKyowontourFlightBlocks,
  kyowontourSynthesizePreferredRaw,
} from '@/lib/flight-kyowontour-blocks'

type FlightLeg = FlightStructured['outbound']

function mergeLeg(base: FlightLeg, patch: Partial<FlightLeg>): FlightLeg {
  return {
    ...base,
    ...patch,
    durationText: patch.durationText ?? base.durationText ?? null,
  }
}

function legCoreCount(leg: FlightLeg): number {
  return [
    leg.departureAirport,
    leg.arrivalAirport,
    leg.departureDate,
    leg.departureTime,
    leg.arrivalDate,
    leg.arrivalTime,
    leg.flightNo,
  ].filter(Boolean).length
}

/**
 * 교원이지(kyowontour) 관리자 항공 붙여넣기 전용 — `출발`/`도착` 블록·편명·공항·일시.
 * (공용 `parseFlightSectionGeneric` 미사용)
 */
export function parseFlightSectionKyowontour(
  section: string,
  fullBodyForSecondary: string | null | undefined
): FlightStructured {
  const sectionClean = stripLogoNoise(section)
  const full = stripLogoNoise(fullBodyForSecondary ?? '').trim()
  let blocks =
    full.length >= 32 ? parseKyowontourTravelMainScheduleFlight(full) : null
  if (!blocks?.outbound?.flightNo || !blocks?.inbound?.flightNo) {
    blocks = full.length >= 32 ? parseKyowontourTravelMainScheduleFlightFromTable(full) : null
  }
  if (!blocks?.outbound?.flightNo || !blocks?.inbound?.flightNo) {
    blocks = tryParseKyowontourFlightBlocks(sectionClean)
  }
  const empty = createEmptyFlightLeg()
  const supplierBrandKey = 'kyowontour'
  const expectFlightNumber = true

  if (!blocks?.outbound?.flightNo || !blocks?.inbound?.flightNo) {
    const reviewReasons = ['교원이지 출발/도착 블록 또는 편명·일시 추출 실패']
    return {
      airlineName: blocks?.airlineName?.trim() ?? null,
      outbound: empty,
      inbound: empty,
      rawFlightLines: sectionClean.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20),
      debug: {
        candidateCount: 0,
        selectedOutRaw: null,
        selectedInRaw: null,
        partialStructured: false,
        status: 'failure',
        exposurePolicy: 'admin_only',
        secondaryScanBlockCount: 0,
        secondaryFlightSnippet: null,
        supplierBrandKey,
        expectFlightNumber,
      },
      reviewNeeded: true,
      reviewReasons,
    }
  }

  const outbound = mergeLeg(empty, blocks.outbound)
  const inbound = mergeLeg(empty, blocks.inbound)
  const outCore = legCoreCount(outbound)
  const inCore = legCoreCount(inbound)
  const partialStructured = outCore >= 2 || inCore >= 2
  const successStructured = outCore >= 5 && inCore >= 5
  const status: 'success' | 'partial' | 'failure' = successStructured
    ? 'success'
    : partialStructured
      ? 'partial'
      : 'failure'
  const exposurePolicy =
    status === 'success' ? 'public_full' : status === 'partial' ? 'public_limited' : 'admin_only'
  const reviewReasons: string[] = []
  if (status !== 'success') reviewReasons.push('교원이지 항공 구조화 일부만 성공 — 원문 검수')

  const selectedOutRaw = kyowontourSynthesizePreferredRaw(blocks.outbound, '가는편')
  const selectedInRaw = kyowontourSynthesizePreferredRaw(blocks.inbound, '오는편')

  return {
    airlineName: blocks.airlineName?.trim() ?? null,
    outbound,
    inbound,
    rawFlightLines: [selectedOutRaw, selectedInRaw],
    debug: {
      candidateCount: 2,
      selectedOutRaw,
      selectedInRaw,
      partialStructured,
      status,
      exposurePolicy,
      secondaryScanBlockCount: 0,
      secondaryFlightSnippet: null,
      supplierBrandKey,
      expectFlightNumber,
    },
    reviewNeeded: status === 'failure',
    reviewReasons,
  }
}
