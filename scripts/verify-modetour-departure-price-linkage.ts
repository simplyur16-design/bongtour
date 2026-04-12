/**
 * 모두투어 등록용 출발별 가격 연동(diff) 단위 검증.
 *
 *   npx tsx scripts/verify-modetour-departure-price-linkage.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { computeModetourLinkedDeparturePrices } from '../lib/register-modetour-price'

function main() {
  const table = {
    adultPrice: 1_000_000,
    childExtraBedPrice: 950_000,
    childNoBedPrice: 850_000,
    infantPrice: 100_000,
  }
  const a = computeModetourLinkedDeparturePrices({
    adultTotal: 1_000_000,
    table,
    childFuel: 0,
    infantFuel: 0,
  })
  assert.equal(a.childBedPrice, 950_000)
  assert.equal(a.childNoBedPrice, 850_000)
  assert.equal(a.infantPrice, 100_000)
  assert.equal(a.basis, 'diff')
  assert.equal(a.childNoBedPriceSource, 'table_diff_three_slots')

  const b = computeModetourLinkedDeparturePrices({
    adultTotal: 1_100_000,
    table,
    childFuel: 0,
    infantFuel: 0,
  })
  assert.equal(b.childBedPrice, 1_050_000)
  assert.equal(b.childNoBedPrice, 950_000)
  assert.equal(b.infantPrice, 100_000)
  assert.equal(b.childNoBedPriceSource, 'table_diff_three_slots')

  console.log('[verify-modetour-departure-price-linkage]', {
    adultPrice: 1_100_000,
    childBedPrice: b.childBedPrice,
    childNoBedPrice: b.childNoBedPrice,
    infantPrice: b.infantPrice,
    pricingBasis: b.basis,
    childNoBedPriceSource: b.childNoBedPriceSource,
  })

  const tableNoCnb = {
    adultPrice: 1_000_000,
    childExtraBedPrice: 950_000,
    childNoBedPrice: null as number | null,
    infantPrice: 100_000,
  }
  const c = computeModetourLinkedDeparturePrices({
    adultTotal: 1_100_000,
    table: tableNoCnb,
    childFuel: 0,
    infantFuel: 0,
  })
  assert.equal(c.childBedPrice, 1_045_000) // 1_100_000 * (950_000/1_000_000)
  assert.equal(c.childNoBedPrice, 0)
  assert.equal(c.childNoBedPriceSource, 'zero_no_table_child_no_bed_row')

  console.log('verify-modetour-departure-price-linkage.ts OK')
}

main()
