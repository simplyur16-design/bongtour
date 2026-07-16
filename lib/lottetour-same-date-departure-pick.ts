/**
 * lottetour 동일 출발일 다중 evtCd(등급) — (productId, departureDate) 유니크 제약 하 1행 선택.
 * REGRESSION-FREEZE[lottetour-same-date-origin-evt-priority]: origin evtCd 우선 — manifest
 */
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'

function evtKey(d: DepartureInput): string {
  return (d.supplierPriceKey ?? d.supplierDepartureCodeCandidate ?? '').trim()
}

/** 동일 날짜 후보 중 origin evtCd 일치 → 없으면 최저 성인가 → evtCd 사전순 */
export function pickLottetourDepartureForSameDate(
  candidates: DepartureInput[],
  preferSupplierPriceKey: string | null | undefined,
): DepartureInput {
  if (candidates.length <= 1) return candidates[0]!
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
    .map(([, group]) => pickLottetourDepartureForSameDate(group, preferSupplierPriceKey))
}
