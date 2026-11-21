import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE } from '@/lib/register-pre-photo-pending-queue-query'
import {
  autoPhotoFillRequest,
  countNewlyFilledPhotoSlots,
  missingDayFillAction,
  photoFillHttpResult,
  processImagesProductUpdate,
  lodgingKeywordReplacement,
  scheduleHasMissingEligiblePhotoSlot,
  shouldBulkAssignUndistinctPool,
} from '@/lib/register-auto-photo-missing-day'

describe('missing-day photo fill', () => {
  it('replaces a lodging keyword with a place named in that day text', () => {
    const next = lodgingKeywordReplacement(
      {
        imageKeyword: 'Hotel Nikko',
        title: '오사카',
        routeText: '오사카성 - 도톤보리',
        description: '오사카성을 봅니다',
      },
      '오사카',
    )
    expect(next).toBeTruthy()
    expect(String(next)).not.toMatch(/hotel/i)
  })

  it('keeps a day that already has a photo and fills only an empty day with a place keyword', () => {
    const schedule = JSON.stringify([
      { day: 1, title: '도착', routeText: '간사이 국제공항 - 아라시야마', imageKeyword: 'Arashiyama', imageUrl: 'https://cdn.example/hero-day.jpg' },
      { day: 2, title: '교토', routeText: '아라시야마 - 교토', imageKeyword: 'Kiyomizu', imageUrl: '' },
      { day: 3, title: '이동', routeText: '교토', imageKeyword: '', imageUrl: '' },
    ])
    expect(missingDayFillAction({ day: 1, imageKeyword: 'Arashiyama', imageUrl: 'https://cdn.example/hero-day.jpg', routeText: '간사이 - 아라시야마' }, 3)).toBe('keep')
    expect(missingDayFillAction({ day: 2, title: '교토', routeText: '아라시야마 - 교토', imageKeyword: 'Kiyomizu', imageUrl: '' }, 3)).toBe('fill')
    expect(missingDayFillAction({ day: 3, title: '이동', routeText: '교토', imageKeyword: '', imageUrl: '' }, 3)).toBe('skip')
    expect(scheduleHasMissingEligiblePhotoSlot(schedule)).toBe(true)
    const body = autoPhotoFillRequest(true)
    expect(body).toEqual({ photoChain: 'v2', preserveHero: true, fillMissingOnly: true })
    expect(processImagesProductUpdate(true, schedule, { bgImageUrl: 'https://cdn.example/new.jpg', bgImageSource: 'pexels' })).toEqual({
      schedule,
    })
    expect(processImagesProductUpdate(false, schedule, { bgImageUrl: 'https://cdn.example/new.jpg' }).bgImageUrl).toBe(
      'https://cdn.example/new.jpg',
    )
  })

  it('keeps blocked products out of the dashboard queue and does not flip queueReady', () => {
    expect(JSON.stringify(REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE)).not.toContain('pre_photo_blocked')
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/register-auto-photo-register-job.ts'), 'utf8')
    expect(src).toContain('REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE')
    expect(src).toContain("registrationStatus: 'pre_photo_blocked'")
    expect(src).not.toContain('registerPrePhotoQueueReady:')
    expect(src).toContain('filled: filledCount')
    expect(src).toContain('j.filled')
  })

  it('does not bulk-assign the pool over stored photos or a missing-only fill', () => {
    expect(shouldBulkAssignUndistinctPool({
      poolCount: 5, fillMissingOnly: true, storedDayPhotoCount: 2,
    })).toBe(false)
    expect(shouldBulkAssignUndistinctPool({
      poolCount: 5, fillMissingOnly: false, storedDayPhotoCount: 1,
    })).toBe(false)
    expect(shouldBulkAssignUndistinctPool({
      poolCount: 5, fillMissingOnly: false, storedDayPhotoCount: 0,
    })).toBe(true)
    expect(shouldBulkAssignUndistinctPool({
      poolCount: 4, fillMissingOnly: false, storedDayPhotoCount: 0,
    })).toBe(false)
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/travel/process-images/route.ts'), 'utf8')
    expect(route).toContain('!areScheduleImageKeywordsDistinct(scheduleArr)')
    expect(route).toContain('shouldBulkAssignUndistinctPool')
    expect(route).toContain('replyWithFilledCount')
  })

  it('counts only newly filled slots and rejects a zero fill', () => {
    expect(countNewlyFilledPhotoSlots({
      beforeDayUrls: ['https://cdn.example/a.webp', ''],
      afterDayUrls: ['https://cdn.example/a.webp', 'https://cdn.example/b.webp'],
      beforeCover: 'https://cdn.example/cover.webp',
      afterCover: 'https://cdn.example/cover.webp',
      coverCounts: true,
    })).toBe(1)
    expect(countNewlyFilledPhotoSlots({
      beforeDayUrls: [''],
      afterDayUrls: [''],
      beforeCover: '',
      afterCover: 'https://cdn.example/cover.webp',
      coverCounts: false,
    })).toBe(0)
    expect(photoFillHttpResult(2)).toEqual({ httpStatus: 200, body: { success: true, filled: 2 } })
    expect(photoFillHttpResult(0)).toEqual({ httpStatus: 422, body: { success: false, filled: 0, reason: 'no_slot_filled' } })
  })
})
