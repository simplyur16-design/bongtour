import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  keptDayImagesWhenConfirmedPlaceSkipped,
  photoContextSearchQuery,
  unselectedDayImageUrl,
} from '@/lib/register-photo-day-confirmed-place'

const STORED_POOL =
  'https://kr.object.ncloudstorage.com/bongtour/photo-pool/example-existing.webp'
const STORED_PEXELS = 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg'

describe('process-images no-confirmed-place branch keeps stored photos', () => {
  it('CGP-style departure searches Guilin and keeps both stored URLs when nothing is selected', () => {
    const item = {
      title: '부산, 계림',
      description: '부산 21:40 출발. 익일 00:45 계림 도착. 호텔로 이동하여 투숙 및 휴식. 방문 관광지 없음.',
      routeText: '부산 - 계림공항 - 호텔',
      imageKeyword: 'Li River Guilin Cruise',
      imageKeyword2: 'Reed Flute Cave Guilin',
      imageUrl: STORED_POOL,
      imageUrl2: STORED_PEXELS,
      supplierOriginal: null,
    }
    const kept = keptDayImagesWhenConfirmedPlaceSkipped(item)
    expect(photoContextSearchQuery(`${item.description}\n${item.routeText}`)).toBe('계림')
    expect(kept.skipped).toBe(false)
    expect(unselectedDayImageUrl(null, item.imageUrl)).toBe(STORED_POOL)
    expect(unselectedDayImageUrl(null, item.imageUrl2)).toBe(STORED_PEXELS)
    expect(unselectedDayImageUrl('https://kr.object.ncloudstorage.com/bongtour/new.webp', item.imageUrl)).toBe(
      'https://kr.object.ncloudstorage.com/bongtour/new.webp',
    )
    expect(item.imageKeyword).toBe('Li River Guilin Cruise')
    expect(item.description).toContain('방문 관광지 없음')
  })

  it('ATA return day can use Chiang Mai and still keeps the stored URL, and a free day stays a recommendation', () => {
    const ret = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '인천',
      description: '치앙마이 00:10 출발. 인천국제공항 07:10 도착. 관광 없음.',
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageUrl: STORED_POOL,
      supplierOriginal: null,
    })
    const free = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '전일 자유일정',
      description: '전일 자유일정. 구체 방문지 없음.',
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageUrl: STORED_POOL,
      supplierOriginal: null,
    })
    const unclear = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '휴식',
      description: '호텔 투숙 후 휴식. 관광 없음.',
      imageKeyword: 'Paris',
      imageUrl: STORED_PEXELS,
      imageUrl2: STORED_POOL,
      supplierOriginal: null,
    })
    expect(photoContextSearchQuery('치앙마이 00:10 출발. 인천국제공항 07:10 도착. 관광 없음.')).toBe('치앙마이')
    expect(ret.skipped).toBe(false)
    expect(unselectedDayImageUrl(null, STORED_POOL)).toBe(STORED_POOL)
    expect(free.skipped).toBe(false)
    expect(unclear.skipped).toBe(true)
    expect(unclear.imageUrl).toBe(STORED_PEXELS)
    expect(unclear.imageUrl2).toBe(STORED_POOL)
    expect(photoContextSearchQuery('호텔 투숙 후 휴식. 관광 없음.')).toBeNull()
  })

  it('a confirmed sightseeing day is not forced through the keep branch', () => {
    const kept = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '양삭',
      description: '용호공원과 양삭 이강유람.',
      imageUrl: STORED_POOL,
      supplierOriginal: null,
    })
    expect(kept.skipped).toBe(false)
  })

  it('reads supplierOriginal text when present and still does not replace it', () => {
    const original = { items: [{ name: '빅토리아폭포 도보 관광', text: null }] }
    const kept = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '이동',
      description: '호텔 투숙',
      imageUrl: STORED_POOL,
      supplierOriginal: original,
    })
    expect(kept.skipped).toBe(false)
    expect(original.items[0]?.name).toBe('빅토리아폭포 도보 관광')
  })

  it('process-images keeps the stored URL on that branch instead of retain-clearing it', () => {
    const route = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
    expect(route).toContain('keptDayImagesWhenConfirmedPlaceSkipped(sched)')
    expect(route).toContain('preserveExistingPhotoIdx.add(n)')
    expect(route).toContain('daySelectionPersistSlice')
    expect(route).toContain('loadHero: async () => routeDaySlotHero()')
    expect(route).toContain('blocksAutomaticDayPhotoGeneration(dayFacts)')
    expect(route).toContain('selectScheduleDayPhoto({')
    expect(route).toContain('photoContextSearchQuery(dayFacts)')
    expect(route).toContain('no_verified_real_photo')
    const dayCall = route.slice(route.indexOf('const picked = await selectScheduleDayPhoto'), route.indexOf('photo = picked.photo'))
    expect(dayCall).not.toContain('generateImageWithGemini')
    expect(dayCall).not.toContain('resolveDayHeroWithFallback')
    expect(route).toContain('title: persisted.title')
    expect(route).toContain('description: persisted.description')
    expect(route).toContain('supplierOriginal: persisted.supplierOriginal')
    expect(route).not.toContain("fetch('https://api.unsplash.com")
    expect(route).not.toContain('searchUnsplashHeroCandidates(')
  })
})
