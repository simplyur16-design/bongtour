import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE } from '@/lib/register-pre-photo-pending-queue-query'
import {
  autoPhotoFillRequest,
  missingDayFillAction,
  processImagesProductUpdate,
  scheduleHasMissingEligiblePhotoSlot,
} from '@/lib/register-auto-photo-missing-day'

describe('missing-day photo fill', () => {
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

  it('does not queue pre_photo_blocked products or flip queueReady', () => {
    expect(JSON.stringify(REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE)).not.toContain('pre_photo_blocked')
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/register-auto-photo-register-job.ts'), 'utf8')
    expect(src).toContain('REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE')
    expect(src).not.toContain("registrationStatus: 'pre_photo_blocked'")
    expect(src).not.toContain('registerPrePhotoQueueReady:')
  })
})
