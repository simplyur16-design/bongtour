/**
 * R-4-A: 롯데관광 schedule 일수 추정 + 스키마 타입 가져오기 스모크.
 * 실행: npx tsx scripts/verify-lottetour-r4a.ts
 */
import assert from 'node:assert/strict'
import { inferExpectedScheduleDayCountFromPaste } from '../lib/register-schedule-extract-lottetour'
import type { LottetourHotelListRow, RegisterGeminiLlmJson } from '../lib/register-llm-schema-lottetour'

const veniceLike = `
상품코드 E01A-0765222
godId 65222
evtCd E01A260624KE007
1일차 2026년 06월 24일 수요일
인천공항 T2 A존 미팅
DAY 2
DAY 3
DAY 4
DAY 5
DAY 6
DAY 7
DAY 8
DAY 9
8박 9일
`.trim()

{
  const n = inferExpectedScheduleDayCountFromPaste(veniceLike, '8박 9일')
  assert.equal(n, 9)
}

const _schemaSmoke: RegisterGeminiLlmJson = {
  godId: '65222',
  evtCd: 'E01A260624KE007',
  categoryMenuNo: { no1: '1', no2: '2', no3: '3', no4: '4' },
  hotelList: [{ city: '베니스', name: '호텔A', status: '미정' }] satisfies LottetourHotelListRow[],
  seatUpgradeOptions: ['비즈니스 +5,000,000원'],
  meetingInfo: { location: '인천공항 T2 A존', time: null },
  tourLeader: { available: true, feeRaw: '100유로', feeAmount: 100, feeCurrency: 'EUR' },
}
void _schemaSmoke

console.log('verify-lottetour-r4a: ok')
