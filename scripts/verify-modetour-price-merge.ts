/**
 * 모두투어 본문 가격표(한 줄 나열) + 성인가만 날짜별로 다른 행 → merge 동작 단위 검증.
 *
 *   npx tsx scripts/verify-modetour-price-merge.ts
 */
import assert from 'node:assert/strict'
import type { ProductPriceRow } from '../app/components/travel/TravelProductDetail'
import { mergeProductPriceRowsWithBodyPriceTable } from '../lib/product-departure-to-price-rows-modetour'
import { extractProductPriceTableByLabels, mergeProductPriceTableWithLabelExtract } from '../lib/product-price-table-extract'
import { getPublicPerPaxUnitKrw } from '../lib/price-utils'

/** 실상품과 동일한 모두투어식 한 줄 가격표 */
export const MODETOUR_ONE_LINE_PRICE_FIXTURE =
  '성인 918,900원 (유류할증료 89,900원 포함), 아동 Extra Bed 918,900원, 아동 No Bed 918,900원, 유아 71,000원'

function mockRow(date: string, adult: number): ProductPriceRow {
  return {
    id: `id-${date}`,
    productId: 'p1',
    date,
    adult,
    childBed: null,
    childNoBed: null,
    infant: null,
    localPrice: null,
    priceGap: 0,
    priceAdult: adult,
    priceChildWithBed: null,
    priceChildNoBed: null,
    priceInfant: null,
  }
}

function main() {
  const ex = extractProductPriceTableByLabels(MODETOUR_ONE_LINE_PRICE_FIXTURE)
  assert.ok(ex, '1) extract: null')
  assert.equal(ex!.adultPrice, 918900)
  assert.equal(ex!.childExtraBedPrice, 918900)
  assert.equal(ex!.childNoBedPrice, 918900)
  assert.equal(ex!.infantPrice, 71000, '1) extract: infant 누락')

  const pptPartial = mergeProductPriceTableWithLabelExtract(
    { adultPrice: 918900, childExtraBedPrice: 918900, childNoBedPrice: 918900, infantPrice: null },
    ex
  )
  assert.equal(pptPartial?.infantPrice, 71000, '2) LLM에 유아 없을 때 라벨 추출로 보강')

  const rows = [mockRow('2026-04-20', 518900), mockRow('2026-04-21', 528900), mockRow('2026-04-22', 528900)]

  const mergedCommonOnly = mergeProductPriceRowsWithBodyPriceTable(rows, pptPartial)
  assert.equal(
    getPublicPerPaxUnitKrw(mergedCommonOnly[0]!, 'childBed'),
    918900,
    '5) 공통 merge: 아동이 본문 고정값으로 전 행 동일(증상 재현)'
  )
  assert.notEqual(
    getPublicPerPaxUnitKrw(mergedCommonOnly[0]!, 'childBed'),
    518900,
    '5) 첫 행 아동≠해당일 성인'
  )

  const mergedModetour = mergeProductPriceRowsWithBodyPriceTable(rows, pptPartial, {
    modetourVaryingAdultChildLinkage: true,
  })
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[0]!, 'childBed'), 518900, '5) modetour: 아동이 1행 성인 추종')
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[0]!, 'childNoBed'), 518900)
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[1]!, 'childBed'), 528900)
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[1]!, 'childNoBed'), 528900)
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[0]!, 'infant'), 71000, '5) modetour: 유아 채움')
  assert.equal(getPublicPerPaxUnitKrw(mergedModetour[2]!, 'infant'), 71000)

  console.log('verify-modetour-price-merge.ts OK')
}

main()
