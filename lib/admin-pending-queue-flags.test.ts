import { describe, expect, it } from 'vitest'
import { computeRegisterPrePhotoQueueFlags } from '@/lib/register-pre-photo-queue-flags'

// REGRESSION-FREEZE[admin-pending-queue-flags]: compute flags from schedule — manifest

describe('admin-pending-queue-flags', () => {
  it('marks photosReady false without cover', () => {
    const flags = computeRegisterPrePhotoQueueFlags({
      registrationStatus: 'pending',
      listingKind: 'package',
      productType: 'package',
      title: '테스트 패키지',
      destination: '도쿄',
      bgImageUrl: '',
      schedule: JSON.stringify([
        { day: 1, routeText: '인천 - 도쿄', imageKeyword: 'Tokyo', description: '출발' },
        { day: 2, routeText: '도쿄 시내', imageKeyword: 'Shibuya', description: '관광' },
        { day: 3, routeText: '도쿄 - 인천', imageKeyword: 'Tokyo', description: '귀국' },
      ]),
    })
    expect(flags.registerPhotosReady).toBe(false)
  })

  it('exports queue where helper strings for freeze', async () => {
    const q = await import('@/lib/register-pre-photo-pending-queue-query')
    expect(q.REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE).toBeTruthy()
    expect(typeof q.countLiveRegisterPrePhotoPendingQueue).toBe('function')
  })
})
