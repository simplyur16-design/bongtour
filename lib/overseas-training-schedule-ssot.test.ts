import { describe, expect, it } from 'vitest'
import {
  parseTrainingScheduleFromProduct,
  scheduleTextToTableRows,
  serializeTrainingScheduleRaw,
} from '@/lib/overseas-training-schedule-ssot'

describe('overseas-training-schedule-ssot', () => {
  it('parses raw mode JSON', () => {
    const json = serializeTrainingScheduleRaw('1일차\n런던\n\n2일차\n파리')
    const parsed = parseTrainingScheduleFromProduct(json)
    expect(parsed.mode).toBe('raw')
    if (parsed.mode !== 'raw') return
    const rows = scheduleTextToTableRows(parsed.text)
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('splits day headers into table rows', () => {
    const rows = scheduleTextToTableRows('3일차 — 브뤼셀\n관광\n\n4일차\n암스테르담')
    expect(rows[0]?.dayLabel).toMatch(/3일차/)
    expect(rows[1]?.dayLabel).toMatch(/4일차/)
  })
})
