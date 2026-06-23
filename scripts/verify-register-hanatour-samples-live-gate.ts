/**
 * 하나투어 SSOT 7샘플(해외패키지 3 + 자유여행 4) — 항공·일정·선택관광 live gate.
 * REGRESSION-FREEZE[hanatour-register-samples-live-gate]: manifest
 *
 * npx tsx scripts/verify-register-hanatour-samples-live-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

const TRP_BASE = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'

function countJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

type SampleKind = 'package' | 'air_hotel_free'

type HanatourSample = {
  pkgCd: string
  kind: SampleKind
  scheduleDays: number
  minOptionalTours: number
  outboundFlightNo: string
  inboundFlightNo: string
}

/** 운영자 지정 SSOT — 다른 공급사 작업 후에도 이 목록이 깨지면 CI 실패 */
const SAMPLES: HanatourSample[] = [
  {
    pkgCd: 'CHP101260701TWW',
    kind: 'package',
    scheduleDays: 3,
    minOptionalTours: 2,
    outboundFlightNo: 'TW0643',
    inboundFlightNo: 'TW0644',
  },
  {
    pkgCd: 'CPP172260627TWK',
    kind: 'package',
    scheduleDays: 6,
    minOptionalTours: 0,
    outboundFlightNo: 'TW9635',
    inboundFlightNo: 'TW9636',
  },
  {
    pkgCd: 'CPP171260627TW1',
    kind: 'package',
    scheduleDays: 6,
    minOptionalTours: 9,
    outboundFlightNo: 'TW9635',
    inboundFlightNo: 'TW9636',
  },
  {
    pkgCd: 'CMB1952607057CH',
    kind: 'air_hotel_free',
    scheduleDays: 3,
    minOptionalTours: 0,
    outboundFlightNo: '7C6001',
    inboundFlightNo: '7C6002',
  },
  {
    pkgCd: 'AVB235260704VJA',
    kind: 'air_hotel_free',
    scheduleDays: 5,
    minOptionalTours: 6,
    outboundFlightNo: 'VJ0879',
    inboundFlightNo: 'VJ0878',
  },
  {
    pkgCd: 'CKB101260709OZ0',
    kind: 'air_hotel_free',
    scheduleDays: 4,
    minOptionalTours: 0,
    outboundFlightNo: 'OZ0353',
    inboundFlightNo: 'OZ0354',
  },
  {
    pkgCd: 'PGB245260627LJ9',
    kind: 'air_hotel_free',
    scheduleDays: 6,
    minOptionalTours: 22,
    outboundFlightNo: 'LJ0915',
    inboundFlightNo: 'LJ0916',
  },
]

function sampleUrl(pkgCd: string): string {
  return `${TRP_BASE}?pkgCd=${encodeURIComponent(pkgCd)}&prePage=major-products`
}

function flightReviewFlags(parsed: RegisterParsed): string[] {
  const required = parsed.detailBodyStructured?.review?.required ?? []
  return required.filter((r) => /항공|편명|구조화/i.test(r))
}

async function verifySample(sample: HanatourSample): Promise<void> {
  const url = sampleUrl(sample.pkgCd)
  const parsed = await augmentHanatourParsedWithDetailCollect(
    { originUrl: url } as RegisterParsed,
    { originUrl: url },
  )

  assert.equal(
    parsed.schedule?.length ?? 0,
    sample.scheduleDays,
    `${sample.pkgCd}: schedule days`,
  )
  assert.ok(parsed.hanatourDetailCollectRan, `${sample.pkgCd}: detail collect must run`)
  assert.match(
    parsed.hanatourDetailCollectSummary ?? '',
    /항공 pkgAirSeqList/,
    `${sample.pkgCd}: flight API collect summary`,
  )
  assert.ok(
    registerFlightCollectLooksComplete(parsed),
    `${sample.pkgCd}: registerFlightCollectLooksComplete`,
  )
  assert.equal(parsed.outboundFlightNo, sample.outboundFlightNo, `${sample.pkgCd}: outbound`)
  assert.equal(parsed.inboundFlightNo, sample.inboundFlightNo, `${sample.pkgCd}: inbound`)
  assert.ok(
    parsed.detailBodyStructured?.flightStructured?.outbound?.departureTime,
    `${sample.pkgCd}: outbound departureTime`,
  )
  assert.ok(
    parsed.detailBodyStructured?.flightStructured?.inbound?.departureTime,
    `${sample.pkgCd}: inbound departureTime`,
  )
  assert.deepEqual(
    flightReviewFlags(parsed),
    [],
    `${sample.pkgCd}: flight review flags after pkgAirSeqList + refreshHanatourDetailBodyPolicy`,
  )

  const optionalCount = countJsonRows(parsed.optionalToursStructured)
  if (sample.minOptionalTours > 0) {
    assert.ok(
      optionalCount >= sample.minOptionalTours,
      `${sample.pkgCd}: optional tours >= ${sample.minOptionalTours} (got ${optionalCount})`,
    )
    assert.equal(parsed.hasOptionalTour, true, `${sample.pkgCd}: hasOptionalTour`)
  } else {
    assert.equal(optionalCount, 0, `${sample.pkgCd}: no optional tours`)
  }

  const included = parsed.includedItems?.length ?? 0
  const excluded = parsed.excludedItems?.length ?? 0
  assert.ok(included >= 5, `${sample.pkgCd}: included items`)
  assert.ok(excluded >= 2, `${sample.pkgCd}: excluded items`)
}

async function main() {
  for (const sample of SAMPLES) {
    await verifySample(sample)
    console.log(`ok ${sample.kind} ${sample.pkgCd}`)
  }
  console.log(`hanatour-register-samples-live-gate: ${SAMPLES.length}/${SAMPLES.length} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
