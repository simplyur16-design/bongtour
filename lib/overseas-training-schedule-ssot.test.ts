import { describe, expect, it } from 'vitest'
import {
  parseScheduleDayLabel,
  parseTrainingScheduleFromProduct,
  parseWindsorScheduleDayBody,
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

  it('parses day label date for Windsor header', () => {
    const parsed = parseScheduleDayLabel('7일차 — 02월 05일 (목요일)')
    expect(parsed.dayHeading).toBe('7일차')
    expect(parsed.dateHeading).toContain('02월 05일')
  })

  it('aligns each city on the left with its schedule on the right', () => {
    const layout = parseWindsorScheduleDayBody(
      [
        '헬싱키',
        '코펜하겐',
        '말뫼',
        '코펜하겐',
        '헬싱키 시내 관광 A',
        '코펜하겐 도착 후 방문 B',
        '말뫼 시청 견학 C',
        '코펜하겐 복귀 및 석식 D',
        '특급 호텔(★★★★★)',
        '조:선상식 중:현지식 석:호텔식',
      ].join('\n')
    )
    expect(layout.cityBlocks.map((b) => b.cities[0])).toEqual(['헬싱키', '코펜하겐', '말뫼', '코펜하겐'])
    expect(layout.cityBlocks[0]?.schedule).toContain('헬싱키')
    expect(layout.cityBlocks[0]?.schedule).not.toContain('말뫼')
    expect(layout.cityBlocks[1]?.schedule).toContain('코펜하겐')
    expect(layout.cityBlocks[2]?.schedule).toContain('말뫼')
    expect(layout.cityBlocks[3]?.schedule).toContain('복귀')
    expect(layout.footerHotel).toContain('호텔')
    expect(layout.footerMeals).toContain('조:')
  })
})
