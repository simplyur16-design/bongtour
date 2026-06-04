import { describe, expect, it } from 'vitest'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'

describe('applyAirtelRouteTextImageKeywordsToSchedule', () => {
  it('replaces weak Nha with routeText landmarks', () => {
    const out = applyAirtelRouteTextImageKeywordsToSchedule([
      {
        routeText: '나트랑 - 롱선사 - 빈원더스',
        imageKeyword: 'Nha',
        imageKeyword2: null,
      },
    ])
    expect(out[0]?.imageKeyword?.toLowerCase()).not.toBe('nha')
    expect(out[0]?.imageKeyword).toMatch(/long son|vinwonder/i)
  })

  it('uses Po Nagar from route instead of Nha', () => {
    const out = applyAirtelRouteTextImageKeywordsToSchedule([
      {
        routeText: '나트랑 - 포나가르 참 탑 - 머드 온천',
        imageKeyword: 'Nha',
        imageKeyword2: null,
      },
    ])
    expect(out[0]?.imageKeyword).toMatch(/po nagar/i)
  })
})
