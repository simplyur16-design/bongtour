/**
 * 플랜 선택 팝업·목록 표시 정렬 SSOT.
 * pickRecommendedFromPool 과 동일: tripDays 정확 일치(또는 +1,+2… 가까운 catalog 일수) 우선 → 유형별 2차 → 가격 오름차순.
 * 용량은 큰 것(좋은 플랜)이 위.
 * REGRESSION-FREEZE[simplyur-plans-best-capacity-first]: 데일리·종량제 고용량 우선 — manifest
 */
import {
  detectAllowanceBucket,
  type AllowanceBucketId,
} from '@/lib/bongsim/recommend/allowance-buckets'
import type { ProductOption } from '@/lib/bongsim/recommend/product-option'
import { extractDaysFromDaysRaw } from '@/lib/bongsim/recommend/product-option'
import { isQos5Mbps } from '@/lib/bongsim/recommend/plan-speed-tier'

export type PlanDisplayTab = 'unlimited' | 'daily' | 'fixed'

const CAPACITY_RANK: AllowanceBucketId[] = ['500mb', '1gb', '2gb', '3gb', '4gb', '5gb']

function capacityRank(bucket: AllowanceBucketId | null): number {
  if (!bucket || bucket === 'unlimited') return -1
  const i = CAPACITY_RANK.indexOf(bucket)
  return i >= 0 ? i : 999
}

function displayPrice(p: ProductOption): number {
  if (typeof p.recommended_price === 'number' && Number.isFinite(p.recommended_price)) {
    return p.recommended_price
  }
  return Number.POSITIVE_INFINITY
}

/** tripDays 이상 catalog 일수 중 tripDays와의 거리 (0 = 정확 일치 SKU) */
export function catalogDayDistanceFromTrip(p: ProductOption, tripDays: number): number {
  const d = extractDaysFromDaysRaw(p.days_raw)
  if (d == null || d < tripDays) return 99999
  return d - tripDays
}

function allowanceLabelSortKey(label: string): number {
  const compact = label.trim().toLowerCase().replace(/\s/g, '')
  if (compact === '무제한' || compact === '완전무제한' || compact === 'unlimited') {
    return Number.POSITIVE_INFINITY
  }
  const gb = compact.match(/(\d+(?:\.\d+)?)gb/)
  if (gb) return parseFloat(gb[1]) * 1024
  const mb = compact.match(/(\d+(?:\.\d+)?)mb/)
  if (mb) return parseFloat(mb[1])
  return 99999
}

function catalogDaysSortKey(p: ProductOption): number {
  return extractDaysFromDaysRaw(p.days_raw) ?? 99999
}

export function sortPlansForDisplayList(
  plans: ProductOption[],
  tripDays: number,
  planType: PlanDisplayTab,
): ProductOption[] {
  if (planType === 'fixed') {
    return [...plans].sort((a, b) => {
      const ka = allowanceLabelSortKey(a.allowance_label || '')
      const kb = allowanceLabelSortKey(b.allowance_label || '')
      if (ka !== kb) return kb - ka
      const da = catalogDaysSortKey(a)
      const db = catalogDaysSortKey(b)
      if (da !== db) return da - db
      return displayPrice(a) - displayPrice(b)
    })
  }

  return [...plans].sort((a, b) => {
    const da = catalogDayDistanceFromTrip(a, tripDays)
    const db = catalogDayDistanceFromTrip(b, tripDays)
    if (da !== db) return da - db

    if (planType === 'unlimited') {
      const a5 = isQos5Mbps(a.qos_raw) ? 0 : 1
      const b5 = isQos5Mbps(b.qos_raw) ? 0 : 1
      if (a5 !== b5) return a5 - b5
      return displayPrice(a) - displayPrice(b)
    }

    if (planType === 'daily') {
      const ra = capacityRank(detectAllowanceBucket(a))
      const rb = capacityRank(detectAllowanceBucket(b))
      if (ra !== rb) return rb - ra
      return displayPrice(a) - displayPrice(b)
    }

    return displayPrice(a) - displayPrice(b)
  })
}

export function sortPlanGroupsForDisplay(
  groups: { unlimited: ProductOption[]; daily: ProductOption[]; fixed: ProductOption[] },
  tripDays: number,
): { unlimited: ProductOption[]; daily: ProductOption[]; fixed: ProductOption[] } {
  return {
    unlimited: sortPlansForDisplayList(groups.unlimited, tripDays, 'unlimited'),
    daily: sortPlansForDisplayList(groups.daily, tripDays, 'daily'),
    fixed: sortPlansForDisplayList(groups.fixed, tripDays, 'fixed'),
  }
}
