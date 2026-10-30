import { describe, expect, it } from 'vitest'
import {
  checkDayPhotoPolicy,
  dayCandidateCityMatch,
  dayPhotoCityVerified,
  DAY_PHOTO_DETAIL_MAX_BYTES,
} from '@/lib/register-day-photo-policy'

const ok = { url: 'https://cdn.example/d1-pexels-2.webp', source: 'Pexels', width: 1920, bytes: 300_000 }

describe('register-day-photo-policy', () => {
  it('passes a 1200px+ Pexels photo under the detail byte limit', () => {
    expect(checkDayPhotoPolicy(ok)).toEqual({ ok: true, reasons: [] })
  })
  it('rejects low-res, oversize and unmeasured photos', () => {
    expect(checkDayPhotoPolicy({ ...ok, width: 1000 }).reasons).toContain('low_res')
    expect(checkDayPhotoPolicy({ ...ok, bytes: DAY_PHOTO_DETAIL_MAX_BYTES }).reasons).toContain('over_bytes')
    expect(checkDayPhotoPolicy({ ...ok, bytes: null }).reasons).toEqual(['not_measured'])
  })
  it('rejects new iStock and CC BY', () => {
    expect(checkDayPhotoPolicy({ ...ok, source: 'iStock', url: 'https://cdn.example/new-istock.jpg' }).reasons).toContain('policy:L2-ISTOCK')
    expect(checkDayPhotoPolicy({ ...ok, license: 'CC BY 4.0' }).reasons).toContain('policy:L2-CC-BY')
  })
  it('admin-locked photos only get the byte check', () => {
    expect(checkDayPhotoPolicy({ ...ok, manual: true, width: 900, source: 'manual' }).ok).toBe(true)
  })
  it('candidate city match uses photo description / page slug', () => {
    expect(dayCandidateCityMatch({ pageUrl: 'https://www.pexels.com/photo/dragon-bridge-in-da-nang-123/' }, ['다낭'])).toBe('meta')
    expect(dayCandidateCityMatch({ pageUrl: 'https://www.pexels.com/photo/eiffel-tower-paris-1/' }, ['다낭'])).toBeNull()
  })
  it('gate city verification', () => {
    expect(dayPhotoCityVerified({ imageKeyword: '바나힐', title: '바나힐 관광' }, { destination: '다낭' })).toBe(true)
    expect(dayPhotoCityVerified({ imageKeyword: 'x', imageSource: { cityMatch: 'pool' } }, { destination: '다낭' })).toBe(true)
    expect(dayPhotoCityVerified({ imageKeyword: 'Eiffel Tower' }, { destination: '다낭' })).toBe(false)
  })
})
