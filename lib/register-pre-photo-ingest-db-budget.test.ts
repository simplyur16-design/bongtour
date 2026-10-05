import { describe, expect, it } from 'vitest'
import {
  REGISTER_PRE_PHOTO_HEAL_ITINERARY_DAY_CAP,
  REGISTER_PRE_PHOTO_HEAL_ONLY_LIMIT,
  REGISTER_PRE_PHOTO_INGEST_NIGHT_HEAL_LIMIT,
  registerPrePhotoHealOnlyOpts,
  registerPrePhotoIngestNightHealOpts,
} from '@/lib/register-pre-photo-ingest-db-budget'

// REGRESSION-FREEZE[register-pre-photo-ingest-db-budget]: night ingest heal 상한·probe off — manifest
describe('register-pre-photo-ingest-db-budget', () => {
  it('야간 ingest heal 은 probe off + 소량 상한', () => {
    const opts = registerPrePhotoIngestNightHealOpts()
    expect(opts.probeImageUrls).toBe(false)
    expect(opts.healLimit).toBe(REGISTER_PRE_PHOTO_INGEST_NIGHT_HEAL_LIMIT)
    expect(opts.healLimit).toBeLessThanOrEqual(24)
    expect(opts.healLimit).toBeLessThan(200)
  })

  it('heal-only 는 ingest 없이 중간 상한', () => {
    const opts = registerPrePhotoHealOnlyOpts()
    expect(opts.skipIngest).toBe(true)
    expect(opts.healLimit).toBe(REGISTER_PRE_PHOTO_HEAL_ONLY_LIMIT)
    expect(opts.healLimit).toBeLessThanOrEqual(80)
  })

  it('itinerary sync 일 수 상한', () => {
    expect(REGISTER_PRE_PHOTO_HEAL_ITINERARY_DAY_CAP).toBeLessThanOrEqual(12)
  })
})
