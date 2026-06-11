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
})
