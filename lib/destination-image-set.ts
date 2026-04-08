/**
 * 도시별 미리 저장한 이미지 세트 조회.
 * process-images에서 Pexels 호출 전에 사용 → 있으면 자동생성 스킵.
 */

import type { PexelsPhotoObject } from '@/lib/pexels-service'

export type ScheduleImageItem = {
  url: string
  source?: string
  photographer?: string
  originalLink?: string
}

/** DB 저장용: 메인 1장 + 일정 4장 */
export type DestinationImageSetPayload = {
  mainImageUrl: string | null
  mainImageSource: { source: string; photographer: string; originalLink: string } | null
  scheduleImageUrls: ScheduleImageItem[]
}

function toPhotoObject(
  url: string,
  source?: string | null,
  photographer?: string | null,
  originalLink?: string | null
): PexelsPhotoObject {
  return {
    url: url || '',
    source: (source as 'Pexels') ?? 'Pexels',
    photographer: photographer ?? 'Pexels',
    originalLink: originalLink ?? 'https://www.pexels.com',
  }
}

/**
 * 도시명으로 미리 저장된 이미지 세트 조회.
 * 메인 1장 + 일정 4장이 모두 있으면 반환, 하나라도 없으면 null.
 */
export async function getPreMadeImageSet(
  prisma: { destinationImageSet: { findUnique: (args: { where: { destinationName: string } }) => Promise<{
    mainImageUrl: string | null
    mainImageSource: string | null
    scheduleImageUrls: string | null
  } | null> } },
  destinationName: string
): Promise<{ mainPhoto: PexelsPhotoObject; schedulePhotos: PexelsPhotoObject[] } | null> {
  const name = (destinationName ?? '').trim()
  if (!name) return null

  const row = await prisma.destinationImageSet.findUnique({
    where: { destinationName: name },
  })
  if (!row?.mainImageUrl || !row.mainImageUrl.startsWith('http')) return null

  let scheduleItems: ScheduleImageItem[] = []
  if (row.scheduleImageUrls) {
    try {
      const parsed = JSON.parse(row.scheduleImageUrls) as unknown
      scheduleItems = Array.isArray(parsed)
        ? parsed.filter((x: unknown) => x && typeof (x as ScheduleImageItem).url === 'string')
        : []
    } catch {
      scheduleItems = []
    }
  }

  // 일정 4장 채워져 있어야 "미리 저장 세트"로 인정
  if (scheduleItems.length < 4) return null

  let mainSource: { source: string; photographer: string; originalLink: string } = {
    source: 'Pexels',
    photographer: 'Pexels',
    originalLink: 'https://www.pexels.com',
  }
  if (row.mainImageSource) {
    try {
      const parsed = JSON.parse(row.mainImageSource) as Record<string, string>
      if (parsed.source) mainSource = { source: parsed.source, photographer: parsed.photographer ?? 'Pexels', originalLink: parsed.originalLink ?? mainSource.originalLink }
    } catch {
      // keep default
    }
  }

  const mainPhoto: PexelsPhotoObject = {
    url: row.mainImageUrl,
    source: mainSource.source as 'Pexels',
    photographer: mainSource.photographer,
    originalLink: mainSource.originalLink,
  }

  const schedulePhotos: PexelsPhotoObject[] = scheduleItems.slice(0, 4).map((item) =>
    toPhotoObject(item.url, item.source, item.photographer, item.originalLink)
  )

  return { mainPhoto, schedulePhotos }
}
