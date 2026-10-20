/**
 * REGRESSION-FREEZE[pexels-kurayoshi-not-generic-white-wall]
 */
import { describe, expect, it } from 'vitest'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'

describe('pexels-kurayoshi-not-generic-white-wall', () => {
  it('maps 쿠라요시 to Shirakabe Tottori Japan not white-walled storehouses', () => {
    const en = firstMatchingScheduleSpotEn('쿠라요시 백벽 거리')
    expect(en).toMatch(/Kurayoshi Shirakabe Tottori Japan/i)
    expect(en).not.toMatch(/white-walled storehouses/i)
  })

  it('canonicalizes legacy white-walled storehouses keyword', () => {
    expect(normalizeToPlaceName('Kurayoshi White-walled Storehouses')).toBe(
      'Kurayoshi Shirakabe Tottori Japan',
    )
    expect(isBlockedScheduleImageKeyword('Kurayoshi white-walled storehouses')).toBe(true)
    expect(isBlockedScheduleImageKeyword('Kurayoshi Shirakabe Tottori Japan')).toBe(false)
  })
})
