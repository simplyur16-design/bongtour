import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseLottetourEvtListAjaxHtml } from '@/lib/lottetour-departures'

const FIXTURE = path.join(
  process.cwd(),
  'scripts/fixtures/lottetour-evtListAjax-turkey-checkbox-sample.html'
)

describe('parseLottetourEvtListAjaxHtml — checkbox column + class=price', () => {
  it('parses adultPrice and seatCount from live-style Turkey row', () => {
    const html = fs.readFileSync(FIXTURE, 'utf8')
    const { rows } = parseLottetourEvtListAjaxHtml(html, { depYm: '202606', godId: '60232' })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.evtCd).toBe('E04A260626KE002')
    expect(rows[0]!.departDate).toBe('2026-06-26')
    expect(rows[0]!.adultPrice).toBe(1_699_000)
    expect(rows[0]!.seatCount).toBe(4)
    expect(rows[0]!.statusRaw).toBe('출발확정')
  })

  it('parses 남은좌석 from status cell', () => {
    const { rows } = parseLottetourEvtListAjaxHtml(
      `<table><tbody><tr><td><input type="checkbox"/></td><td><a href="/evtDetail/826/858/3604/5603?evtCd=C11A260703KE006">07/03</a> (금) 10:20</td><td>KE</td><td></td><td>title</td><td>3박4일</td><td><strong class="price">899,000원</strong></td><td>출발확정 예약 14명 / 총 14석 남은좌석 0석</td></tr></tbody></table>`,
      { depYm: '202607', godId: '66176' },
    )
    expect(rows[0]?.seatCount).toBe(0)
    expect(rows[0]?.seatsStatusRaw).toMatch(/남은좌석/)
  })
})
