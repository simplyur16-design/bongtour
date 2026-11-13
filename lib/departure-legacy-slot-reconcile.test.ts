import { describe, expect, it, vi } from 'vitest'

import { computeDepartureSlotKeyFromDate } from '@/lib/departure-slot-key'
import {
  planLegacyYmdSlotReconcile,
  reconcileLegacyYmdDepartureSlots,
  type ExistingDepartureSlotRow,
} from '@/lib/departure-legacy-slot-reconcile'

type Dep = { departureDate: string; supplierPriceKey?: string | null; supplierDepartureCodeCandidate?: string | null }

function pair(dep: Dep) {
  const departureDate = new Date(`${dep.departureDate}T00:00:00.000Z`)
  return {
    dep,
    departureDate,
    departureSlotKey: computeDepartureSlotKeyFromDate(departureDate, dep.supplierPriceKey, dep.supplierDepartureCodeCandidate),
  }
}

function row(id: string, ymd: string, slotKey: string, code: string | null = null): ExistingDepartureSlotRow {
  return {
    id,
    departureDate: new Date(`${ymd}T00:00:00.000Z`),
    departureSlotKey: slotKey,
    supplierPriceKey: null,
    supplierDepartureCodeCandidate: code,
  }
}

describe('planLegacyYmdSlotReconcile', () => {
  it('modetour TJP302TWD 패턴: 날짜키 기존 행 + 회차코드 1개 재수집 → 기존 행 슬롯키 전환(새 insert 없음)', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-11-10', supplierDepartureCodeCandidate: 'modetour:113207590' })],
      [row('legacy', '2026-11-10', '2026-11-10')],
    )
    expect(plan.renames).toEqual([{ id: 'legacy', fromSlotKey: '2026-11-10', toSlotKey: 'modetour:113207590' }])
    expect(plan.pairs.map((p) => p.departureSlotKey)).toEqual(['modetour:113207590'])
  })

  it('ybtour JSP1089 패턴: 상태 문구만 다른 재수집도 같은 회차면 1행', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-12-03', supplierPriceKey: 'ybtour:JSP1089-261203KE01' })],
      [row('legacy', '2026-12-03', '2026-12-03')],
    )
    expect(plan.renames).toHaveLength(1)
    expect(plan.pairs).toHaveLength(1)
  })

  it('다른 회차(코드 2개) → 별도 행 유지, 날짜키 기존 행은 임의 귀속하지 않음', () => {
    const plan = planLegacyYmdSlotReconcile(
      [
        pair({ departureDate: '2026-12-03', supplierPriceKey: 'ybtour:CNP4032-261203KE01' }),
        pair({ departureDate: '2026-12-03', supplierPriceKey: 'ybtour:CNP4032-261203OZ01' }),
      ],
      [row('legacy', '2026-12-03', '2026-12-03')],
    )
    expect(plan.renames).toEqual([])
    expect(plan.pairs.map((p) => p.departureSlotKey).sort()).toEqual([
      'ybtour:CNP4032-261203KE01',
      'ybtour:CNP4032-261203OZ01',
    ])
  })

  it('회차코드 행이 이미 있으면 날짜키 행 전환 안 함(유니크 충돌 방지)', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-11-10', supplierDepartureCodeCandidate: 'modetour:113207590' })],
      [row('legacy', '2026-11-10', '2026-11-10'), row('coded', '2026-11-10', 'modetour:113207590', 'modetour:113207590')],
    )
    expect(plan.renames).toEqual([])
    expect(plan.pairs).toHaveLength(1)
  })

  it('역방향: 날짜키 재수집 + 기존 회차코드 행 1개 → 그 행 갱신(코드 유지)', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-11-19' })],
      [row('coded', '2026-11-19', 'modetour:113207584', 'modetour:113207584')],
    )
    expect(plan.pairs).toHaveLength(1)
    expect(plan.pairs[0]!.departureSlotKey).toBe('modetour:113207584')
    expect(plan.pairs[0]!.dep.supplierDepartureCodeCandidate).toBe('modetour:113207584')
  })

  it('역방향 + 기존 회차코드 행 2개 → 회차 특정 불가로 skip', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-11-19' })],
      [row('a', '2026-11-19', 'k1', 'k1'), row('b', '2026-11-19', 'k2', 'k2')],
    )
    expect(plan.pairs).toEqual([])
    expect(plan.skippedAmbiguousYmd).toEqual(['2026-11-19'])
  })

  it('같은 배치에 날짜키·회차코드 혼재 → 날짜키 입력 버림', () => {
    const plan = planLegacyYmdSlotReconcile(
      [pair({ departureDate: '2026-11-10' }), pair({ departureDate: '2026-11-10', supplierDepartureCodeCandidate: 'modetour:1' })],
      [],
    )
    expect(plan.pairs.map((p) => p.departureSlotKey)).toEqual(['modetour:1'])
    expect(plan.droppedYmdSupersededByCode).toEqual(['2026-11-10'])
  })

  it('기존 행 없음 → 입력 그대로', () => {
    const plan = planLegacyYmdSlotReconcile([pair({ departureDate: '2026-11-10' })], [])
    expect(plan.pairs.map((p) => p.departureSlotKey)).toEqual(['2026-11-10'])
    expect(plan.renames).toEqual([])
  })
})

describe('reconcileLegacyYmdDepartureSlots', () => {
  it('전환 대상만 update 하고 create/delete 는 하지 않음', async () => {
    const update = vi.fn().mockResolvedValue({})
    const findMany = vi.fn().mockResolvedValue([row('legacy', '2026-11-10', '2026-11-10')])
    const prisma = { productDeparture: { findMany, update } } as never
    const pairs = await reconcileLegacyYmdDepartureSlots(prisma, 'p1', [
      pair({ departureDate: '2026-11-10', supplierDepartureCodeCandidate: 'modetour:113207590' }),
    ])
    expect(update).toHaveBeenCalledWith({ where: { id: 'legacy' }, data: { departureSlotKey: 'modetour:113207590' } })
    expect(pairs).toHaveLength(1)
  })
})
