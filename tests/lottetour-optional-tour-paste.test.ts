import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLottetourOptionalTourPasteTab } from '../lib/register-lottetour-options'
import { parseLottetourOptionalInput } from '../lib/register-input-parse-lottetour'
import { extractStructuredTourSignals } from '../lib/structured-tour-signals-lottetour'

const TURKEY_OPTIONAL_PASTE = `선택관광명\t1인요금(성인/소아)\t소요시간\t대체일정\t인솔자
카파도키아 지프 투어\t€90\t약 1시간 소요\t근처 자유시간\t
카파도키아 열기구 투어\t€320\t약 1시간 소요\t호텔 투숙 및 휴식\t
안탈리아 올림포스 케이블카\t€90\t약 1시간 소요\t근처 자유시간\t
안탈리아 유람선 투어\t€60\t약 1시간 소요\t호텔 투숙 및 휴식\t
파묵칼레 카트 투어\t€60\t약 1시간 소요\t왕복 도보 이동\t
파묵칼레 열기구 투어\t€260\t약 1시간 소요\t호텔 투숙 및 휴식\t
성 소피아 성당 내부입장\t€60\t약 1시간 소요\t근처 자유시간\t
고고학 시리즈 투어\t€180\t약 4시간 소요\t근처 자유시간\t
돌마바흐체 궁전\t€60\t약 1시간 30분 소요\t근처 자유시간\t
이스탄불 프리미엄 야간 투어\t€80\t약 1시간 30분 소요\t호텔 투숙 및 휴식\t`

describe('lottetour optional tour paste — Turkey TSV', () => {
  it('parses 10-row € table from dedicated paste tab', () => {
    const tab = parseLottetourOptionalTourPasteTab(TURKEY_OPTIONAL_PASTE)
    assert.ok(tab)
    assert.equal(tab!.rows.length, 10)
    assert.equal(tab!.rows[0]!.tourName, '카파도키아 지프 투어')
    assert.equal(tab!.rows[0]!.adultPrice, 90)
    assert.equal(tab!.rows[0]!.currency, 'EUR')
    assert.match(tab!.rows[0]!.durationText ?? '', /1시간/)
    assert.equal(tab!.rows[1]!.adultPrice, 320)
  })

  it('parseLottetourOptionalInput uses TSV paste (not empty euro-block path)', () => {
    const parsed = parseLottetourOptionalInput(TURKEY_OPTIONAL_PASTE)
    assert.equal(parsed.rows.length, 10)
    assert.equal(parsed.reviewNeeded, false)
  })

  it('dedupes repeated optional rows in schedule body haystack', () => {
    const rowsOnly = TURKEY_OPTIONAL_PASTE.split('\n').slice(1).join('\n')
    const body = `${TURKEY_OPTIONAL_PASTE}\n\n3일차\n${rowsOnly}\n\n5일차\n${rowsOnly}\n\n7일차\n${rowsOnly}\n\n쇼핑 정보`
    const sig = extractStructuredTourSignals(body)
    assert.equal(sig.optionalTourSourceCount, 10)
    assert.equal(sig.optionalTourCount, 10)
  })
})
