/**
 * 출발일 재수집 시 슬롯키 형태 전환(날짜만 YYYY-MM-DD ↔ 공급사 회차코드)으로 같은 날짜 행이 중복 생성되는 것을 막는다.
 *
 * 규칙 (공급사 원문 회차 기준, 가격 추측 없음):
 * - 같은 회차 → 최신 수집값으로 같은 행 갱신.
 * - 다른 회차(코드가 다름) → 별도 행 유지.
 * - 날짜만 키(회차 미상) 기존 행 + 이번 수집에서 그 날짜 회차코드가 정확히 1개이고 그 코드 행이 아직 없음
 *   → 기존 행의 슬롯키를 회차코드로 바꿔 갱신(새 행 insert 금지).
 * - 이번 수집이 날짜만 키 + 그 날짜 기존 회차코드 행이 정확히 1개 → 그 행을 갱신(코드 유지).
 * - 이번 수집이 날짜만 키 + 그 날짜 기존 회차코드 행이 2개 이상 → 회차를 특정할 수 없으므로 쓰지 않음(skip).
 * - 같은 배치에 같은 날짜의 회차코드 입력이 있으면 날짜만 키 입력은 버림.
 *
 * REGRESSION-FREEZE[departure-legacy-ymd-slot-reconcile]: 날짜키↔회차코드 전환 시 중복 insert 금지 — manifest
 */
import type { PrismaClient } from '@prisma/client'

type SlotCodeFields = {
  supplierPriceKey?: string | null
  supplierDepartureCodeCandidate?: string | null
}

export type CollectedDeparturePair<T extends SlotCodeFields> = {
  dep: T
  departureDate: Date
  departureSlotKey: string
}

export type ExistingDepartureSlotRow = {
  id: string
  departureDate: Date
  departureSlotKey: string
  supplierPriceKey: string | null
  supplierDepartureCodeCandidate: string | null
}

export type LegacySlotReconcilePlan<T extends SlotCodeFields> = {
  pairs: CollectedDeparturePair<T>[]
  renames: { id: string; fromSlotKey: string; toSlotKey: string }[]
  skippedAmbiguousYmd: string[]
  droppedYmdSupersededByCode: string[]
}

function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isDateOnlySlotKey(slotKey: string, departureDate: Date): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(slotKey) && slotKey === ymdOf(departureDate)
}

export function planLegacyYmdSlotReconcile<T extends SlotCodeFields>(
  collected: CollectedDeparturePair<T>[],
  existing: ExistingDepartureSlotRow[],
): LegacySlotReconcilePlan<T> {
  const existingByYmd = new Map<string, ExistingDepartureSlotRow[]>()
  for (const row of existing) {
    const ymd = ymdOf(row.departureDate)
    const list = existingByYmd.get(ymd) ?? []
    list.push(row)
    existingByYmd.set(ymd, list)
  }
  const collectedByYmd = new Map<string, CollectedDeparturePair<T>[]>()
  for (const p of collected) {
    const ymd = ymdOf(p.departureDate)
    const list = collectedByYmd.get(ymd) ?? []
    list.push(p)
    collectedByYmd.set(ymd, list)
  }

  const pairs: CollectedDeparturePair<T>[] = []
  const renames: LegacySlotReconcilePlan<T>['renames'] = []
  const skippedAmbiguousYmd: string[] = []
  const droppedYmdSupersededByCode: string[] = []

  for (const [ymd, group] of collectedByYmd) {
    const rows = existingByYmd.get(ymd) ?? []
    const legacyRow = rows.find((r) => isDateOnlySlotKey(r.departureSlotKey, r.departureDate))
    const codedRows = rows.filter((r) => !isDateOnlySlotKey(r.departureSlotKey, r.departureDate))
    const codedInputs = group.filter((p) => !isDateOnlySlotKey(p.departureSlotKey, p.departureDate))
    const ymdInputs = group.filter((p) => isDateOnlySlotKey(p.departureSlotKey, p.departureDate))

    if (codedInputs.length > 0) {
      if (ymdInputs.length > 0) droppedYmdSupersededByCode.push(ymd)
      const distinctCodes = [...new Set(codedInputs.map((p) => p.departureSlotKey))]
      if (
        legacyRow &&
        distinctCodes.length === 1 &&
        !codedRows.some((r) => r.departureSlotKey === distinctCodes[0])
      ) {
        renames.push({ id: legacyRow.id, fromSlotKey: legacyRow.departureSlotKey, toSlotKey: distinctCodes[0]! })
      }
      pairs.push(...codedInputs)
      continue
    }

    if (legacyRow || codedRows.length === 0) {
      pairs.push(...ymdInputs)
      continue
    }
    if (codedRows.length === 1) {
      const target = codedRows[0]!
      for (const p of ymdInputs) {
        pairs.push({
          ...p,
          departureSlotKey: target.departureSlotKey,
          dep: {
            ...p.dep,
            supplierPriceKey: p.dep.supplierPriceKey ?? target.supplierPriceKey,
            supplierDepartureCodeCandidate:
              p.dep.supplierDepartureCodeCandidate ?? target.supplierDepartureCodeCandidate,
          },
        })
      }
      continue
    }
    skippedAmbiguousYmd.push(ymd)
  }

  return { pairs, renames, skippedAmbiguousYmd, droppedYmdSupersededByCode }
}

/** 기존 행을 읽어 계획을 세우고 날짜키→회차코드 슬롯키 변경만 먼저 반영한다. 반환 pairs 로 기존 upsert 를 진행. */
export async function reconcileLegacyYmdDepartureSlots<T extends SlotCodeFields>(
  prisma: PrismaClient,
  productId: string,
  collected: CollectedDeparturePair<T>[],
): Promise<CollectedDeparturePair<T>[]> {
  if (collected.length === 0) return collected
  const dates = [...new Map(collected.map((p) => [ymdOf(p.departureDate), p.departureDate])).values()]
  const existing = await prisma.productDeparture.findMany({
    where: { productId, departureDate: { in: dates } },
    select: {
      id: true,
      departureDate: true,
      departureSlotKey: true,
      supplierPriceKey: true,
      supplierDepartureCodeCandidate: true,
    },
  })
  const plan = planLegacyYmdSlotReconcile(collected, existing)
  for (const r of plan.renames) {
    await prisma.productDeparture.update({ where: { id: r.id }, data: { departureSlotKey: r.toSlotKey } })
  }
  if (plan.skippedAmbiguousYmd.length > 0) {
    console.warn(
      `[departure-legacy-slot-reconcile] productId=${productId} skipped date-only inputs (multiple coded rows on date): ${plan.skippedAmbiguousYmd.join(',')}`,
    )
  }
  return plan.pairs
}
