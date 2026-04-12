import { getFinalCoverImageUrl, type ScheduleImageLike } from '@/lib/final-image-selection'

/** 공개 상세 클라이언트용: `bgImageUrl` 없을 때 일정에서 대표 커버 URL(공항·이동 1일차 회피) */
export function coverImageUrlForTravelProductClient(product: {
  bgImageUrl?: string | null
  schedule?:
    | Array<{
        day: number
        imageUrl?: string | null
        title?: string
        description?: string
        imageKeyword?: string | null
        imageDisplayName?: string | null
        imageManualSelected?: boolean
        imageSelectionMode?: string | null
      }>
    | null
}): string | null {
  const rows: ScheduleImageLike[] | null =
    product.schedule && product.schedule.length > 0
      ? product.schedule.map((s) => ({
          day: s.day,
          imageUrl: s.imageUrl,
          title: s.title,
          description: s.description,
          imageKeyword: s.imageKeyword ?? null,
          imageDisplayName: s.imageDisplayName ?? null,
          imageManualSelected: s.imageManualSelected === true,
          imageSelectionMode: s.imageSelectionMode ?? null,
        }))
      : null
  return getFinalCoverImageUrl({ bgImageUrl: product.bgImageUrl ?? null, scheduleDays: rows })
}
