/**
 * 하나투어 gw 가격 API — URL saleProdCd(anchor) 정합성 live gate.
 * REGRESSION-FREEZE[hanatour-api-departure-collect]: manifest
 *
 * npx tsx scripts/verify-hanatour-price-api-anchor-gate.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { buildHanatourKstTargetMonths } from '@/lib/hanatour-departures'
import {
  collectHanatourApiDepartureInputsForMonths,
  fetchHanatourPkgProdInfo,
  isHanatourAirtelLikeProdInfo,
  parseHanatourPkgCdFromUrl,
  resolveHanatourApiAirtelLike,
} from '@/lib/hanatour-api-departures'
import { injectHanatourApiDeparturePricesIfMissing } from '@/lib/hanatour-register-api-price-inject'
import { collectHanatourRegisterFacts } from '@/lib/register-facts/hanatour'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

const TRP = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'

type Sample = {
  pkgCd: string
  label: string
  adminTravelScope?: string | null
  /** getPkgProdInfo.adtTotlAmt — 상품 상세 페이지 대표가 (0이면 prodInfo만 >0 확인) */
  expectAnchorPrice: number
  /** 자유여행: 9월 다출발 최소 건수 */
  minSepDepartures?: number
}

const SAMPLES: Sample[] = [
  {
    pkgCd: 'PAB101260920JQ1',
    label: '자유여행 시드니 6일 파라독스',
    adminTravelScope: 'air_hotel_free',
    expectAnchorPrice: 2_059_000,
    minSepDepartures: 3,
  },
  {
    pkgCd: 'CQP1112608017CB',
    label: '몽골 테렐지 패키지',
    adminTravelScope: 'overseas',
    expectAnchorPrice: 0,
  },
  {
    pkgCd: 'PAP101260920JQ1',
    label: '시드니 패키지 — admin overseas 시 PAB 미혼입',
    adminTravelScope: 'overseas',
    expectAnchorPrice: 1_749_000,
  },
]

function saleProdCdFromInput(row: { supplierDepartureCodeCandidate?: string | null }): string {
  return String(row.supplierDepartureCodeCandidate ?? '').replace(/^hanatour:/, '')
}

function assertCalendarProductLine(sample: Sample, cal: Awaited<ReturnType<typeof collectHanatourApiDepartureInputsForMonths>>): void {
  for (const row of cal.inputs) {
    const code = saleProdCdFromInput(row)
    if (sample.pkgCd.startsWith('PAB')) {
      assert.ok(!/^PAP|^CPP|^CQP/i.test(code), `${sample.pkgCd}: package saleProdCd in airtel calendar ${code}`)
      assert.ok(code.startsWith('PAB'), `${sample.pkgCd}: non-airtel code in calendar ${code}`)
    } else if (/^CQP|^PAP|^CPP|^CHP/i.test(sample.pkgCd)) {
      assert.ok(!/^PAB|^AVB|^CMB|^CKB/i.test(code), `${sample.pkgCd}: airtel saleProdCd in package calendar ${code}`)
      assert.ok(code.startsWith(sample.pkgCd.slice(0, 6)), `${sample.pkgCd}: foreign master in calendar ${code}`)
    }
  }
}

async function verifySample(sample: Sample): Promise<void> {
  const url = `${TRP}?pkgCd=${encodeURIComponent(sample.pkgCd)}`
  const scopeOpts = { adminTravelScope: sample.adminTravelScope ?? null }
  const info = await fetchHanatourPkgProdInfo(sample.pkgCd)
  assert.ok(info, `${sample.pkgCd}: getPkgProdInfo`)

  const anchorPrice = Number(info.adtTotlAmt ?? info.adtAmt ?? 0)
  assert.ok(anchorPrice > 0, `${sample.pkgCd}: anchor price from prodInfo`)
  if (sample.expectAnchorPrice > 0) {
    assert.equal(anchorPrice, sample.expectAnchorPrice, `${sample.pkgCd}: prodInfo anchor price`)
  }

  const inferredAirtel = isHanatourAirtelLikeProdInfo(info)
  const scopedAirtel = resolveHanatourApiAirtelLike(info, scopeOpts)

  const monthYms = buildHanatourKstTargetMonths(6)
  const cal = await collectHanatourApiDepartureInputsForMonths(sample.pkgCd, monthYms, scopeOpts)

  assert.equal(cal.airtelLike, scopedAirtel, `${sample.pkgCd}: collect airtelLike matches resolveHanatourApiAirtelLike`)
  assert.ok(cal.anchorInput, `${sample.pkgCd}: anchorInput`)
  assert.equal(cal.anchorInput!.adultPrice, anchorPrice, `${sample.pkgCd}: anchorInput price`)

  assertCalendarProductLine(sample, cal)

  if (sample.minSepDepartures != null) {
    const sep = cal.inputs.filter((r) => r.departureDate?.slice(0, 7) === '2026-09')
    assert.ok(
      sep.length >= sample.minSepDepartures,
      `${sample.pkgCd}: Sep departures >= ${sample.minSepDepartures} (got ${sep.length})`,
    )
  }

  if (sample.pkgCd.startsWith('PAB') && sample.adminTravelScope === 'air_hotel_free') {
    const wrongScope = await collectHanatourApiDepartureInputsForMonths(sample.pkgCd, monthYms, {
      adminTravelScope: 'overseas',
    })
    assert.ok(wrongScope.inputs.length < cal.inputs.length, `${sample.pkgCd}: overseas must not expand airtel calendar like air_hotel_free`)
    assert.equal(wrongScope.airtelLike, false, `${sample.pkgCd}: overseas forces package API mode on airtel cd`)
  }

  const anchorYmd = cal.anchorInput!.departureDate?.slice(0, 10)
  const anchorRow = cal.inputs.find((r) => r.departureDate?.slice(0, 10) === anchorYmd)
  assert.ok(anchorRow, `${sample.pkgCd}: anchor departure date in calendar`)
  assert.equal(anchorRow!.adultPrice, anchorPrice, `${sample.pkgCd}: anchor date price`)

  const injected = await injectHanatourApiDeparturePricesIfMissing({} as RegisterParsed, url, scopeOpts)
  assert.ok((injected.prices?.length ?? 0) > 0, `${sample.pkgCd}: inject prices`)
  assert.equal(
    injected.productPriceTable?.adultPrice,
    anchorPrice,
    `${sample.pkgCd}: productPriceTable adultPrice`,
  )
  for (const row of injected.prices ?? []) {
    const code = parseHanatourPkgCdFromUrl(String(row.supplierDepartureCode ?? row.localPriceText ?? ''))
    if (code && sample.pkgCd.startsWith('PAB')) {
      assert.ok(code.startsWith('PAB'), `${sample.pkgCd}: injected airtel code ${code}`)
    }
    if (code && /^PAP|^CQP|^CPP/i.test(sample.pkgCd)) {
      assert.ok(!/^PAB|^AVB/i.test(code), `${sample.pkgCd}: injected package must not include airtel ${code}`)
    }
  }

  const facts = await collectHanatourRegisterFacts(url, scopeOpts)
  assert.ok(facts, `${sample.pkgCd}: register-facts`)
  assert.ok(facts!.priceRows.length > 0, `${sample.pkgCd}: register-facts priceRows`)
  for (const row of facts!.priceRows) {
    const note = facts!.notes.find((n) => n.includes('productKind=')) ?? ''
    if (sample.adminTravelScope === 'air_hotel_free') {
      assert.ok(note.includes('air_hotel_free'), `${sample.pkgCd}: facts productKind air_hotel_free`)
    }
    if (sample.adminTravelScope === 'overseas' && sample.pkgCd.startsWith('PAP')) {
      assert.ok(note.includes('productKind=package'), `${sample.pkgCd}: facts productKind package`)
    }
  }

  console.log(`ok ${sample.label}`, {
    pkgCd: sample.pkgCd,
    adminTravelScope: sample.adminTravelScope ?? null,
    inferredAirtel,
    scopedAirtel,
    anchorPrice,
    calendarRows: cal.inputs.length,
    airtelLike: cal.airtelLike,
    factsRows: facts!.priceRows.length,
  })
}

async function main() {
  for (const sample of SAMPLES) {
    await verifySample(sample)
  }
  console.log(`hanatour-price-api-anchor-gate: ${SAMPLES.length}/${SAMPLES.length} passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
