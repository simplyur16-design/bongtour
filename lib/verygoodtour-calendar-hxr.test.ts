import { describe, expect, it } from 'vitest'

import {
  parseVerygoodCalendarLeftCells,
  parseVerygoodCalendarRightRows,
  parseVerygoodModalDomHtml,
  parseVerygoodProCodeMasterCode,
} from '@/lib/verygoodtour-calendar-hxr'

describe('parseVerygoodProCodeMasterCode', () => {
  it('splits master prefix', () => {
    expect(parseVerygoodProCodeMasterCode('IPP105-2606243N5D')).toBe('IPP105')
  })
})

describe('parseVerygoodCalendarLeftCells', () => {
  it('parses jq_cl_day cells with approx man-won', () => {
    const html = `
      <div class="dep_left_wrap">
        <span class="date_txt">2026.06</span>
        <table><tr>
          <td class="jq_cl_day">21 95 만원~</td>
          <td class="jq_cl_day">22</td>
        </tr></table>
      </div>`
    const cells = parseVerygoodCalendarLeftCells(html, { y: '2026', mo: '06' })
    expect(cells).toHaveLength(2)
    expect(cells[0]).toMatchObject({ date: '2026-06-21', approxPrice: 950_000 })
    expect(cells[1]).toMatchObject({ date: '2026-06-22', approxPrice: 0 })
  })
})

describe('parseVerygoodCalendarRightRows', () => {
  it('parses priced li.jq_cl_detailViewBtn rows', () => {
    const html = `
      <div class="dep_right_wrap">
        <ul>
          <li class="jq_cl_detailViewBtn">
            <span class="price_wrap fs18 mr0">889,000원</span>
            2026.06.24 (화) 889,000원 대한항공 ProCode=IPP105-2606243N5D 12석
          </li>
        </ul>
      </div>`
    const rows = parseVerygoodCalendarRightRows(html, { y: '2026', mo: '06' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.date).toBe('2026-06-24')
    expect(rows[0]?.adultPrice).toBe(889_000)
    expect(rows[0]?.proCode).toBe('IPP105-2606243N5D')
    expect(rows[0]?.carrierText).toBe('대한항공')
  })
})

describe('parseVerygoodModalDomHtml', () => {
  it('returns warnings when right empty', () => {
    const r = parseVerygoodModalDomHtml('<div class="dep_left_wrap"><span class="date_txt">2026.06</span></div>')
    expect(r.warnings).toContain('right_rows_empty')
  })
})
