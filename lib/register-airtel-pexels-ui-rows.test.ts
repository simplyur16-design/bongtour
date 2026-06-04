import { describe, expect, it } from 'vitest'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { buildAirtelRegisterPexelsUiScheduleRows } from '@/lib/register-airtel-pexels-ui-rows'

describe('buildAirtelRegisterPexelsUiScheduleRows', () => {
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
