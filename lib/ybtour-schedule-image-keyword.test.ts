import { describe, expect, it } from 'vitest'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'

describe('applyYbtourScheduleImageKeywordsToRows', () => {
  it('drops noisy kw1 like "all include" and infers a place keyword', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카 자유일정',
          description: '다자이후 텐만구 관광 후 자유시간',
          imageKeyword: 'all include',
          imageKeyword2: null,
        },
      ],
      { productDestination: '일본' },
    )

    expect(rows[0]?.imageKeyword).not.toBe('all include')
    expect((rows[0]?.imageKeyword ?? '').toLowerCase()).not.toContain('all include')
    expect((rows[0]?.imageKeyword ?? '').toLowerCase()).not.toContain('all inclusive')
    expect(rows[0]?.imageKeyword ?? '').toBe('')
  })
})
