import { describe, expect, it } from 'vitest'
import { normalizeOverseasHubSeasonHeroSlides } from '@/lib/overseas-hub-season-destination-hero-shared'

describe('normalizeOverseasHubSeasonHeroSlides', () => {
  it('keeps valid slides and drops broken rows', () => {
    const out = normalizeOverseasHubSeasonHeroSlides([
      {
        id: 'overseas-hub-season-qingdao-m9-x',
        cityKey: 'qingdao',
        countryKey: 'china',
        countryKoreanLabel: '중국',
        imageUrl: 'https://example.com/q.jpg',
        headline: '9월 칭다오로 떠나다',
        subline: '선선한 해안',
        href: '/travel/overseas?destination=qingdao',
        targetMonth1To12: 9,
      },
      { id: '', cityKey: 'sydney', headline: 'x' },
      { id: 'bad', cityKey: 'paris' },
      null,
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.cityKey).toBe('qingdao')
    expect(out[0]?.targetMonth1To12).toBe(9)
  })

  it('fills href from cityKey when missing', () => {
    const out = normalizeOverseasHubSeasonHeroSlides([
      {
        id: 'a',
        cityKey: 'sydney',
        headline: '시드니',
        imageUrl: null,
        href: '',
        targetMonth1To12: 10,
      },
    ])
    expect(out[0]?.href).toContain('destination=sydney')
  })
})
