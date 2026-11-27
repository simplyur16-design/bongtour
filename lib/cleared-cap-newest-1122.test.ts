/**
 * 비운 칸 우선 상한을 id 순이 아니라 최근 비운 순으로 자르고, 오늘 '생성 대상'으로 끝난 상품은 뒤로.
 * 11/22 19:13 비운 32상품 중 id 순 앞 15개만 상한(30) 안에 들어 나머지 17개가 19:30~22:30 내내 재시도되지 않던 실사례.
 * REGRESSION-FREEZE[cleared-cap-newest-1122] — manifest
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLEARED_SLOT_PRIORITY_CAP, clearedSlotProductsFirst, mergeClearedSlotPriorityPicks } from '@/lib/cleared-slot-refill-priority'

const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe('cleared-cap-newest-1122', () => {
  // 오래전 비운 상품 30개(id 가 작음, 매번 실패) + 방금 비운 32개(id 가 큼)
  const old = Array.from({ length: 30 }, (_, i) => ({ id: `cma${String(i).padStart(3, '0')}` }))
  const fresh = Array.from({ length: 32 }, (_, i) => ({ id: `cmz${String(i).padStart(3, '0')}` }))
  const eligible = [...old, ...fresh].sort((a, b) => a.id.localeCompare(b.id)) // 실제 조회는 id 오름차순
  const clearedNewestFirst = [...ids(fresh), ...ids(old)]

  it('상한은 최근 비운 순으로 자른다(방금 비운 32개 중 30개가 상한 안)', () => {
    const out = mergeClearedSlotPriorityPicks(eligible, [], clearedNewestFirst, 0, (rest) => rest)
    const head = ids(out).slice(0, CLEARED_SLOT_PRIORITY_CAP)
    expect(head).toEqual(ids(fresh).slice(0, CLEARED_SLOT_PRIORITY_CAP))
    expect(head.some((id) => id.startsWith('cma'))).toBe(false)
  })

  it("오늘 '생성 대상'으로 끝난 상품은 상한 뒤로(남은 2개 + 오래된 상품이 자리를 얻음)", () => {
    const deferred = new Set(ids(fresh).slice(0, 15))
    const out = mergeClearedSlotPriorityPicks(eligible, [], clearedNewestFirst, 100, (rest) => rest, deferred)
    const head = ids(out).slice(0, CLEARED_SLOT_PRIORITY_CAP)
    expect(head.slice(0, 17)).toEqual(ids(fresh).slice(15))
    expect(head.filter((id) => deferred.has(id))).toEqual([])
    // 상한 밖으로 밀린 상품도 일반 순번(rotate)에는 남는다
    expect(new Set(ids(out))).toEqual(new Set(ids(eligible)))
  })

  it('실행 순서도 최근 비운 상품이 맨 앞', () => {
    const picks = mergeClearedSlotPriorityPicks(eligible, [], clearedNewestFirst, 0, (rest) => rest)
    expect(ids(clearedSlotProductsFirst(picks, clearedNewestFirst)).slice(0, 3)).toEqual(['cmz000', 'cmz001', 'cmz002'])
  })

  it("작업이 오늘 '생성 대상' 기록을 읽어 넘긴다", () => {
    const src = readFileSync('lib/register-auto-photo-register-job.ts', 'utf8')
    expect(src).toContain("selectionMode: 'photo-exception'")
    expect(src).toContain('const GENERATE_TARGET_NOTE = \'"reason":"생성 대상"\'')
    expect(src).toContain('(rest) => rotatePublicMissingDayPicks(rest, limit, now), deferred)')
  })
})
