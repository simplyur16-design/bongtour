/**
 * 등록대기 사진 완결 — 커버 + 일정 일차 이미지.
 * REGRESSION-FREEZE[pending-approve-photos-ready]: 사진 전 registered 금지 — manifest
 * REGRESSION-FREEZE[admin-pending-list-timeout]: 목록 photosReady는 SEO 캡션 파싱 없이 URL만 — manifest
 */
import { getFinalScheduleDayImageUrl } from '@/lib/final-image-selection'
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'
import { isRegisterScheduleNoPlacePhotoDay } from '@/lib/register-schedule-day-summary-finalize'

/** 출발·귀국·공항 이동일이고 관광 장소가 없을 때만 사진을 요구하지 않는다. */
export function scheduleDayPhotoNotRequired(
  row: { day?: number; title?: string | null; routeText?: string | null; hotelText?: string | null },
  maxDay: number,
): boolean {
  const text = `${row.title ?? ''} ${row.routeText ?? ''}`
  const travel = /귀국|출발|공항/.test(text) || (maxDay >= 2 && Number(row.day) === maxDay)
  if (!travel) return false
  return isRegisterScheduleNoPlacePhotoDay(row, maxDay)
}

export function productScheduleNeedsImages(schedule: string | null | undefined): boolean {
  if (!schedule || typeof schedule !== 'string') return false
  try {
    const parsed = JSON.parse(schedule) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return false
    const rows = parsed.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>
    const maxDay = rows.reduce((m, row) => Math.max(m, Number(row.day) || 0), 0)
    return rows.some((row) => {
      const dayRow = {
        day: Number(row.day) || 0,
        title: typeof row.title === 'string' ? row.title : null,
        routeText: typeof row.routeText === 'string' ? row.routeText : null,
        hotelText: typeof row.hotelText === 'string' ? row.hotelText : null,
      }
      // REGRESSION-FREEZE[photo-skip-no-place-day]: 이동·귀국처럼 장소가 없는 날은 사진 필수가 아니다 — manifest
      if (scheduleDayPhotoNotRequired(dayRow, maxDay)) return false
      if (registerScheduleDayIsCityOnlyPhotoSkip(dayRow)) return false
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
