/**
 * 하나투어 쇼핑 5열 TSV(무헤더) 파서 검증.
 * 실행: npx tsx scripts/verify-hanatour-tab-shopping-five-col.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import {
  parseHanatourTabShoppingFiveColumnLines,
  HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX,
} from '../lib/register-hanatour-shopping'

const SAMPLE = `퀸스타운\tDear World\tLEVEL 2, MEDICAL CENTRE BLDG. QUEENSTOWN 퀸스타운 리마커블 쇼핑센터내\t건강보조식품(녹혈, 초유, 마누카꿀, 프로폴리스등)\t약 00시간 45분
오클랜드\t2MORO\tUNIT 8, RICHARD PEARSE DR. AIRPORT OAKS AUCKLAND 오클랜드 공항근처 수디마 호텔옆\t잡화(건강보조식품, 화장품, 꿀, 와인 등)\t약 00시간 30분`

function main() {
  const rows = parseHanatourTabShoppingFiveColumnLines(SAMPLE)
  assert.ok(rows && rows.length === 2, `row count ${rows?.length}`)
  assert.equal(rows![0]!.city, '퀸스타운')
  assert.equal(rows![0]!.shopName, 'Dear World')
  assert.ok(rows![0]!.shopLocation?.includes('QUEENSTOWN'))
  assert.ok(rows![0]!.itemsText?.includes('건강보조식품'))
  assert.ok(rows![0]!.durationText?.includes('45분'))
  const bad = parseHanatourTabShoppingFiveColumnLines('A\tB\tC\nX')
  assert.ok(bad && bad.length === 2)
  assert.ok(bad![1]!.noteText?.startsWith(HANATOUR_TAB_ROW_PARSE_ISSUE_PREFIX))
  console.log('OK: verify-hanatour-tab-shopping-five-col')
}

main()
