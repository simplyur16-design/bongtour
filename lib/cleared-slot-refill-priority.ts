/**
 * 비운 사진 칸 우선 채움 순서(순수 함수). 사장님 11/21 23:07 "문과장이 검수안해도 제대로 사진이 들어가 등록까지 되어야" — 봉실장 11/22 지시.
 */
/** 칸 비우기 기록(site-health-clear)을 우선 채움 대상으로 보는 기간 */
export const CLEARED_SLOT_PRIORITY_DAYS = 14
/** 한 실행에서 우선 채움으로 더 보는 상품 수 상한(일반 순번 limit 과 별도) */
export const CLEARED_SLOT_PRIORITY_CAP = 30

/**
 * REGRESSION-FREEZE[cleared-slot-refill-priority-1122]: 점검·수동(흑백 제거 등)으로 비운 칸(AssetUsageLog site-health-clear)이
 * 남은 공개 상품은 다음 :30 채움 맨 앞에. 일반 순번 limit 은 그대로 따로 돈다(우선 상품이 순번을 막지 않음) — manifest
 */
export function mergeClearedSlotPriorityPicks<T extends { id: string }>(
  eligible: readonly T[],
  runPriorityIds: readonly string[],
  clearedIds: readonly string[],
  limit: number,
  rotate: (rest: T[]) => T[],
): T[] {
  const runFirst = new Set(runPriorityIds)
  const clearedSet = new Set(clearedIds)
  const prior = eligible.filter((r) => runFirst.has(r.id))
  const cleared = eligible.filter((r) => !runFirst.has(r.id) && clearedSet.has(r.id)).slice(0, CLEARED_SLOT_PRIORITY_CAP)
  const taken = new Set([...prior, ...cleared].map((r) => r.id))
  const rest = eligible.filter((r) => !taken.has(r.id))
  return [...prior, ...cleared, ...rotate(rest).slice(0, limit)]
}

