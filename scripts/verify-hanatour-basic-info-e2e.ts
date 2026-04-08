/**
 * 하나투어 기본정보 본문 추출 → RegisterParsed 병합 → 가격 finalize E2E 스모크.
 * 실행: npx tsx scripts/verify-hanatour-basic-info-e2e.ts
 */
import {
  applyHanatourBasicInfoBodyExtract,
  extractHanatourBasicInfoFromNormalizedBody,
} from '../lib/hanatour-basic-info-body-extract'
import type { RegisterParsed } from '../lib/register-llm-schema-hanatour'
import { finalizeHanatourRegisterParsedPricing } from '../lib/register-hanatour-price'

const SAMPLE_NORMALIZED_BODY = `
상품가격
기본상품 성인
1,200,000원
기본상품 아동
1,100,000원
기본상품 유아
200,000원

포함/불포함/선택경비 정보
포함내역
왕복 항공권
호텔 숙박비

불포함내역
여행자 보험
가이드/기사 경비 : 인당 JPY 3,000

선택경비
객실 1인 사용료 180,000원
항공리턴변경(불가) 별도
현지합류 성인 800,000원 아동 700,000원 유아 100,000원

예약시 유의사항
• 여권 잔여 유효기간 6개월 이상 필요합니다
• 무비자 입국이 가능한 경우에도 여권은 반드시 지참해야 합니다
• 일정은 현지 사정에 따라 변경될 수 있습니다

가이드/인솔자 및 미팅정보
미팅 일시: 출발일 오전 6시 30분
미팅 장소: 인천국제공항 제1여객터미널 3층

일정표
1일차 도쿄
`.trim()

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

function main() {
  const ex = extractHanatourBasicInfoFromNormalizedBody(SAMPLE_NORMALIZED_BODY)
  assert(ex != null, 'extract should return object')
  assert(Boolean(ex!.includedText?.includes('왕복 항공권')), 'included should have 항공')
  assert(Boolean(ex!.excludedAppend?.includes('가이드/기사')), 'excluded should have 가이드/기사 문구')
  assert(
    Boolean(ex!.excludedAppend?.includes('1인') || ex!.excludedAppend?.includes('객실')),
    'excluded should have 1인 객실'
  )
  assert(
    Boolean(ex!.excludedAppend?.includes('항공') && ex!.excludedAppend?.includes('변경')),
    'excluded should have 항공리턴변경'
  )
  assert(ex!.mandatoryLocalFee === 3000, `mandatory fee expected 3000 got ${ex!.mandatoryCurrency} ${ex!.mandatoryLocalFee}`)
  assert(ex!.mandatoryCurrency === 'JPY', `currency JPY got ${ex!.mandatoryCurrency}`)
  assert((ex!.mustKnowItems?.length ?? 0) >= 2, 'mustKnowItems should have bullets')
  assert(Boolean(ex!.priceTableAppend?.includes('상품가격')), 'price blob should include header')
  assert(Boolean(ex!.excludedAppend?.includes('현지합류')), '선택경비 병합: excludedAppend에 현지합류')
  assert(Boolean(ex!.localJoinPriceBlobAppend?.includes('현지합류')), '현지합류는 가격 blob append에도 유지')
  assert(ex!.replacedIncludedExcludedFromTriple === true, '헤더 기준 블록 치환 플래그')
  assert(ex!.meetingCondensed != null && ex!.meetingCondensed.includes('인천'), 'meeting condensed')

  let parsed = {
    originCode: 'TEST-HNT-E2E',
    title: 'E2E',
    includedText: null,
    excludedText: null,
    priceTableRawText: null,
    mandatoryLocalFee: null,
    mandatoryCurrency: null,
    mustKnowItems: null,
    mustKnowRaw: null,
    meetingNoticeRaw: null,
    meetingInfoRaw: null,
  } as unknown as RegisterParsed

  parsed = applyHanatourBasicInfoBodyExtract(parsed, SAMPLE_NORMALIZED_BODY)
  assert((parsed.includedText ?? '').includes('왕복'), 'apply included')
  assert((parsed.excludedText ?? '').includes('JPY'), 'apply excluded keeps narrative')
  parsed = finalizeHanatourRegisterParsedPricing(parsed)
  const exAfter = parsed.excludedText ?? ''
  assert(exAfter.includes('현지합류'), 'finalize 후에도 불포함에 선택경비 병합된 현지합류 유지')
  assert((parsed.priceTableRawText ?? '').includes('현지합류') || (parsed.priceTableRawText ?? '').length > 0, 'price table should hold local join or price text')

  console.log('verify-hanatour-basic-info-e2e: OK')
  console.log('--- extract summary ---')
  console.log(JSON.stringify({ ...ex, meetingCondensed: ex!.meetingCondensed?.slice(0, 120) }, null, 2))
}

main()
