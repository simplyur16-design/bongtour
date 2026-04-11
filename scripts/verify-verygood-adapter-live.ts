/**
 * 참좋은 verygoodtour 어댑터 live 검증: 실제 상세 URL 1건으로 row 수·필드·대표 row·상세 SSOT 파생값 일치 출력.
 * 사용: npx tsx scripts/verify-verygood-adapter-live.ts [detailUrl]
 */
import type { ProductDeparture } from '@prisma/client'

import { getPriceAdult } from '../lib/price-utils'
import { productDeparturesToProductPriceRows } from '../lib/product-departure-to-price-rows-verygoodtour'
import {
  runVerygoodDepartureAdapterLiveProbe,
  type VerygoodDepartureParsed,
} from '../lib/verygoodtour-departures'
import { pickVerygoodPublicDefaultDepartureRow } from '../lib/verygood/verygood-public-default-departure'
import { verygoodDurationLabelFromDepartureAtPair } from '../lib/verygood/verygood-selected-row-trip-display'

const DEFAULT_URL =
  'https://www.verygoodtour.com/Product/PackageDetail?ProCode=JPP455-260603TW&PriceSeq=0&menuCode=101160503'

function verygoodReservationOpenScore(row: { status?: string }): number {
  const s = String(row.status ?? '').trim()
  if (/마감|예약\s*마감|예약마감|불가|취소/.test(s)) return 0
  if (/예약\s*가능|예약가능|^가능|대기\s*예약|대기|신청/i.test(s)) return 2
  return 1
}

function toSyntheticDepartures(rows: VerygoodDepartureParsed[]) {
  return rows.map(
    (x, i) =>
      ({
        id: `probe-${i}`,
        productId: 'probe',
        departureDate: new Date(`${x.raw.departureDate}T00:00:00.000Z`),
        adultPrice: x.raw.adultPrice,
        statusRaw: x.raw.statusRaw,
        statusLabelsRaw: x.input.statusLabelsRaw ?? null,
        seatsStatusRaw: x.input.seatsStatusRaw ?? null,
        carrierName: x.input.carrierName ?? null,
        outboundFlightNo: x.input.outboundFlightNo ?? null,
        outboundDepartureAt: x.input.outboundDepartureAt ?? null,
        inboundArrivalAt: x.input.inboundArrivalAt ?? null,
        outboundDepartureAirport: null,
        outboundArrivalAirport: null,
        inboundDepartureAirport: null,
        inboundArrivalAirport: null,
        inboundFlightNo: null,
        childBedPrice: null,
        childNoBedPrice: null,
        infantPrice: null,
        minPax: x.raw.minPax,
        localPriceText: null,
        meetingInfoRaw: x.input.meetingInfoRaw ?? null,
        meetingPointRaw: x.input.meetingPointRaw ?? null,
        meetingTerminalRaw: x.input.meetingTerminalRaw ?? null,
        isBookable: true,
      }) as unknown as ProductDeparture
  )
}

async function main() {
  const url = (process.argv[2] || DEFAULT_URL).trim()
  const probe = await runVerygoodDepartureAdapterLiveProbe(url, { monthCount: 6 })
  if (!probe) {
    console.log(JSON.stringify({ ok: false, error: 'probe_null_invalid_url_or_detail_fetch_failed', url }, null, 2))
    process.exit(2)
  }

  const passed = probe.rows.map((x) => ({
    departureDate: x.raw.departureDate,
    출발일시: x.input.outboundDepartureAt ?? null,
    귀국일시: x.input.inboundArrivalAt ?? null,
    가격: x.raw.adultPrice,
    예약가능여부: x.raw.statusRaw,
    항공사정보: [x.input.carrierName, x.input.outboundFlightNo].filter(Boolean).join(' ').trim() || null,
    seatsStatusRaw: x.input.seatsStatusRaw ?? null,
    productCode: x.raw.productCode,
  }))

  const departures = toSyntheticDepartures(probe.rows)
  const priceRows = productDeparturesToProductPriceRows(departures)
  const rep =
    priceRows.length > 0
      ? pickVerygoodPublicDefaultDepartureRow(priceRows as Array<{ date: string; id: string; status?: string }>)
      : null
  const repDep = rep ? departures.find((d) => String(d.id) === String(rep.id)) : null

  const heroDep = rep?.date ?? null
  const heroRet = repDep?.inboundArrivalAt
    ? String(repDep.inboundArrivalAt).slice(0, 10)
    : null
  const duration = repDep
    ? verygoodDurationLabelFromDepartureAtPair(repDep.outboundDepartureAt, repDep.inboundArrivalAt)
    : null
  const priceFrom = rep != null ? getPriceAdult(rep as never) : null

  const repCarrier = repDep?.carrierName?.trim() ?? null
  const flightJourneyLineFromRep = repDep
    ? `${String(repDep.outboundDepartureAt ?? '')} → ${String(repDep.inboundArrivalAt ?? '')} (${repCarrier ?? ''})`
    : null

  const stickyDep = heroDep
  const stickyRet = heroRet

  const depYmdFromRepOutbound = repDep?.outboundDepartureAt
    ? String(repDep.outboundDepartureAt).slice(0, 10)
    : null
  const retYmdFromRepInbound = repDep?.inboundArrivalAt
    ? String(repDep.inboundArrivalAt).slice(0, 10)
    : null

  const ssotChecks = {
    heroUsesRepOutboundYmd: heroDep === depYmdFromRepOutbound,
    heroUsesRepInboundYmd: heroRet === retYmdFromRepInbound,
    stickyMatchesHeroDeparture: stickyDep === heroDep,
    stickyMatchesHeroReturn: stickyRet === heroRet,
    durationFromRepPair: duration,
    durationUsesSameRepAtPair:
      repDep != null &&
      duration === verygoodDurationLabelFromDepartureAtPair(repDep.outboundDepartureAt, repDep.inboundArrivalAt),
    flightJourneyUsesRepAtAndCarrier: Boolean(flightJourneyLineFromRep),
    realtimeQuoteAdultMatchesRep: rep != null && priceFrom === getPriceAdult(rep as never),
  }

  const allAligned =
    repDep &&
    heroDep === depYmdFromRepOutbound &&
    heroRet === retYmdFromRepInbound &&
    stickyDep === heroDep &&
    stickyRet === heroRet &&
    ssotChecks.durationUsesSameRepAtPair &&
    ssotChecks.realtimeQuoteAdultMatchesRep

  const failureHints: string[] = []
  if (probe.postSameProductRows === 0) failureHints.push('verygoodtour-adapter returned 0 rows')
  if (!repDep) failureHints.push('no representative row')
  if (!allAligned) failureHints.push('detail_derivation_not_single_rep_row')

  const out = {
    ok: probe.postSameProductRows > 0 && failureHints.length === 0,
    url,
    proCode: probe.proCode,
    detailProductNameNorm: probe.detailProductNameNorm,
    detailTripLabel: probe.detailTripLabel,
    preSameProductScheduleRows: probe.preSameProductScheduleRows,
    postSameProductRows: probe.postSameProductRows,
    passedRows: passed,
    representativeRow: repDep
      ? {
          id: repDep.id,
          출발일시: repDep.outboundDepartureAt,
          귀국일시: repDep.inboundArrivalAt,
          가격: repDep.adultPrice,
          예약가능여부: repDep.statusRaw,
          항공사정보: [repDep.carrierName, repDep.outboundFlightNo].filter(Boolean).join(' ').trim(),
          reservationScore: verygoodReservationOpenScore({ status: String(rep?.status ?? '') }),
        }
      : null,
    detailViewDerivedSameAsRep: {
      heroStickyDepartureYmd: heroDep,
      heroStickyReturnYmd: heroRet,
      travelDurationLabel: duration,
      flightJourneyLineFromRepRow: flightJourneyLineFromRep,
      repCarrierName: repCarrier,
      realtimeQuoteAdult: priceFrom,
    },
    ssotChecks,
    failureHints,
  }

  console.log(JSON.stringify(out, null, 2))
  process.exit(out.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
