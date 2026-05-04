/**
 * R-4-D 스모크: paste 보정·일정 9일·식별자·불포함 키워드.
 * 실행: npx tsx scripts/verify-lottetour-r4d.ts
 */
import assert from 'node:assert/strict'
import { buildLottetourScheduleFromPastedText } from '../lib/parse-and-register-lottetour-schedule'
import { mergeLottetourDeterministicFieldsFromPaste } from '../lib/lottetour-paste-deterministic-patch'
import { extractLottetourTripAnchorsFromPaste } from '../lib/lottetour-trip-anchors-from-paste'
import { extractLottetourThreeSlotPricesFromBlob } from '../lib/register-lottetour-price'
import type { RegisterParsed } from '../lib/register-llm-schema-lottetour'

const veniceDolomitiLike = `
일차별 일정
https://www.lottetour.com/evtList/826/854/1000/4900?godId=65222&evtCd=E01A260624KE007
1일차 2026년 06월 24일 수요일
인천 출발
2일차 2026년 06월 25일 목요일
3일차 2026년 06월 26일 금요일
4일차 2026년 06월 27일 토요일
5일차 2026년 06월 28일 일요일
6일차 2026년 06월 29일 월요일
7일차 2026년 06월 30일 화요일
8일차 2026년 07월 01일 수요일
9일차 2026년 07월 02일 목요일
귀국
8박 9일
성인 6,990,000원
유류할증료 1,000,000원
불포함 사항
• 인솔자/가이드/기사경비
롯데관광 약관
아래는 본문 절단
`.trim()

{
  const sched = buildLottetourScheduleFromPastedText(veniceDolomitiLike)
  assert.equal(sched.length, 9, `schedule days expected 9, got ${sched.length}`)
}

{
  const px = extractLottetourThreeSlotPricesFromBlob(veniceDolomitiLike.replace(/\r/g, '\n'))
  assert.equal(px?.adultPrice, 6_990_000)
}

const baseParsed: RegisterParsed = {
  title: 't',
  duration: '',
  excludedItems: ['인솔자/가이드/기사경비'],
} as RegisterParsed

{
  const merged = mergeLottetourDeterministicFieldsFromPaste(baseParsed, veniceDolomitiLike)
  assert.equal(merged.godId, '65222')
  assert.equal(merged.evtCd, 'E01A260624KE007')
  assert.deepEqual(merged.categoryMenuNo, { no1: '826', no2: '854', no3: '1000', no4: '4900' })
}

{
  const anchors = extractLottetourTripAnchorsFromPaste(veniceDolomitiLike, null)
  assert.equal(anchors.godId, '65222')
  assert.equal(anchors.evtCd, 'E01A260624KE007')
}

const hoChiMinLike = `
https://www.lottetour.com/evtDetail/826/857/1063/1067?evtCd=B28A260513KE003
불포함
• 성수기 시즌 호텔 써차지
`.trim()

{
  const merged = mergeLottetourDeterministicFieldsFromPaste(
    { title: 'h', duration: '', excludedItems: ['성수기 시즌 호텔 써차지'] } as RegisterParsed,
    hoChiMinLike
  )
  assert.equal(merged.evtCd, 'B28A260513KE003')
  assert.deepEqual(merged.categoryMenuNo, { no1: '826', no2: '857', no3: '1063', no4: '1067' })
}

console.log('verify-lottetour-r4d: ok')
