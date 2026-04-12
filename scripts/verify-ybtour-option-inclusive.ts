/**
 * 노랑풍선 옵션·포함불포함 파서 스모크 (로컬: npx tsx scripts/verify-ybtour-option-inclusive.ts)
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { parseYbtourOptionalTourPasteSection } from '@/lib/register-ybtour-options'
import { parseYbtourIncludedExcludedSection } from '@/lib/register-ybtour-basic'
import { clipYbtourIncExcInputForParse } from '@/lib/detail-body-parser-ybtour'
import { parseOptionalToursForUi } from '@/lib/optional-tours-ui-model'

const optPaste = `베니스 - 수상택시
비용60유로
더보기

- 수상택시를 탑승하여, S자운하 관광 후 터미널로 이동하는 옵션입니다.

비용
60유로
소요시간
약 45분
참고사항
- 미참여자는 베니스 들어갈 때 탑승했던 페리편으로 돌아오게됩니다.
(인솔자 동행)

파리 - 몽마르뜨 언덕
비용40유로
더보기

비용
40유로
소요시간
약 1시간
참고사항
- 미참여자분들은 주변 자유 관광 시간을 드립니다.
(인솔자/가이드 미동행)`

const incBlob = `포함사항
· 교통 : 왕복항공권 (이코노미), 전용차량비용 (45인승버스)

· 숙박시설 : 1급호텔(3~4성급) 이용 (2인 1실 기준)

불포함사항
· 가이드/기사 경비 : 100유로 (1인기준) 현지 지불해야 합니다.

약관 / 취소수수료
■ 약관
상기 상품은 국외여행표준약관
■ 예약금 규정
① 여행 확정 후`

const clipped = clipYbtourIncExcInputForParse(incBlob)
const ie = parseYbtourIncludedExcludedSection(clipped)

const opt = parseYbtourOptionalTourPasteSection(optPaste)
assert.equal(opt.rows.length, 2, `expected 2 option rows, got ${opt.rows.length}`)
assert.equal(opt.rows[0]!.tourName, '베니스 - 수상택시')
assert.match(opt.rows[0]!.priceText ?? '', /60유로/)
assert.ok((opt.rows[0]!.durationText ?? '').includes('45분'))
assert.ok((opt.rows[0]!.descriptionText ?? '').includes('페리편'))
assert.equal(opt.rows[1]!.tourName, '파리 - 몽마르뜨 언덕')

assert.ok(!clipped.includes('■ 약관'), 'clip should drop terms')
assert.ok(!ie.excludedItems.some((x) => x.includes('국외여행표준')), 'terms not in excluded')
assert.ok(ie.includedItems.some((x) => x.includes('교통')), 'included has 교통')
assert.ok(ie.excludedItems.some((x) => x.includes('가이드/기사 경비')), 'excluded has 가이드')

const ui = parseOptionalToursForUi(JSON.stringify(opt.rows))
assert.ok(ui[0]!.descriptionBody?.includes('페리편'), 'UI row has 참고 in descriptionBody')

const six = `A
비용60유로
소요시간
약 45분
참고사항
note a
B
비용40유로
소요시간
약 1시간
참고사항
note b
C
비용110유로
소요시간
약 2시간
참고사항
note c
D
비용130유로
소요시간
약 4시간
참고사항
note d
E
비용60유로
소요시간
약 30분
참고사항
note e
F
비용70유로
소요시간
약 3시간
참고사항
note f`
const opt6 = parseYbtourOptionalTourPasteSection(six)
assert.equal(opt6.rows.length, 6, 'six euro anchors')

console.log('verify-ybtour-option-inclusive: ok', { options: opt.rows.length, inc: ie.includedItems.length, exc: ie.excludedItems.length, six: opt6.rows.length })
