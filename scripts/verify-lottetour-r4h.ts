/**
 * 롯데관광 R-4-H: evtListAjax HTML 파싱·1:N evtCd dedupe(옵션 A)·정규식 검증.
 * 기본은 fixture만 사용(외부 사이트 호출 없음).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  collectLottetourCalendarRange,
  departDateFromLottetourEvtCd,
  LOTTETOUR_EVT_CD_RE,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListAjaxHtml,
} from '../lib/lottetour-departures'

const FIXTURE_DIR = path.join(process.cwd(), 'scripts', 'fixtures')

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8')
}

async function main() {
  const doloHtml = readFixture('lottetour-evtListAjax-dolomiti-sample.html')
  const parsed = parseLottetourEvtListAjaxHtml(doloHtml, { depYm: '202606', godId: '65222' })
  assert.equal(parsed.rows.length, 3, '돌로미티 1일 3 evtCd')
  const codes = parsed.rows.map((r) => r.evtCd).sort()
  assert.deepEqual(codes, ['E01A260624KE005', 'E01A260624KE006', 'E01A260624KE007'])

  const inputs = mapLottetourCalendarToDepartureInputs(parsed.rows, 'test-product')
  const byDate = new Map<string, typeof inputs>()
  for (const x of inputs) {
    const dk = String(x.departureDate).slice(0, 10)
    byDate.set(dk, [...(byDate.get(dk) ?? []), x])
  }
  assert.equal(byDate.size, 1)
  const oneDay = [...byDate.values()][0]!
  assert.equal(oneDay.length, 3)
  oneDay.sort((a, b) =>
    `${a.supplierPriceKey ?? ''}|${a.supplierDepartureCodeCandidate ?? ''}`.localeCompare(
      `${b.supplierPriceKey ?? ''}|${b.supplierDepartureCodeCandidate ?? ''}`
    )
  )
  const winner = oneDay[oneDay.length - 1]!
  assert.equal(winner.supplierDepartureCodeCandidate, 'E01A260624KE007', '옵션 A: 동일 출발일 마지막 evtCd')

  const hcmHtml = readFixture('lottetour-evtListAjax-hochiminh-sample.html')
  const hcm = parseLottetourEvtListAjaxHtml(hcmHtml, { depYm: '202605', godId: '99999' })
  assert.equal(hcm.rows.length, 1)
  assert.equal(hcm.rows[0]!.adultPrice, 1_290_000)
  assert.equal(hcm.rows[0]!.seatCount, null)
  assert.equal(hcm.rows[0]!.statusRaw, '예약가능')

  assert.equal(departDateFromLottetourEvtCd('B28A260513KE003'), '2026-05-13')
  assert.equal(departDateFromLottetourEvtCd('E01A260624KE007'), '2026-06-24')
  assert.ok(LOTTETOUR_EVT_CD_RE.test('B41A200821VJ002'))

  const htmlMap = new Map([['202606', doloHtml]])
  const collected = await collectLottetourCalendarRange(
    { godId: '65222', menuNos: ['826', '854', '1000', '4900'] },
    { monthCount: 1, dateFrom: '2026-06', htmlByDepYm: htmlMap }
  )
  assert.equal(collected.rows.length, 3)

  const prevFb = process.env.LOTTETOUR_E2E_FALLBACK
  process.env.LOTTETOUR_E2E_FALLBACK = '0'
  const emptyHtml = '<html><body><table><tbody></tbody></table></body></html>'
  const emptyMap = new Map([['202606', emptyHtml]])
  const noE2e = await collectLottetourCalendarRange(
    { godId: '65222', menuNos: ['826', '854', '1000', '4900'] },
    {
      monthCount: 1,
      dateFrom: '2026-06',
      htmlByDepYm: emptyMap,
      e2eTourCodeHint: 'E01A260624KE007',
    }
  )
  assert.equal(noE2e.rows.length, 0)
  assert.ok(!noE2e.warnings.some((w) => w.includes('Python E2E')), 'E2E_FALLBACK=0 이면 Python 폴백 미실행')
  if (prevFb === undefined) delete process.env.LOTTETOUR_E2E_FALLBACK
  else process.env.LOTTETOUR_E2E_FALLBACK = prevFb

  console.log('verify-lottetour-r4h: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
