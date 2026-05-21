/**
 * 등록 확정 시 Product.schedule JSON — imageKeyword·imageKeyword2 SSOT 일괄 적용.
 */
import { buildProductScheduleJsonForDb } from '@/lib/schedule-image-keyword-persist'

export type RegisterScheduleJsonInput = {
  day: number
  title?: string | null
  description?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  routeText?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
}

export function buildRegisterProductScheduleJson(
  parsedSchedule: RegisterScheduleJsonInput[],
  mapExtra?: (row: RegisterScheduleJsonInput & { imageKeyword: string; imageKeyword2: string | null }) => Record<string, unknown>,
): string {
  return buildProductScheduleJsonForDb(
    parsedSchedule.map((day) => ({
      day: day.day,
      title: day.title ?? '',
      description: day.description ?? '',
      routeText: day.routeText ?? null,
      imageKeyword: String(day.imageKeyword ?? '').trim(),
      imageKeyword2: day.imageKeyword2 ?? null,
      imageUrl: day.imageUrl ?? null,
      imageUrl2: day.imageUrl2 ?? null,
    })),
    mapExtra as Parameters<typeof buildProductScheduleJsonForDb>[1],
  )
}
