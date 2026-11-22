import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { CLEARED_SLOT_PRIORITY_CAP, mergeClearedSlotPriorityPicks } from '@/lib/cleared-slot-refill-priority'

const rows = (n: number, p = 'p') => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}` }))
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('cleared-slot-refill-priority-1122', () => {
  it('비운 칸 상품 25개가 한 실행에 모두 맨 앞, 일반 순번 limit 은 따로', () => {
    const cleared = rows(25, 'c')
    const other = rows(40, 'o')
    const out = mergeClearedSlotPriorityPicks([...other, ...cleared], [], ids(cleared), 10, (rest) => rest)
    expect(ids(out).slice(0, 25)).toEqual(ids(cleared))
    expect(out.slice(25).every((r) => r.id.startsWith('o'))).toBe(true)
    expect(out.length).toBe(35)
  })
  it('같은 실행 점검 비움이 가장 앞, 중복 없음', () => {
    const e = rows(5)
    const out = mergeClearedSlotPriorityPicks(e, ['p3'], ['p3', 'p1'], 10, (rest) => rest)
    expect(ids(out)).toEqual(['p3', 'p1', 'p0', 'p2', 'p4'])
  })
  it('빈 칸이 없는(채워진) 상품은 eligible 에 없으니 다시 넣지 않음', () => {
    const out = mergeClearedSlotPriorityPicks(rows(3), [], ['gone'], 10, (rest) => rest)
    expect(ids(out)).toEqual(['p0', 'p1', 'p2'])
  })
  it('우선 상품 수 상한', () => {
    const c = rows(CLEARED_SLOT_PRIORITY_CAP + 5, 'c')
    const out = mergeClearedSlotPriorityPicks(c, [], ids(c), 10, (rest) => rest)
    expect(out.length).toBe(CLEARED_SLOT_PRIORITY_CAP + 5)
    expect(ids(out).slice(0, CLEARED_SLOT_PRIORITY_CAP)).toEqual(ids(c).slice(0, CLEARED_SLOT_PRIORITY_CAP))
  })
  it('채움 작업이 비운 칸 기록을 읽어 우선 채움에 넘김', () => {
    const src = readFileSync('lib/register-auto-photo-register-job.ts', 'utf8')
    expect(src).toContain("sourceType: 'site-health-clear'")
    expect(src).toContain('mergeClearedSlotPriorityPicks(eligible, priorityIds, cleared, limit')
  })
})

describe('orderQueueClearedSlotsFirst', () => {
  it('비운 칸 공개 상품이 등록대기보다 먼저, 나머지 공개 상품은 뒤', async () => {
    const { orderQueueClearedSlotsFirst } = await import('@/lib/cleared-slot-refill-priority')
    const q = orderQueueClearedSlotsFirst([{ id: 'w1' }, { id: 'w2' }], [{ id: 'c1' }, { id: 'r1' }, { id: 'c2' }], new Set(['c1', 'c2']))
    expect(q.map((r) => `${r.id}:${r.publicRow}`)).toEqual(['c1:true', 'c2:true', 'w1:false', 'w2:false', 'r1:true'])
  })
  it('job 이 큐를 이 함수로 만든다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('lib/register-auto-photo-register-job.ts', 'utf8')
    expect(src).toContain('orderQueueClearedSlotsFirst(ids, picked.rows, picked.frontIds)')
  })
})
