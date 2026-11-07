import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseNaeiltourProgramProcessListHtml } from '@/lib/naeiltour-departures'

describe('naeiltour program_process saved fixture', () => {
  it('keeps an on-sale future row and drops a closed past row', () => {
    const html = readFileSync(
      path.join(process.cwd(), 'tests/fixtures/naeiltour-program-process/keep-has-future-202611.html'),
      'utf8',
    )
    const rows = parseNaeiltourProgramProcessListHtml(html, '202611')
    expect(rows).toEqual([
      expect.objectContaining({
        departDate: '2026-11-09',
        adultPrice: 1_290_000,
        eventSeq: '40110001',
        statusRaw: '예약가능',
        carrierName: '대한항공',
      }),
    ])
    expect(rows.some((r) => r.departDate === '2026-11-02')).toBe(false)
  })
})
