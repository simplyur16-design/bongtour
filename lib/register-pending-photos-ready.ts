/**
 * 등록대기 사진 완결 — 커버 + 일정 일차 이미지.
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 전 registered 금지 — manifest
 * REGRESSION-FREEZE[admin-pending-list-timeout]: 목록 photosReady는 SEO 캡션 파싱 없이 URL만 — manifest
 */
import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'

export function productScheduleNeedsImages(schedule: string | null | undefined): boolean {
  if (!schedule || typeof schedule !== 'string') return false
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return false
    return parsed.some((item) => {
      const row = item as Record<string, unknown>
      return !getFinalScheduleDayImageUrl({
        imageUrl: row.imageUrl != null ? String(row.imageUrl) : null,
        imageManualSelected: row.imageManualSelected === true,
        imageSelectionMode: typeof row.imageSelectionMode === 'string' ? row.imageSelectionMode : null,
      })
    })
  } catch {
    return false
  }
}

export function isRegisterPendingPhotosReady(
  bgImageUrl: string | null | undefined,
  schedule: string | null | undefined,
): boolean {
  return Boolean(String(bgImageUrl ?? '').trim()) && !productScheduleNeedsImages(schedule)
}
