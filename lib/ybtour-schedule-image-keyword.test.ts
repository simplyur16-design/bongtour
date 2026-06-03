import { describe, expect, it } from 'vitest'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'

describe('applyYbtourScheduleImageKeywordsToRows', () => {
  it('routeText 없으면 LLM 키워드도 버리고 빈값', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카 자유일정',
          description: '다자이후 텐만구 관광 후 자유시간',
          routeText: null,
          imageKeyword: 'all include',
          imageKeyword2: null,
        },
      ],
      { productDestination: '일본' },
    )

    expect(rows[0]?.imageKeyword).toBe('')
    expect(rows[0]?.imageKeyword2).toBeNull()
  })

  it('routeText A-B면 앞 두 곳', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '오사카 관광',
          description: '오사카성과 도톤보리',
          routeText: '오사카 - 오사카성 - 도톤보리',
          imageKeyword: 'ignored',
          imageKeyword2: 'ignored',
        },
      ],
      { productDestination: '일본' },
    )

    expect(rows[0]?.imageKeyword).toBe('Osaka')
    expect(rows[0]?.imageKeyword2).toBe('Osaka Castle')
  })
})
