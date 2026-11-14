import { describe, expect, it } from 'vitest'
import {
  formatPhotoExceptionLine,
  openPhotoExceptions,
  parsePhotoExceptionNote,
  photoExceptionNote,
  PHOTO_EXCEPTION_SELECTION_MODE,
  recordPhotoException,
  summarizePhotoExceptions,
  type PhotoException,
} from '@/lib/photo-exception-list'

const ex = (over: Partial<PhotoException> = {}): PhotoException => ({
  productId: 'p1',
  day: 3,
  kind: 'day',
  sight: 'Blue Mosque',
  query: 'Blue Mosque istanbul',
  reason: 'no_sight_match',
  detail: 'rejects=no_sight_match:4 evaluated=0/5',
  origin: 'autofill',
  at: '2026-11-14T07:00:00.000Z',
  ...over,
})

describe('photo-exception-list: 예외 목록 한 곳', () => {
  it('상품·일차·명소·검색어·사유가 한 줄 기록으로 남는다', async () => {
    const rows: Array<Record<string, unknown>> = []
    const logs: string[] = []
    await recordPhotoException(ex(), { record: async (r) => void rows.push(r), log: (l) => logs.push(l) })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ productId: 'p1', day: 3, selectionMode: PHOTO_EXCEPTION_SELECTION_MODE, actorType: 'system' })
    const parsed = parsePhotoExceptionNote(rows[0]!.notes as string)
    expect(parsed).toMatchObject({ sight: 'Blue Mosque', query: 'Blue Mosque istanbul', reason: 'no_sight_match', origin: 'autofill' })
    expect(logs[0]).toContain('auto-photo-exception')
  })

  it('기록 실패는 작업을 멈추지 않는다', async () => {
    await expect(recordPhotoException(ex(), { record: async () => Promise.reject(new Error('db down')), log: () => {} })).resolves.toBeUndefined()
  })

  it('대표 사진 칸은 1일차 행으로 기록하되 kind=cover 로 구분', async () => {
    const rows: Array<Record<string, unknown>> = []
    await recordPhotoException(ex({ kind: 'cover', day: null }), { record: async (r) => void rows.push(r), log: () => {} })
    expect(rows[0]!.day).toBe(1)
    expect(parsePhotoExceptionNote(rows[0]!.notes as string)?.kind).toBe('cover')
  })

  it('나중에 자동 채움이 성공한 칸은 닫힌 예외', () => {
    const exRows = [
      { productId: 'p1', day: 3, usedAt: '2026-11-14T07:00:00Z', notes: photoExceptionNote(ex()) },
      { productId: 'p1', day: 4, usedAt: '2026-11-14T07:00:00Z', notes: photoExceptionNote(ex({ day: 4 })) },
    ]
    const autoRows = [{ productId: 'p1', day: 3, usedAt: '2026-11-14T09:00:00Z' }]
    expect(openPhotoExceptions(exRows, autoRows).map((r) => r.day)).toEqual([4])
  })

  it('관리자 칸용 요약은 500자 이내', () => {
    const many = Array.from({ length: 60 }, (_, i) => ex({ day: i + 1 }))
    expect(summarizePhotoExceptions(many).length).toBeLessThanOrEqual(500)
    expect(formatPhotoExceptionLine(ex())).toContain('3일차')
  })
})
