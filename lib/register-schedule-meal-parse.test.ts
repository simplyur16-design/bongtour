import { describe, expect, it } from 'vitest'
import {
  parseScheduleMealFieldsFromText,
  stripMealTypeLabelPrefix,
} from '@/lib/register-schedule-meal-parse'

describe('parseScheduleMealFieldsFromText', () => {
  it('parses compact bracket format without spaces', () => {
    const m = parseScheduleMealFieldsFromText('[조식]없음 [중식]없음 [석식]리조트식')
    expect(m.breakfastText).toBe('없음')
    expect(m.lunchText).toBe('없음')
    expect(m.dinnerText).toBe('리조트식')
  })

  it('parses comma format without dashes', () => {
    const m = parseScheduleMealFieldsFromText('조식 호텔식, 중식 현지식, 석식 한식')
    expect(m.breakfastText).toBe('호텔식')
    expect(m.lunchText).toBe('현지식')
    expect(m.dinnerText).toBe('한식')
  })

  it('parses comma-dash triple', () => {
    const m = parseScheduleMealFieldsFromText('조식 - 호텔식, 중식 - 현지식, 석식 - 현지식')
    expect(m.breakfastText).toBe('호텔식')
    expect(m.lunchText).toBe('현지식')
    expect(m.dinnerText).toBe('현지식')
  })

  it('parses multiline bracket block', () => {
    const m = parseScheduleMealFieldsFromText(`[조식] -
[중식] 기내식
[석식] 현지식`)
    expect(m.breakfastText).toBeUndefined()
    expect(m.lunchText).toBe('기내식')
    expect(m.dinnerText).toBe('현지식')
  })
})

describe('stripMealTypeLabelPrefix', () => {
  it('strips meal label from fact mapper strings', () => {
    expect(stripMealTypeLabelPrefix('석식 현지식')).toBe('현지식')
    expect(stripMealTypeLabelPrefix('조식 - 호텔식')).toBe('호텔식')
  })
})
