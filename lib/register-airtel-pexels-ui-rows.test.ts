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
        title: '나트랑 예시',
        summary: '매력적인 해변 도시입니다. 아래는 참고용 예시 일정이며 순서는 자유롭게 조정하세요.',
        persona: 'mixed',
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
    expect(rows!.map((r) => r.title)).toEqual(expect.arrayContaining(['롱선사', '포나가르']))
  })

  it('keeps Fit title and boosts weak keyword from that day routeText only', () => {
    const parsed = {
      destination: '나트랑',
      schedule: [
        {
          day: 2,
          title: '자유',
          description: '공급사 본문',
          routeText: '나트랑 - 롱선사 - 빈원더스',
          imageKeyword: 'Nha',
          imageKeyword2: null,
        },
      ],
      registerFitItineraryGeminiJson: JSON.stringify({
        title: 't',
        summary: 's',
        persona: 'mixed',
        days: [
          {
            dayNumber: 2,
            title: '롱선사 산책',
            summary: '오후엔 롱선사를 둘러보세요. 이동 전에 대기 시간을 넉넉히 잡으시면 편해요.',
            activities: [
              { order: 1, category: 'transport', title: 'x', description: '', location: '나트랑' },
            ],
          },
        ],
      }),
    } as RegisterParsed

    const rows = buildAirtelRegisterPexelsUiScheduleRows(parsed, '나트랑')
    expect(rows?.[0]?.title).toBe('롱선사 산책')
    expect(rows?.[0]?.description).toContain('롱선사')
    expect(rows?.[0]?.imageKeyword).not.toBe('Nha')
    expect(rows?.[0]?.imageKeyword).toMatch(/long son|vinwonder/i)
  })
})
