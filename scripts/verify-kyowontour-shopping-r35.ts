/**
 * R-3.5: 교원이지 쇼핑 표(장소 컬럼) → structured signals 3행·방문횟수 3.
 * 실행: npx tsx scripts/verify-kyowontour-shopping-r35.ts
 */
import assert from 'node:assert/strict'
import { extractStructuredTourSignals } from '../lib/structured-tour-signals-kyowontour'

/** 다낭&호이안 유형: 헤더에 단독「장소」열, 본문에 총 N회 쇼핑 문구 없음 */
const SAMPLE_BODY = `
상품코드 AVP190260505VJ01
쇼핑 정보 안내
쇼핑품목	장소	소요시간	환불여부
침향&노니	해당샵	약1시간	조건부환불
잡화	해당샵	약1시간	조건부환불
커피	해당샵	약1시간	조건부환불
선택관광 안내
`.trim()

{
  const sig = extractStructuredTourSignals(SAMPLE_BODY)
  assert.equal(sig.shoppingStops.length, 3, 'shoppingStops.length')
  assert.equal(sig.shoppingVisitCount, 3, 'shoppingVisitCount (표 행 수 폴백)')
  assert.ok(sig.shoppingStopsJson, 'shoppingStopsJson')
  const arr = JSON.parse(sig.shoppingStopsJson!) as unknown[]
  assert.equal(arr.length, 3, 'JSON array length')
}

console.log('verify-kyowontour-shopping-r35: ok')
