export type ScheduleImageLike = {
  day?: number
  imageUrl?: string | null
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
}

export function getFinalScheduleDayImageUrl(day: ScheduleImageLike | null | undefined): string | null {
  if (!day?.imageUrl) return null
  const imageUrl = String(day.imageUrl).trim()
  if (!imageUrl) return null
  if (day.imageManualSelected === true) return imageUrl
  if (day.imageSelectionMode === 'library-reuse') return imageUrl
  return imageUrl
}

export function getFinalCoverImageUrl(options: {
  bgImageUrl?: string | null
  scheduleDays?: ScheduleImageLike[] | null
}): string | null {
  if (options.bgImageUrl && String(options.bgImageUrl).trim()) return String(options.bgImageUrl).trim()
  if (Array.isArray(options.scheduleDays)) {
    for (const day of options.scheduleDays) {
      const hit = getFinalScheduleDayImageUrl(day)
      if (hit) return hit
    }
  }
  return null
}
