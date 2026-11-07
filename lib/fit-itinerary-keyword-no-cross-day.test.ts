import { describe, expect, it } from 'vitest'
import { mergeScheduleWithFitKeywords } from '@/lib/fit-itinerary-merge-schedule-keywords'
import { pickFitDayImageKeywordDistinct } from '@/lib/fit-itinerary-pick-day-image-keyword'

const ctx = {
  cityNameKo: '밀라노',
  cityKey: 'it',
  productTitle: '이탈리아 9일',
  primaryDestination: '밀라노',
  destination: '밀라노',
}

describe('FIT keyword does not borrow another day or the product city', () => {
  it('leaves a day with no suitable place empty', () => {
    const kw = pickFitDayImageKeywordDistinct(
      {
        dayNumber: 2,
        title: '인천 도착',
        summary: '인천 국제공항에 도착해요.',
        activities: [{ order: 1, category: 'transport', title: '도착', description: '', location: '인천 국제공항' }],
      },
      ctx,
      new Set(),
    )
    expect(kw).toBe('')
    const { rows } = mergeScheduleWithFitKeywords(
      [],
      [
        {
          dayNumber: 1,
          title: '두오모',
          summary: '밀라노 두오모를 봐요.',
          activities: [{ order: 1, category: 'attraction', title: '두오모', description: '', location: '밀라노 두오모 (Duomo di Milano)' }],
        },
        {
          dayNumber: 2,
          title: '인천 도착',
          summary: '인천 국제공항에 도착해요.',
          activities: [{ order: 1, category: 'transport', title: '도착', description: '', location: '인천 국제공항' }],
        },
      ],
      ctx,
    )
    expect(rows[1]!.imageKeyword).toBe('')
    expect(rows[1]!.imageKeyword).not.toMatch(/duomo|como|milano/i)
  })

  it('clears a stale imageKeyword2 and nulls its photo', () => {
    const { rows } = mergeScheduleWithFitKeywords(
      [
        {
          day: 2,
          title: '마사이마라',
          description: '사바나를 봐요.',
          routeText: '마사이마라',
          imageKeyword: 'Masai Mara',
          imageKeyword2: 'Serengeti Savanna Wildlife',
          imageUrl: 'https://cdn.example/mara.jpg',
          imageUrl2: 'https://cdn.example/serengeti.jpg',
        },
      ],
      [
        {
          dayNumber: 2,
          title: '마사이마라',
          summary: '마사이마라를 걸어요.',
          activities: [{ order: 1, category: 'attraction', title: '마사이마라', description: '', location: '마사이마라 (Masai Mara)' }],
        },
      ],
      { cityNameKo: '나이로비', cityKey: 'nairobi', productTitle: '케냐', primaryDestination: '케냐', destination: '케냐' },
    )
    expect(rows[0]!.imageKeyword).toMatch(/masai mara/i)
    expect(rows[0]!.imageKeyword2 ?? null).toBeNull()
    expect(rows[0]!.imageUrl2).toBeNull()
    expect(rows[0]!.imageUrl).toBe('https://cdn.example/mara.jpg')
  })
})
