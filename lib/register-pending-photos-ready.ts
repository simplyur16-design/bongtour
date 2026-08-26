/**
 * 등록대기 사진 완결 — 커버 + 일정 일차 이미지.
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 전 registered 금지 — manifest
 */
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'

export function productScheduleNeedsImages(schedule: string | null | undefined): boolean {
  if (!schedule || typeof schedule !== 'string') return false
  const rows = getScheduleFromProduct({ schedule })
  if (rows.length === 0) return false
  return rows.some((row) => !getFinalScheduleDayImageUrl(row))
}

export function isRegisterPendingPhotosReady(
  bgImageUrl: string | null | undefined,
  schedule: string | null | undefined,
): boolean {
  return Boolean(String(bgImageUrl ?? '').trim()) && !productScheduleNeedsImages(schedule)
}
