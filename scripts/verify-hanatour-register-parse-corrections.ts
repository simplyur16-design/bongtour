/**
 * 하나투어 등록 파서 교정: 예약현황/최소출발, 쇼핑 입력란, 선택관광 row 수.
 * 실행: npx tsx scripts/verify-hanatour-register-parse-corrections.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { extractMinimumDepartureMeta } from '../lib/minimum-departure-extract'
import { parseHanatourShoppingInput } from '../lib/register-input-parse-hanatour'
import { parseHanatourOptionalTourPasteSection } from '../lib/register-hanatour-options'

function main() {
  const bookingLine = '예약현황 예약 : 0명 좌석 : 4석 (최소출발 : 성인15명)'
  const dep = extractMinimumDepartureMeta(bookingLine)
  assert.equal(dep.currentBookedCount, 0, '예약 인원')
  assert.equal(dep.remainingSeatsCount, 4, '잔여 좌석')
  assert.equal(dep.minimumDepartureCount, 15, '최소출발')
  assert.ok(
    !dep.fieldIssues.some((i) => i.field === 'minimumDepartureCount'),
    'minimumDepartureCount 경고 없음'
  )

  const bookingLineSpaced = '예약현황 예약 : 0명 좌석 : 4석 (최소출발 : 성인 15 명)'
  const dep2 = extractMinimumDepartureMeta(bookingLineSpaced)
  assert.equal(dep2.minimumDepartureCount, 15)

  const shopEmpty = parseHanatourShoppingInput('쇼핑 코너 본문에 쇼핑 언급', '')
  assert.equal(shopEmpty.rows.length, 0, '쇼핑 입력란 비면 행 없음')

  const optionalBody = `[하나팩2.0]
스페셜 포함
에즈 열대정원
남부 지중해 열대 식물 정원 관람
소요시간 약 30분 미선택시 가이드동행 미동행

카르카손 콩탈성
유네스코 세계유산 성곽 마을
소요시간 약 45분 미선택시 가이드동행 미동행

※ 하나팩2.0은 합리적 가격의 선택관광을 제공합니다.`

  const opt = parseHanatourOptionalTourPasteSection(optionalBody)
  assert.equal(
    opt.rows.length,
    2,
    `옵션 2개만: 실제 ${opt.rows.length} — ${opt.rows.map((r) => r.tourName).join(' | ')}`
  )
  assert.ok(/에즈/i.test(opt.rows[0]!.tourName))
  assert.ok(/카르카손/i.test(opt.rows[1]!.tourName))
  assert.ok(opt.rows.some((r) => r.supplierTags?.some((t) => /스페셜|하나팩/i.test(t))))
  assert.ok(
    opt.rows.some((r) => r.includedNoExtraCharge === true),
    '스페셜포함 계열은 최소 1행 이상 includedNoExtraCharge'
  )

  console.log('OK: verify-hanatour-register-parse-corrections')
}

main()
