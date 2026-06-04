import { describe, expect, it } from 'vitest'
import { applyAirtelRouteTextImageKeywordsToSchedule } from '@/lib/register-airtel-route-image-keyword'
import { finalizeRegisterScheduleImageKeywords } from '@/lib/schedule-image-keyword-persist'
import { pickRouteLandmarkImageKeywordsFromRouteText } from '@/lib/ybtour-schedule-image-keyword'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'

describe('airtel routeText → persist pipeline (나트랑 등록 UI)', () => {
  const routes = [
    { day: 2, routeText: '나트랑 - 롱선사 - 빈원더스', imageKeyword: 'Nha' },
    { day: 3, routeText: '나트랑 - 포나가르 참 탑 - 머드 온천', imageKeyword: 'Nha' },
    { day: 4, routeText: '나트랑 - 담시장 - 나트랑 깜란 국제공항', imageKeyword: 'Nha' },
  ] as const

  it('pickRouteLandmark extracts landmarks from Korean routeText', () => {
    const p = pickRouteLandmarkImageKeywordsFromRouteText(routes[0].routeText)
    expect(p.imageKeyword.toLowerCase()).not.toBe('nha')
    expect(p.imageKeyword).toMatch(/long son|vinwonder/i)
  })

  it('splits routeText on en-dash and em-dash (not only ASCII hyphen)', () => {
    const enDash = '나트랑 – 롱선사 – 빈원더스'
    const p = pickRouteLandmarkImageKeywordsFromRouteText(enDash)
    expect(p.imageKeyword).toMatch(/long son|vinwonder/i)
    expect(p.imageKeyword).not.toBe('Nha')
  })

  it('apply + finalize does not collapse landmarks back to Nha', () => {
    for (const row of routes) {
      const applied = applyAirtelRouteTextImageKeywordsToSchedule([{ ...row }])[0]!
      expect(applied.imageKeyword).not.toBe('Nha')
      const finalized = finalizeRegisterScheduleImageKeywords([applied])[0]!
      expect(finalized.imageKeyword).not.toBe('Nha')
      expect(finalized.imageKeyword.length).toBeGreaterThan(2)
    }
  })

  it('finalize preserves Long Son and VinWonders Nha Trang', () => {
    expect(finalizeScheduleImageKeyword('Long Son Pagoda')).toBe('Long Son Pagoda')
    const vin = finalizeScheduleImageKeyword('VinWonders Nha Trang')
    expect(vin).not.toBe('Nha')
    expect(vin.length).toBeGreaterThan(3)
    expect(finalizeScheduleImageKeyword('Po Nagar Cham Towers')).toMatch(/po nagar/i)
  })
})
