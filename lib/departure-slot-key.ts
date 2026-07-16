/**
 * ProductDeparture / ProductPrice 식별 슬롯 — 동일 캘린더일 다등급(evtCd) 행 분리.
 * REGRESSION-FREEZE[lottetour-multi-grade-departure-slots]: supplierPriceKey 우선 — manifest
 */
import { normalizeCalendarDate } from '@/lib/date-normalize'

export function departureInputYmd(input: string | Date): string | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null
    return input.toISOString().slice(0, 10)
  }
  const s = String(input).trim()
  return normalizeCalendarDate(s) || (s.length >= 10 ? s.slice(0, 10) : null)
}

/** 출발일 + 공급사 가격키 → DB 유니크 슬롯. 키 없으면 YYYY-MM-DD(기존 1일 1행 호환). */
export function computeDepartureSlotKeyFromInput(d: {
  departureDate: string | Date
  supplierPriceKey?: string | null
  supplierDepartureCodeCandidate?: string | null
}): string | null {
  const ymd = departureInputYmd(d.departureDate)
  if (!ymd) return null
  const sk = (d.supplierPriceKey ?? '').trim()
  if (sk) return sk.slice(0, 200)
  const code = (d.supplierDepartureCodeCandidate ?? '').trim()
  if (code) return code.slice(0, 200)
  return ymd
}

export function computeDepartureSlotKeyFromDate(
  departureDate: Date,
  supplierPriceKey?: string | null,
  supplierDepartureCodeCandidate?: string | null,
): string {
  return (
    computeDepartureSlotKeyFromInput({
      departureDate,
      supplierPriceKey,
      supplierDepartureCodeCandidate,
    }) ?? departureDate.toISOString().slice(0, 10)
  )
}

export function priceSlotKeyFromDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'invalid-date'
  return date.toISOString().slice(0, 10)
}

export function dedupeDepartureInputsBySlotKey<T extends {
  departureDate: string | Date
  supplierPriceKey?: string | null
  supplierDepartureCodeCandidate?: string | null
}>(inputs: T[]): T[] {
  const lastBySlot = new Map<string, T>()
  for (const d of inputs) {
    const slot = computeDepartureSlotKeyFromInput(d)
    if (!slot) continue
    lastBySlot.set(slot, d)
  }
  return [...lastBySlot.values()].sort((a, b) => {
    const ya = departureInputYmd(a.departureDate) ?? ''
    const yb = departureInputYmd(b.departureDate) ?? ''
    const c = ya.localeCompare(yb)
    if (c !== 0) return c
    const ka = computeDepartureSlotKeyFromInput(a) ?? ''
    const kb = computeDepartureSlotKeyFromInput(b) ?? ''
    return ka.localeCompare(kb)
  })
}
