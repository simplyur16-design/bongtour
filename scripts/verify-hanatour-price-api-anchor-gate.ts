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
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import { injectHanatourApiDeparturePricesIfMissing } from '@/lib/hanatour-register-api-price-inject'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

const TRP = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'

type Sample = {
  pkgCd: string
  label: string
  /** getPkgProdInfo.adtTotlAmt — 상품 상세 페이지 대표가 */
  expectAnchorPrice: number
}

const SAMPLES: Sample[] = [
  {
    pkgCd: 'PAB101260920JQ1',
    label: '자유여행 시드니 6일 파라독스',
    expectAnchorPrice: 2_059_000,
  },
  {
    pkgCd: 'CQP1112608017CB',
    label: '몽골 테렐지 패키지',
    expectAnchorPrice: 0,
  },
  {
    pkgCd: 'PAP101260920JQ1',
    label: '시드니 패키지 (동일 rprsProdCd — 자유여행과 분리)',
    expectAnchorPrice: 0,
  },
]

async function verifySample(sample: Sample): Promise<void> {
  const url = `${TRP}?pkgCd=${encodeURIComponent(sample.pkgCd)}`
  const info = await fetchHanatourPkgProdInfo(sample.pkgCd)
  assert.ok(info, `${sample.pkgCd}: getPkgProdInfo`)

  const anchorPrice = Number(info.adtTotlAmt ?? info.adtAmt ?? 0)
  assert.ok(anchorPrice > 0, `${sample.pkgCd}: anchor price from prodInfo`)
  if (sample.expectAnchorPrice > 0) {
    assert.equal(anchorPrice, sample.expectAnchorPrice, `${sample.pkgCd}: prodInfo anchor price`)
  }

  const monthYms = buildHanatourKstTargetMonths(6)
  const cal = await collectHanatourApiDepartureInputsForMonths(sample.pkgCd, monthYms)

  assert.ok(cal.anchorInput, `${sample.pkgCd}: anchorInput`)
  assert.equal(cal.anchorInput!.adultPrice, anchorPrice, `${sample.pkgCd}: anchorInput price`)

  for (const row of cal.inputs) {
    const code = String(row.supplierDepartureCodeCandidate ?? '')
    assert.ok(
      code === `hanatour:${sample.pkgCd}`,
      `${sample.pkgCd}: foreign saleProdCd in calendar ${code}`,
    )
    assert.ok(
      !(sample.pkgCd.startsWith('PAB') && code.includes('PAP')),
      `${sample.pkgCd}: package price must not bleed into airtel calendar`,
    )
  }

  const anchorYmd = cal.anchorInput!.departureDate?.slice(0, 10)
  const anchorRow = cal.inputs.find((r) => r.departureDate?.slice(0, 10) === anchorYmd)
  assert.ok(anchorRow, `${sample.pkgCd}: anchor departure date in calendar`)
  assert.equal(anchorRow!.adultPrice, anchorPrice, `${sample.pkgCd}: anchor date price`)

  const injected = await injectHanatourApiDeparturePricesIfMissing({} as RegisterParsed, url)
  assert.ok((injected.prices?.length ?? 0) > 0, `${sample.pkgCd}: inject prices`)
  assert.equal(
    injected.productPriceTable?.adultPrice,
    anchorPrice,
    `${sample.pkgCd}: productPriceTable adultPrice`,
  )

  console.log(`ok ${sample.label}`, {
    pkgCd: sample.pkgCd,
    anchorPrice,
    calendarRows: cal.inputs.length,
    airtelLike: cal.airtelLike,
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
