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

  it('assigns different 1st keywords per day (not all Nha Trang)', () => {
    const out = applyAirtelRouteTextImageKeywordsToSchedule([
      { day: 2, routeText: '나트랑 - 롱선사 - 빈원더스', imageKeyword: 'Nha Trang' },
      { day: 3, routeText: '나트랑 - 포나가르 참 탑 - 머드 온천', imageKeyword: 'Nha Trang' },
      { day: 4, routeText: '나트랑 - 담시장 - 나트랑 깜란 국제공항', imageKeyword: 'Nha Trang' },
    ] as Array<{ day: number; routeText: string; imageKeyword: string }>)
    const kws = out.map((r) => String(r.imageKeyword ?? ''))
    expect(new Set(kws.map((k) => k.toLowerCase())).size).toBeGreaterThan(1)
    expect(kws.every((k) => /^nha\s*trang$/i.test(k))).toBe(false)
    expect(kws.some((k) => /long son|vinwonder/i.test(k))).toBe(true)
    expect(kws.some((k) => /po nagar/i.test(k))).toBe(true)
  })
})
