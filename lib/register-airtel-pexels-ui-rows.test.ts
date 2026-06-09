import { describe, expect, it } from 'vitest'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { buildAirtelRegisterPexelsUiScheduleRows } from '@/lib/register-airtel-pexels-ui-rows'

describe('buildAirtelRegisterPexelsUiScheduleRows', () => {
  it('prefers Fit distinct landmarks over uniform routeText Nha rows', () => {
    const parsed = {
      destination: '나트랑',
      schedule: [
        {
          day: 2,
          title: '자유',
          description: '',
          routeText: '나트랑 - 롱선사 - 빈원더스',
          imageKeyword: 'Nha',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '자유',
          description: '',
          routeText: '나트랑 - 포나가르 참 탑',
          imageKeyword: 'Nha',
          imageKeyword2: null,
        },
      ],
      registerFitItineraryGeminiJson: JSON.stringify({
        days: [
          {
            dayNumber: 2,
            title: '롱선사',
            summary: '',
            activities: [
              {
                order: 1,
                category: 'attraction',
                title: '롱선사',
                description: '',
                location: '롱선사 (Long Son Pagoda)',
              },
            ],
          },
          {
            dayNumber: 3,
            title: '포나가르',
            summary: '',
            activities: [
              {
                order: 1,
                category: 'attraction',
                title: '포나가르',
                description: '',
                location: '포나가르 사원 (Po Nagar Cham Towers)',
              },
            ],
          },
        ],
      }),
    } as RegisterParsed

    const rows = buildAirtelRegisterPexelsUiScheduleRows(parsed, '나트랑')
    expect(rows?.length).toBe(2)
    const kws = rows!.map((r) => r.imageKeyword.toLowerCase())
    expect(new Set(kws).size).toBe(2)
    expect(kws.some((k) => /long son|pagoda/.test(k))).toBe(true)
    expect(kws.some((k) => /po nagar|cham/.test(k))).toBe(true)
  })

  it('uses parsed.schedule routeText before Fit Nha keywords', () => {
    const parsed = {
      destination: '나트랑',
      schedule: [
        {
          day: 2,
          title: '자유',
          description: '',
          routeText: '나트랑 - 롱선사 - 빈원더스',
          imageKeyword: 'Nha',
          imageKeyword2: null,
        },
      ],
      registerFitItineraryGeminiJson: JSON.stringify({
        days: [
          {
            dayNumber: 2,
            title: 't',
            summary: 's',
            activities: [
              { order: 1, category: 'transport', title: 'x', description: '', location: '나트랑' },
            ],
          },
        ],
      }),
    } as RegisterParsed

    const rows = buildAirtelRegisterPexelsUiScheduleRows(parsed, '나트랑')
    expect(rows?.[0]?.imageKeyword).not.toBe('Nha')
    expect(rows?.[0]?.imageKeyword).toMatch(/long son|vinwonder/i)
  })
})
