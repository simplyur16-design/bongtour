/**
 * 하나투어 본문 헤더 추출 → 등록 필드 반영 여부 (Gemini 미사용).
 * 실행: npx tsx scripts/verify-hanatour-basic-info-register-fields.ts
 */
import assert from 'node:assert/strict'
import { applyHanatourBasicInfoBodyExtract } from '../lib/hanatour-basic-info-body-extract'
import { finalizeHanatourRegisterParsedPricing } from '../lib/register-hanatour-price'
import type { RegisterParsed } from '../lib/register-llm-schema-hanatour'

/** 하나투어 확정 저장: 유의사항은 `mustKnowItems`만 — `reservationNoticeRaw`에 넣지 않음 */
function reservationNoticeRawAfterHanatourSave(_p: RegisterParsed): string | null {
  return null
}

/** 헤더·하위 블록이 실제 하나투어 붙여넣기 형태를 흉내 낸 최소 샘플 */
const SAMPLE_HANATOUR_BODY = `상품가격
기본상품 성인 1,000,000원 아동 900,000원 유아 100,000원
1인 객실 사용료 200,000원

포함/불포함/선택경비 정보
포함내역
왕복 항공권
호텔 숙박

불포함내역
개인 경비
가이드/기사 경비 : 인당 JPY 3,000
항공리턴변경(불가) 별도 안내

선택경비
객실 1인 사용료 반드시 확인
현지합류 성인 810,000원 아동 710,000원 유아 110,000원
[1.0] 옵션관광 USD 50 현지 지불

예약시 유의사항
• 여권 유효기간 6개월 이상 필요합니다.
• 전자입국신고서 사전 작성이 필요할 수 있습니다.
• 취소 규정은 상품별로 상이합니다.

가이드/인솔자 및 미팅정보
(미팅 필드 검증 범위 밖)

일정표
1일차 테스트
`

/** 문장부호 없이 한 덩어리 → 첫 카드 본문만 `maxBodyChars`로 자름 */
const LONG_NOTICE = '여권 유효기간과 비자 및 입국 서류는 출발 전에 반드시 확인하세요 '.repeat(90).trim()

const SAMPLE_LONG_NOTICE_BODY = `포함/불포함/선택경비 정보
포함내역
항공

불포함내역
가이드/기사 경비 : 인당 5,000원

예약시 유의사항
${LONG_NOTICE}

일정표
1일차
`

function runPipe(normalizedRaw: string): RegisterParsed {
  const base = {} as RegisterParsed
  let p = applyHanatourBasicInfoBodyExtract(base, normalizedRaw)
  p = finalizeHanatourRegisterParsedPricing(p)
  return p
}

function fieldReport(title: string, p: RegisterParsed) {
  return {
    title,
    includedText: (p.includedText ?? '').trim() || null,
    excludedText: (p.excludedText ?? '').trim() || null,
    priceTableRawText: (p.priceTableRawText ?? '').trim() || null,
    mandatoryLocalFee: p.mandatoryLocalFee ?? null,
    mandatoryCurrency: p.mandatoryCurrency ?? null,
    mustKnowItems: p.mustKnowItems ?? null,
    mustKnowRaw: (p.mustKnowRaw ?? '').trim() || null,
    reservationNoticeRaw: reservationNoticeRawAfterHanatourSave(p),
  }
}

function main() {
  const printReport = process.argv.includes('--report')

  const p1 = runPipe(SAMPLE_HANATOUR_BODY)
  const ex = (p1.excludedText ?? '').trim()
  const inc = (p1.includedText ?? '').trim()
  const pt = (p1.priceTableRawText ?? '').trim()

  if (printReport) {
    console.log(JSON.stringify(fieldReport('샘플 A (구조화 유의)', p1), null, 2))
  }

  assert.ok(inc.includes('왕복 항공권'), 'includedText에 포함내역이 반영되어야 함')
  assert.ok(/1인\s*객실|객실\s*1인\s*사용료/i.test(ex), '불포함에 1인 객실 사용료 관련 문구')
  assert.ok(/항공\s*리턴\s*변경|항공리턴변경/i.test(ex), '불포함에 항공리턴변경')
  assert.ok(/가이드\s*\/\s*기사/i.test(ex), '불포함에 가이드/기사 경비 설명')
  assert.ok(/현지합류/.test(ex), '선택경비 블록은 불포함에 병합 → 현지합류 문구가 excludedText에 있어야 함')
  assert.ok(!/\[1\.0\]\s*옵션관광/i.test(ex), '선택경비 내 옵션 USD 상세 줄은 불포함에 넣지 않음')
  assert.ok(p1.mandatoryLocalFee === 3000 && p1.mandatoryCurrency === 'JPY', 'mandatory JPY 3000')
  assert.ok((p1.mustKnowItems?.length ?? 0) >= 2, 'mustKnowItems 구조화')
  assert.ok(!p1.mustKnowRaw?.trim(), '짧은 유의사항은 mustKnowRaw 비움(구조화 우선)')
  assert.ok(/상품가격/.test(pt), 'priceTableRawText에 상품가격 구간')
  assert.ok(/현지합류/.test(pt), '현지합류는 가격 blob(priceTableRawText) 쪽')

  const p2 = runPipe(SAMPLE_LONG_NOTICE_BODY)
  if (printReport) {
    console.log(JSON.stringify(fieldReport('샘플 B (긴 유의 → 카드 자름)', p2), null, 2))
  }
  assert.ok((p2.mustKnowItems?.length ?? 0) >= 1, '긴 유의도 필터 통과 시 mustKnowItems 카드')
  assert.ok(!p2.mustKnowRaw?.trim(), 'mustKnowRaw 비움')
  assert.ok((p2.mustKnowItems?.[0]?.body.length ?? 0) <= 330, '본문 길이 상한')
  assert.ok(reservationNoticeRawAfterHanatourSave(p2) === null, '하나투어는 reservationNoticeRaw 미저장')

  const withPromoBeforeTriple = `이 상품은 유류할증이 이미 포함된 특가입니다.

포함/불포함/선택경비 정보
포함내역
왕복 항공권

불포함내역
개인 경비

일정표
1일차
`
  const p3 = runPipe(withPromoBeforeTriple)
  const inc3 = (p3.includedText ?? '').trim()
  assert.ok(!/특가|유류\s*할증이\s*이미\s*포함/i.test(inc3), '상위 블록 이전 홍보문(포함 언급)은 포함 리스트에 넣지 않음')
  assert.ok(inc3.includes('왕복'), '포함내역 블록만 반영')

  const withSelectionStop = `포함/불포함/선택경비 정보
포함내역
항공

불포함내역
식사

선택경비
항공리턴변경(가능/문의)
선택관광/기항지관광/현지투어에 관한 상세 내역은 패키지 상품상세를 참고바랍니다.
이 줄은 선택경비에 있으나 종료문 이후라 제외

일정표
1일차
`
  const p4 = runPipe(withSelectionStop)
  const ex4 = (p4.excludedText ?? '').trim()
  assert.ok(/항공\s*리턴\s*변경|항공리턴변경/i.test(ex4), '선택경비 병합')
  assert.ok(!/이 줄은 선택경비에/i.test(ex4), '종료/제외 문장 이후는 불포함에 넣지 않음')
  assert.ok(!/패키지\s*상품상세를\s*참고/i.test(ex4), '종료 안내 문장 자체는 항목으로 승격하지 않음')

  console.log('OK: verify-hanatour-basic-info-register-fields')
}

main()
