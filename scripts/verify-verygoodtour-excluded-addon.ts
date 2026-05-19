/**
 * 참좋은여행 — 가이드경비·1인1실 불포함 추출 스모크.
 */
import assert from 'node:assert/strict'
import { parseDetailBodyStructuredVerygoodtour } from '@/lib/detail-body-parser-verygoodtour'
import { parseVerygoodtourIncludedExcludedSection } from '@/lib/register-verygoodtour-basic'
import {
  extractVerygoodGuideFeeLinesFromPriceBlob,
  sliceVerygoodPriceBlockFromNormalizedRaw,
} from '@/lib/register-verygoodtour-price'

const APP0005_PRICE_TAIL = `
상품가격
아동아동(만 12세 미만) 2014.05.22~2024.05.21
999,000원
유류할증료 315,000원 포함
유아만 2세 미만;
100,000원
* 객실 1인 1실 사용 시 : 140,000원
총 금액999,000원
가이드경비 :
50 USD 현지에서 지불
`.trim()

const APP0005_INC_EXC = `
O 포함사항\tO 불포함사항
1. 왕복항공권\t1. 기사/가이드 경비 $50 (성인/아동 동일)
2. 숙박\t2. 선택관광
`.trim()

function hasSingleRoom140(lines: string[]): boolean {
  return lines.some((x) => /1인.*실|객실.*1인/i.test(x) && /140[,.]?000/.test(x))
}

function main(): void {
  const guideFromPrice = extractVerygoodGuideFeeLinesFromPriceBlob(APP0005_PRICE_TAIL)
  assert.ok(
    guideFromPrice.some((x) => /50\s*USD/i.test(x) && /가이드\s*경비|가이드경비/i.test(x)),
    `가이드경비 USD 병합: ${JSON.stringify(guideFromPrice)}`
  )

  const ie = parseVerygoodtourIncludedExcludedSection(APP0005_INC_EXC)
  assert.ok(
    ie.excludedItems.some((x) => /기사\s*\/\s*가이드\s*경비/i.test(x) && /\$50/.test(x)),
    `2컬럼 불포함: ${JSON.stringify(ie.excludedItems)}`
  )

  const body = parseDetailBodyStructuredVerygoodtour({
    rawText: `${APP0005_INC_EXC}\n\n${APP0005_PRICE_TAIL}`,
  })
  const slice = sliceVerygoodPriceBlockFromNormalizedRaw(body.normalizedRaw)
  assert.ok(/140[,.]?000/.test(slice), `가격 슬라이스 1인1실: ${slice.slice(0, 200)}`)
  assert.ok(
    extractVerygoodGuideFeeLinesFromPriceBlob(slice).some((x) => /USD/i.test(x)),
    '슬라이스에서 가이드경비'
  )

  const jpp = extractVerygoodGuideFeeLinesFromPriceBlob('가이드경비 0원\n')
  assert.equal(jpp.length, 0, '0원 가이드경비는 제외')

  console.log('[verify-verygoodtour-excluded-addon] ok')
}

main()
