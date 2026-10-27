import { describe, expect, it } from 'vitest'
import {
  mergePublicPriceRowsByDate,
  pickGloballyCheapestDepartureRowByAdultPrice,
  pickBookableRowForDateKey,
} from '@/lib/public-default-departure-selection'
import { pickVerygoodPublicDefaultDepartureRow } from '@/lib/verygood/verygood-public-default-departure'

// REGRESSION-FREEZE[public-default-departure-nearest]: 하한 이후 최저가 — manifest

describe('public-default-departure-selection', () => {
  const base = new Date('2026-09-10T12:00:00+09:00')

  it('ignores past dates and picks cheapest among bookable future rows', () => {
    const rows = [
      { id: 'jul', date: '2026-07-05', adult: 500_000 },
      { id: 'oct-cheap', date: '2026-10-20', adult: 799_900 },
      { id: 'oct-dear', date: '2026-10-01', adult: 1_200_000 },
      { id: 'sep-soon', date: '2026-09-11', adult: 600_000 },
    ]
    // floor = 2026-09-12 → jul + sep-soon out; cheapest remaining = oct-cheap
    const picked = pickGloballyCheapestDepartureRowByAdultPrice(rows as never, base)
    expect(picked?.id).toBe('oct-cheap')
  })

  it('same price prefers earlier departure', () => {
    const rows = [
      { id: 'b', date: '2026-11-10', adult: 900_000 },
      { id: 'a', date: '2026-10-05', adult: 900_000 },
    ]
    const picked = pickGloballyCheapestDepartureRowByAdultPrice(rows as never, base)
    expect(picked?.id).toBe('a')
  })

  it('rejects dateKey before public bookable floor', () => {
    const rows = [{ id: 'jul', date: '2026-07-05', adult: 500_000 }]
    expect(pickBookableRowForDateKey(rows as never, '2026-07-05')).toBeNull()
  })
})

describe('mergePublicPriceRowsByDate — 날짜당 1행 달력 병합 뒤에도 기본 출발 = 전 회차 최저가', () => {
  const base = new Date('2026-10-27T12:00:00+09:00') // 하한 2026-10-29
  const pick = (rows: never[]) => pickGloballyCheapestDepartureRowByAdultPrice(rows, base)
  // hn-0049 실관측 형태: 같은 날짜에 항공사별 여러 회차, 뒤 행이 앞 행(최저가)을 덮던 문제
  const rows = [
    { id: 'nov06-lot', date: '2026-11-06', adult: 3_349_000, status: '예약가능', availableSeats: 15 },
    { id: 'nov06-ke', date: '2026-11-06', adult: 4_643_000, status: '판매완료', availableSeats: 0 },
    { id: 'dec04-lot', date: '2026-12-04', adult: 3_249_000, status: '예약가능', availableSeats: 19 },
    { id: 'dec04-oz', date: '2026-12-04', adult: 4_701_200, status: '예약가능', availableSeats: 20 },
    { id: 'jan01-lot', date: '2027-01-01', adult: 3_349_000, status: '출발확정', availableSeats: 17 },
  ]

  it('기존 단순 병합(뒤 행 우선)은 12/04 최저가가 가려져 1/1 로 밀렸다 — 회귀 기준', () => {
    const by = new Map<string, (typeof rows)[number]>()
    for (const r of rows) by.set(r.date, r)
    expect(pick([...by.values()] as never[])?.id).toBe('jan01-lot')
  })

  it('기본 출발 = 12/04 3,249,000 (전 회차 최저가) 이고 그 날짜 칸은 그 회차', () => {
    const merged = mergePublicPriceRowsByDate(rows, [], pick as never)
    expect(merged.map((r) => r.date)).toEqual(['2026-11-06', '2026-12-04', '2027-01-01'])
    expect(merged.find((r) => r.date === '2026-12-04')?.id).toBe('dec04-lot')
    expect(pick(merged as never[])?.id).toBe('dec04-lot')
  })

  it('기본 출발 날짜 외 칸은 기존 병합 그대로(뒤 행 우선)', () => {
    const merged = mergePublicPriceRowsByDate(rows, [], pick as never)
    expect(merged.find((r) => r.date === '2026-11-06')?.id).toBe('nov06-ke')
  })

  it('동가 → 빠른 날짜', () => {
    const tie = [
      { id: 'b', date: '2026-12-10', adult: 900_000 },
      { id: 'x', date: '2026-11-20', adult: 950_000 },
      { id: 'a', date: '2026-11-20', adult: 900_000 },
      { id: 'y', date: '2026-11-20', adult: 990_000 },
    ]
    const merged = mergePublicPriceRowsByDate(tie, [], pick as never)
    expect(pick(merged as never[])?.id).toBe('a')
  })

  it('잔여석 0(판매완료)은 최저가여도 기본 출발 아님 — 카드·달력 판매완료와 같은 기준', () => {
    const r2 = [
      { id: 'sold', date: '2026-11-06', adult: 2_349_000, status: '출발확정', availableSeats: 0, seatsStatusRaw: '잔여0석' },
      { id: 'ok', date: '2026-11-06', adult: 2_449_000, status: '예약가능', availableSeats: 5 },
      { id: 'later', date: '2027-01-01', adult: 2_649_000, status: '예약가능', availableSeats: 9 },
    ]
    expect(pickGloballyCheapestDepartureRowByAdultPrice(r2 as never, base)?.id).toBe('ok')
    const merged = mergePublicPriceRowsByDate(r2, [], pick as never)
    expect(pick(merged as never[])?.id).toBe('ok')
  })

  it('현장 수집 patch 는 그 날짜를 덮고, 그 날짜 원본 회차는 기본 후보에서 빠진다', () => {
    const patch = [{ id: 'od-2026-12-04', date: '2026-12-04', adult: 3_900_000, status: '예약가능' }]
    const merged = mergePublicPriceRowsByDate(rows, patch, pick as never)
    expect(merged.find((r) => r.date === '2026-12-04')?.id).toBe('od-2026-12-04')
    // 12/04 원본 최저가 대신 다음 최저가(11/06 LOT 3,349,000, 동가 1/1 보다 빠름)
    expect(pick(merged as never[])?.id).toBe('nov06-lot')
    expect(merged.find((r) => r.date === '2026-11-06')?.id).toBe('nov06-lot')
  })

  it('참좋은 picker 주입 — 같은 규칙으로 그 날짜 유지', () => {
    const vgPick = (r: never[]) => pickVerygoodPublicDefaultDepartureRow(r, base)
    const vg = [
      { id: 'd1-cheap', date: '2026-11-20', adult: 460_000, status: '예약가능' },
      { id: 'd1-dear', date: '2026-11-20', adult: 680_000, status: '예약가능' },
      { id: 'd2', date: '2026-11-21', adult: 500_000, status: '예약가능' },
    ]
    const merged = mergePublicPriceRowsByDate(vg, [], vgPick as never)
    expect(vgPick(merged as never[])?.id).toBe('d1-cheap')
  })

  it('예약가능 회차 없으면 기존 병합과 동일', () => {
    const none = [
      { id: 'p', date: '2026-10-01', adult: 500_000 },
      { id: 'q', date: '2026-11-01', adult: 0 },
    ]
    expect(mergePublicPriceRowsByDate(none, [], pick as never).map((r) => r.id)).toEqual(['p', 'q'])
  })
})
