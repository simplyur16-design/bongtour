import { describe, expect, it } from 'vitest'
import { preserveScheduleRouteText } from '@/lib/register-schedule-route-text-preserve'
import { verifyRegisterPrePhotoForStoredProduct } from '@/lib/register-pre-photo-verify'

describe('preserveScheduleRouteText (10/31 첫 배치 verify_failed 48 원인)', () => {
  const prev = [
    { day: 1, routeText: '인천 · 다낭' },
    { day: 2, routeText: '바나힐 · 골든브릿지' },
    { day: 3, routeText: null },
  ]
  it('사진 채움이 다시 만든 일정에 빠진 routeText 를 일차 기준으로 되살린다', () => {
    const next = [{ day: 1, imageUrl: 'a' }, { day: 2, imageUrl: 'b' }, { day: 3, imageUrl: 'c' }] as Array<{ day: number; imageUrl: string; routeText?: string | null }>
    const out = preserveScheduleRouteText(next, prev)
    expect(out.map((r) => r.routeText ?? null)).toEqual(['인천 · 다낭', '바나힐 · 골든브릿지', null])
    expect(out[0]!.imageUrl).toBe('a')
  })
  it('새 일정에 routeText 가 있으면 그대로, 순서가 달라도 day 로 맞춘다', () => {
    const out = preserveScheduleRouteText(
      [{ day: 2, routeText: null }, { day: 1, routeText: '새 동선' }],
      prev,
    )
    expect(out).toEqual([{ day: 2, routeText: '바나힐 · 골든브릿지' }, { day: 1, routeText: '새 동선' }])
  })
  it('routeText 가 지워진 일정은 verify 가 day*_route_empty 로 실패한다(회귀 재현)', () => {
    const base = { listingKind: 'package', productType: 'package', sportsThemeTag: null, destination: '다낭', title: '다낭 5일', countryKey: 'vietnam' }
    const stripped = JSON.stringify([{ day: 1, title: '인천 출발', imageKeyword: 'Da Nang' }, { day: 2, title: '바나힐', imageKeyword: 'Ba Na Hills' }])
    const v = verifyRegisterPrePhotoForStoredProduct({ ...base, schedule: stripped } as never)
    expect(v.ok).toBe(false)
    expect((v.issues ?? []).some((i) => String(i).includes('route_empty'))).toBe(true)
  })
})
