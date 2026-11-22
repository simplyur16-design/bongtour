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


/**
 * REGRESSION-FREEZE[cleared-slot-queue-front-1122]: 우선 채움 공개 상품(점검·수동으로 비운 칸)을 등록대기 처리보다 앞에 둔다.
 * 등록대기 50개 처리가 1시간을 넘겨 공개 채움 단계에 닿지 못하던 원인(11/22 09:30·10:30 실행) 교정 — manifest
 */
export function orderQueueClearedSlotsFirst<P extends { id: string }, Q extends { id: string }>(
  pending: readonly P[],
  publicRows: readonly Q[],
  frontIds: ReadonlySet<string>,
): Array<(P & { publicRow: false }) | (Q & { publicRow: true })> {
  const front = publicRows.filter((r) => frontIds.has(r.id))
  const rest = publicRows.filter((r) => !frontIds.has(r.id))
  return [
    ...front.map((r) => ({ ...r, publicRow: true as const })),
    ...pending.map((r) => ({ ...r, publicRow: false as const })),
    ...rest.map((r) => ({ ...r, publicRow: true as const })),
  ]
}
