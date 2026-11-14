import { describe, expect, it } from 'vitest'
import { applyDayPhotoReplacement, coverReplacementData, parseReplaceNote, PHOTO_REPLACE_FIELDS, replaceNote, revertDayPhoto } from '@/lib/photo-slot-apply'

const schedule = JSON.stringify([
  {
    day: 1,
    title: '1일차 제목',
    description: '1일차 설명',
    routeText: '이스탄불',
    imageUrl: 'https://cdn.example.com/a.webp',
    imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/a-1/', externalId: '1' },
    imagePhotographer: 'A',
    imageSourcePageUrl: 'https://www.pexels.com/photo/a-1/',
    imageCandidateOrigin: 'chain-pexels',
  },
  { day: 2, title: '2일차', description: '설명2', imageUrl: 'https://cdn.example.com/m.webp', imageManualSelected: true },
])

const photo = { url: 'https://cdn.example.com/b.webp', source: 'Pexels', photographer: 'B', originalLink: 'https://www.pexels.com/photo/b-2/', externalId: '2', sight: 'Blue Mosque', matched: 'blue mosque' }

describe('photo-slot-apply: 사진 칸만 바꾼다', () => {
  it('사진 5개 필드 외 title·설명·동선·가격 관련 칸은 그대로', () => {
    const r = applyDayPhotoReplacement(schedule, 1, photo, 'nightly')
    expect('error' in r).toBe(false)
    if ('error' in r) return
    const before = JSON.parse(schedule)[0]
    const after = JSON.parse(r.schedule)[0]
    for (const k of Object.keys(before)) {
      if ((PHOTO_REPLACE_FIELDS as readonly string[]).includes(k)) continue
      expect(after[k]).toEqual(before[k])
    }
    expect(after.imageUrl).toBe(photo.url)
    expect(after.imageSource).toMatchObject({ externalId: '2', sight: 'Blue Mosque', sightMatch: 'blue mosque' })
    expect(JSON.parse(r.schedule)[1]).toEqual(JSON.parse(schedule)[1])
  })

  it('관리자가 고른 칸은 바꾸지 않는다', () => {
    expect(applyDayPhotoReplacement(schedule, 2, photo, 'heal')).toEqual({ error: 'manual_locked' })
  })

  it('없는 일차·일정 없음은 오류', () => {
    expect(applyDayPhotoReplacement(schedule, 9, photo, 'heal')).toEqual({ error: 'day_not_found' })
    expect(applyDayPhotoReplacement(null, 1, photo, 'heal')).toEqual({ error: 'no_schedule' })
  })

  it('교체 전 값을 기록하고 되돌리면 원래대로', () => {
    const r = applyDayPhotoReplacement(schedule, 1, photo, 'nightly')
    if ('error' in r) throw new Error('unexpected')
    const note = replaceNote({ reason: 'broken_http', slot: 'day', origin: 'nightly', prev: r.previous })
    const parsed = parseReplaceNote(note)
    expect(parsed?.prev).toMatchObject({ imageUrl: 'https://cdn.example.com/a.webp' })
    const reverted = revertDayPhoto(r.schedule, 1, parsed!.prev as never)
    expect(reverted).not.toBeNull()
    expect(JSON.parse(reverted!)[0]).toEqual(JSON.parse(schedule)[0])
  })

  it('대표 교체 데이터는 대표 사진 칸만 담는다', () => {
    const data = coverReplacementData(photo)
    expect(data.bgImageUrl).toBe(photo.url)
    expect(Object.keys(data).every((k) => k.startsWith('bgImage'))).toBe(true)
  })

  it('알 수 없는 기록은 되돌리기 대상이 아니다', () => {
    expect(parseReplaceNote('replaced:https://x')).toBeNull()
    expect(parseReplaceNote(null)).toBeNull()
  })
})
