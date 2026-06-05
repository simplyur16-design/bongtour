/**
 * 자유여행 허브 — 메가메뉴 해외 권역(`overseas-display-buckets`) 기준 필터·섹션 SSOT.
 */
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'

export type AirHotelRegionChip = {
  id: OverseasDisplayBucketId
  label: string
  count: number
}

export function isAirHotelRegionBucketParam(
  raw: string | null | undefined,
): raw is OverseasDisplayBucketId {
  if (!raw?.trim()) return false
  return (OVERSEAS_DISPLAY_BUCKET_ORDER as readonly string[]).includes(raw.trim())
}

export function airHotelRegionLabel(bucket: OverseasDisplayBucketId): string {
  return OVERSEAS_DISPLAY_BUCKET_LABEL[bucket]
}

export function resolveAirHotelItemBucket(
  overseasBucket: OverseasDisplayBucketId | null | undefined,
): OverseasDisplayBucketId {
  return overseasBucket ?? 'other'
}

/** 등록 풀 → 메가메뉴 권역 칩 (상품 0건 권역 제외, 순서 고정) */
export function buildAirHotelRegionChips(
  items: ReadonlyArray<{ overseasBucket?: OverseasDisplayBucketId | null }>,
): AirHotelRegionChip[] {
  const counts = new Map<OverseasDisplayBucketId, number>()
  for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) counts.set(id, 0)
  for (const it of items) {
    const b = resolveAirHotelItemBucket(it.overseasBucket)
    counts.set(b, (counts.get(b) ?? 0) + 1)
  }
  return OVERSEAS_DISPLAY_BUCKET_ORDER.map((id) => ({
    id,
    label: OVERSEAS_DISPLAY_BUCKET_LABEL[id],
    count: counts.get(id) ?? 0,
  })).filter((c) => c.count > 0)
}

export { OVERSEAS_DISPLAY_BUCKET_ORDER as AIR_HOTEL_REGION_SECTION_ORDER }
