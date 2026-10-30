import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/register-pre-photo-verify', () => ({
  verifyRegisterPrePhotoForStoredProduct: (p: { title?: string | null }) =>
    p.title === 'BAD' ? { ok: false, issues: ['day2_middle_keyword_empty'] } : { ok: true, issues: [] },
}))

import {
  evaluateAutoRegisterGate,
  coverCityMatchesProduct,
  AUTO_REGISTER_CARD_MAX_BYTES,
  AUTO_REGISTER_DETAIL_MAX_BYTES,
  type AutoRegisterGateInput,
} from '@/lib/register-auto-register-gate'
import { autoRegisterSwitches } from '@/lib/register-auto-photo-register-job'

const cover = 'https://cdn.example/a-pexels-1.webp'
const d1 = 'https://cdn.example/d1-pexels-2.webp'
const d2 = 'https://cdn.example/d2-pexels-3.webp'
const sched = JSON.stringify([
  { day: 1, imageUrl: d1, imageKeyword: '미케비치', imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/1' } },
  { day: 2, imageUrl: d2, imageKeyword: '바나힐', imageSource: { source: 'Pexels', photographer: 'B', originalLink: 'https://www.pexels.com/photo/2' } },
])
const ok = (bytes: number, width = 1920) => ({ bytes, width })

function base(over: Partial<AutoRegisterGateInput> = {}): AutoRegisterGateInput {
  return {
    registrationStatus: 'pending',
    listingKind: null,
    productType: null,
    sportsThemeTag: null,
    schedule: sched,
    destination: '다낭',
    title: '다낭 4일',
    countryKey: 'VN',
    bgImageUrl: cover,
    bgImageSource: 'pexels',
    bgImageIsGenerated: false,
    bgImageCityName: 'Da Nang',
    departureCount: 3,
    itineraryDayCount: 4,
    hasBookablePrice: true,
    probes: {
      [cover]: { url: cover, ...ok(150_000) },
      [d1]: { url: d1, ...ok(300_000) },
      [d2]: { url: d2, ...ok(300_000) },
    },
    ...over,
  }
}

describe('register-auto-register-gate', () => {
  it('passes when every admin gate and photo check passes', () => {
    const r = evaluateAutoRegisterGate(base())
    expect(r.reasons).toEqual([])
    expect(r.ok).toBe(true)
  })
  it('keeps the admin PATCH gates: departures, itinerary, price presence, country, verify', () => {
    const r = evaluateAutoRegisterGate(
      base({ departureCount: 0, itineraryDayCount: 0, hasBookablePrice: false, countryKey: null, title: 'BAD' }),
    )
    expect(r.ok).toBe(false)
    expect(r.reasons).toEqual(
      expect.arrayContaining(['no_departures', 'no_itinerary_days', 'no_bookable_price', 'no_country', 'verify_failed']),
    )
  })
  it('no photo = 사진 필요, never registered', () => {
    const r = evaluateAutoRegisterGate(base({ bgImageUrl: null }))
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('photo_needed')
  })
  it('byte limits: cover < 200,000 B (card), day < 400,000 B (detail)', () => {
    expect(AUTO_REGISTER_CARD_MAX_BYTES).toBe(200_000)
    expect(AUTO_REGISTER_DETAIL_MAX_BYTES).toBe(400_000)
    const r = evaluateAutoRegisterGate(
      base({
        probes: {
          [cover]: { url: cover, ...ok(200_000) },
          [d1]: { url: d1, ...ok(400_000) },
          [d2]: { url: d2, ...ok(1000) },
        },
      }),
    )
    expect(r.reasons).toEqual(expect.arrayContaining(['cover_over_card_bytes', 'day_photo_over_detail_bytes']))
  })
  it('unmeasured photos are held, not passed', () => {
    const r = evaluateAutoRegisterGate(base({ probes: {} }))
    expect(r.reasons).toEqual(expect.arrayContaining(['cover_not_measured', 'day_photo_not_measured']))
  })
  it('under 1200px, new iStock, CC BY and unlabeled AI are held', () => {
    const r1 = evaluateAutoRegisterGate(
      base({ probes: { [cover]: { url: cover, ...ok(100_000, 1000) }, [d1]: { url: d1, ...ok(1, 800) }, [d2]: { url: d2, ...ok(1) } } }),
    )
    expect(r1.reasons).toEqual(expect.arrayContaining(['cover_policy_failed', 'day_photo_low_res']))
    const r2 = evaluateAutoRegisterGate(base({ bgImageUrl: 'https://cdn.example/new-istock-9.jpg', bgImageSource: 'istock' }))
    expect(r2.reasons).toContain('cover_policy_failed')
    const r3 = evaluateAutoRegisterGate(base({ bgImageSource: 'gemini_auto', bgImageIsGenerated: false }))
    expect(r3.reasons).toContain('cover_policy_failed')
  })
  it('cover and day photos must differ', () => {
    const s = JSON.stringify([{ day: 1, imageUrl: cover, imageSource: { source: 'Pexels' } }])
    const r = evaluateAutoRegisterGate(base({ schedule: s }))
    expect(r.reasons).toContain('cover_day_duplicate')
  })
  it('cover city must match the product (Korean destination mapped to English too)', () => {
    expect(coverCityMatchesProduct(base())).toBe(true)
    expect(coverCityMatchesProduct(base({ bgImageCityName: 'Paris' }))).toBe(false)
    expect(coverCityMatchesProduct(base({ bgImageCityName: null }))).toBe(false)
    expect(evaluateAutoRegisterGate(base({ bgImageCityName: 'Paris' })).reasons).toContain('cover_city_unverified')
  })
  it('only pending products are in scope', () => {
    expect(evaluateAutoRegisterGate(base({ registrationStatus: 'registered' })).reasons).toContain('status_out_of_scope')
    expect(evaluateAutoRegisterGate(base({ registrationStatus: 'pre_photo_blocked' })).reasons).toContain('status_out_of_scope')
  })
  it('all switches are off by default', () => {
    expect(autoRegisterSwitches({})).toEqual({ fill: false, flip: false, record: false })
    expect(autoRegisterSwitches({ BONGTOUR_AUTO_REGISTER_FLIP: '1' })).toEqual({ fill: false, flip: true, record: true })
    expect(autoRegisterSwitches({ BONGTOUR_AUTO_PHOTO_FILL: 'true' }).fill).toBe(false)
  })
})
