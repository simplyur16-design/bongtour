/**
 * 사진 칸 교체(순수 함수). 일차 칸은 사진 관련 필드만 바꾼다 — title·description·routeText·가격·그 밖의 일정 글은 그대로.
 * 관리자가 고른 칸(imageManualSelected)은 바꾸지 않는다.
 * 교체 전 값은 되돌릴 수 있게 AssetUsageLog 노트(replaceNote)로 남긴다.
 * REGRESSION-FREEZE[photo-slot-apply]: 사진 칸만 교체·수동 칸 불변·되돌리기 기록 — manifest
 */
import { resolveProductBgImageFieldsFromPhoto } from '@/lib/product-image-source-attribution'

export type ReplacementPhoto = {
  url: string
  source: string
  photographer: string
  originalLink: string
  externalId?: string
  sight?: string
  matched?: string
}

export type PreviousSlotValue = {
  imageUrl: string | null
  imageSource: Record<string, unknown> | null
  imagePhotographer: string | null
  imageSourcePageUrl: string | null
  imageCandidateOrigin: string | null
}

export const PHOTO_REPLACE_FIELDS = ['imageUrl', 'imageSource', 'imagePhotographer', 'imageSourcePageUrl', 'imageCandidateOrigin'] as const

export function applyDayPhotoReplacement(
  scheduleJson: string | null,
  day: number,
  photo: ReplacementPhoto,
  origin: 'heal' | 'nightly',
): { schedule: string; previous: PreviousSlotValue } | { error: 'no_schedule' | 'day_not_found' | 'manual_locked' } {
  if (!scheduleJson) return { error: 'no_schedule' }
  let rows: unknown
  try {
    rows = JSON.parse(scheduleJson)
  } catch {
    return { error: 'no_schedule' }
  }
  if (!Array.isArray(rows)) return { error: 'no_schedule' }
  const idx = rows.findIndex((r, i) => Math.floor(Number((r as Record<string, unknown>)?.day)) === day || (!Number.isFinite(Number((r as Record<string, unknown>)?.day)) && i + 1 === day))
  if (idx < 0) return { error: 'day_not_found' }
  const row = rows[idx] as Record<string, unknown>
  if (row.imageManualSelected === true) return { error: 'manual_locked' }
  const prevSource = row.imageSource && typeof row.imageSource === 'object' ? (row.imageSource as Record<string, unknown>) : null
  const previous: PreviousSlotValue = {
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : null,
    imageSource: prevSource,
    imagePhotographer: typeof row.imagePhotographer === 'string' ? row.imagePhotographer : null,
    imageSourcePageUrl: typeof row.imageSourcePageUrl === 'string' ? row.imageSourcePageUrl : null,
    imageCandidateOrigin: typeof row.imageCandidateOrigin === 'string' ? row.imageCandidateOrigin : null,
  }
  const next = rows.map((r, i) =>
    i !== idx
      ? r
      : {
          ...(r as Record<string, unknown>),
          imageUrl: photo.url,
          imageSource: {
            source: photo.source,
            photographer: photo.photographer,
            originalLink: photo.originalLink,
            ...(photo.externalId ? { externalId: photo.externalId } : {}),
            cityMatch: 'meta',
            ...(photo.sight ? { sight: photo.sight } : {}),
            ...(photo.matched ? { sightMatch: photo.matched } : {}),
          },
          imagePhotographer: photo.photographer,
          imageSourcePageUrl: photo.originalLink,
          imageCandidateOrigin: origin,
        },
  )
  return { schedule: JSON.stringify(next), previous }
}

export type CoverPreviousValue = {
  bgImageUrl: string | null
  bgImageExternalId: string | null
  bgImageSource: string | null
  bgImagePhotographer: string | null
  bgImageSourceUrl: string | null
}

/** 대표 사진 칸만 바꾸는 갱신 값(다른 칸 없음) */
export function coverReplacementData(photo: ReplacementPhoto): Record<string, unknown> {
  return { bgImageUrl: photo.url, ...resolveProductBgImageFieldsFromPhoto(photo) }
}

export type ReplaceNote = {
  v: 1
  reason: string
  slot: 'day' | 'cover'
  origin: 'heal' | 'nightly'
  prev: Record<string, unknown>
}

/** AssetUsageLog.notes — 교체 전 값을 담아 되돌릴 수 있게 한다 */
export function replaceNote(input: { reason: string; slot: 'day' | 'cover'; origin: 'heal' | 'nightly'; prev: PreviousSlotValue | CoverPreviousValue }): string {
  const note: ReplaceNote = { v: 1, reason: input.reason, slot: input.slot, origin: input.origin, prev: input.prev as unknown as Record<string, unknown> }
  return `photo-replace:${JSON.stringify(note)}`
}

export function parseReplaceNote(note: string | null | undefined): ReplaceNote | null {
  if (!note || !note.startsWith('photo-replace:')) return null
  try {
    const v = JSON.parse(note.slice('photo-replace:'.length)) as ReplaceNote
    return v && v.v === 1 && v.prev && typeof v.prev === 'object' ? v : null
  } catch {
    return null
  }
}

/** 기록으로 되돌릴 때: 일차 칸 사진 필드를 교체 전 값으로 돌린 일정 JSON */
export function revertDayPhoto(scheduleJson: string, day: number, prev: PreviousSlotValue): string | null {
  let rows: unknown
  try {
    rows = JSON.parse(scheduleJson)
  } catch {
    return null
  }
  if (!Array.isArray(rows)) return null
  const idx = rows.findIndex((r) => Math.floor(Number((r as Record<string, unknown>)?.day)) === day)
  if (idx < 0) return null
  const next = rows.map((r, i) => {
    if (i !== idx) return r
    const { imageSource, imageUrl, imagePhotographer, imageSourcePageUrl, imageCandidateOrigin, ...rest } = r as Record<string, unknown>
    void imageSource
    void imageUrl
    void imagePhotographer
    void imageSourcePageUrl
    void imageCandidateOrigin
    return {
      ...rest,
      imageUrl: prev.imageUrl,
      imageSource: prev.imageSource ?? undefined,
      imagePhotographer: prev.imagePhotographer,
      imageSourcePageUrl: prev.imageSourcePageUrl,
      imageCandidateOrigin: prev.imageCandidateOrigin,
    }
  })
  return JSON.stringify(next)
}
