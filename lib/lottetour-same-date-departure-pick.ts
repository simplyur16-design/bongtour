/**
 * lottetour 동일 출발일 다중 evtCd(등급) — (productId, departureDate) 유니크 제약 하 1행 선택.
 * REGRESSION-FREEZE[lottetour-same-date-origin-evt-priority]: origin evtCd 우선 — manifest
 */
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import {
  parseSupplierTripDurationLabel,
  supplierTripDurationEquals,
  type SupplierTripDuration,
} from '@/lib/supplier-trip-duration'

function evtKey(d: DepartureInput): string {
  return (d.supplierPriceKey ?? d.supplierDepartureCodeCandidate ?? '').trim()
}

/**
 * 동일 날짜 후보 중 (상품 기간을 알면 기간 일치 후보만) origin evtCd 일치 → 없으면 최저 성인가 → evtCd 사전순.
 * 기간 일치 후보가 하나도 없으면 기존 후보 전체에서 고른다(지금 동작).
 */
export function pickLottetourDepartureForSameDate(
  candidates: DepartureInput[],
  preferSupplierPriceKey: string | null | undefined,
  expectedTripDuration?: SupplierTripDuration | null,
): DepartureInput {
  if (candidates.length <= 1) return candidates[0]!
  if (expectedTripDuration) {
    const same = candidates.filter((d) =>
      supplierTripDurationEquals(parseSupplierTripDurationLabel(d.vehicleNote ?? null), expectedTripDuration),
    )
    if (same.length > 0 && same.length < candidates.length) {
      return pickLottetourDepartureForSameDate(same, preferSupplierPriceKey, null)
    }
  }
  const prefer = (preferSupplierPriceKey ?? '').trim()
  if (prefer) {
    const hit = candidates.find((d) => evtKey(d) === prefer)
    if (hit) return hit
  }
  return [...candidates].sort((a, b) => {
    const pa = a.adultPrice ?? Number.MAX_SAFE_INTEGER
    const pb = b.adultPrice ?? Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return evtKey(a).localeCompare(evtKey(b))
  })[0]!
}

export function dedupeLottetourDepartureInputsByDate(
  inputs: DepartureInput[],
  preferSupplierPriceKey?: string | null,
  expectedTripDuration?: SupplierTripDuration | null,
): DepartureInput[] {
  const byDate = new Map<string, DepartureInput[]>()
  for (const d of inputs) {
    const ymd = departureInputToYmd(d.departureDate)
    if (!ymd) continue
    const list = byDate.get(ymd) ?? []
    list.push(d)
    byDate.set(ymd, list)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => pickLottetourDepartureForSameDate(group, preferSupplierPriceKey, expectedTripDuration))
}
