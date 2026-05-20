import { describe, expect, it } from 'vitest'
import { parseTrainingRegistrationPaste } from '@/lib/overseas-training-registration-paste'

describe('parseTrainingRegistrationPaste', () => {
  it('parses category, title, weekday, airline', () => {
    const r = parseTrainingRegistrationPaste(`
복지.행정.경제.노사 정책연수

[복지연수-노인.장애인] 독일, 스위스, 오스트리아 연수 8일(대한항공)
여행기간
2026-05-21 (목요일)  11:05  KE 945  한국 출발
이용항공
대한항공
`)
    expect(r.trainingCategory).toBe('policy')
    expect(r.title).toContain('복지연수')
    expect(r.fixedDepartureWeekday).toBe(4)
    expect(r.durationDays).toBe(8)
    expect(r.airline).toBe('대한항공')
    expect(r.imagePromptDraft).toContain('Photorealistic')
  })
})
