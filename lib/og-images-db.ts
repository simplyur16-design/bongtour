/**
 * 페이지별 OG 이미지 — Prisma `page_og_images` + Supabase Storage (`page-og/…`).
 */

import type { PageOgImage } from '@prisma/client'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import {
  getOgSeasonPageKey,
  getSeasonalDefaultOgImagePath,
  isOgSeasonPageKey,
  OG_SEASON_PAGE_KEYS,
  staticOgPathForSeasonKey,
  type OgSeasonPageKey,
} from '@/lib/og-image-seasonal'
import { prisma } from '@/lib/prisma'
import { isObjectStorageConfigured, removeStorageObject, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'

export const VALID_PAGE_KEYS = [
  ...OG_SEASON_PAGE_KEYS,
  'overseas',
  'private-trip',
  'training',
  'esim',
] as const

export type OgPageKey = (typeof VALID_PAGE_KEYS)[number]

const VALID_SET = new Set<string>(VALID_PAGE_KEYS)

export function isValidOgPageKey(key: string): key is OgPageKey {
  return VALID_SET.has(key)
}

function staticPathForPage(pageKey: string): string {
  if (isOgSeasonPageKey(pageKey)) return staticOgPathForSeasonKey(pageKey)
  return `/og/${pageKey}.webp`
}

async function loadOgImageUrl(pageKey: string): Promise<string | null> {
  const row = await prisma.pageOgImage.findUnique({ where: { pageKey } })
  const url = row?.imageUrl?.trim()
  return url || null
}

/**
 * OG 이미지 URL (절대 또는 `/` 시작 상대).
 * `default` = 현재 KST 시즌 키. 관리자 업로드가 있으면 항상 우선.
 */
export async function getOgImageForPage(pageKey: string): Promise<string> {
  const key = (pageKey ?? '').trim()
  const resolvedKey: string =
    key === 'default' || !key ? getOgSeasonPageKey() : key

  if (shouldSkipDbAtBuild()) {
    if (isOgSeasonPageKey(resolvedKey)) return staticPathForPage(resolvedKey)
    if (VALID_SET.has(resolvedKey)) return staticPathForPage(resolvedKey)
    return getSeasonalDefaultOgImagePath()
  }

  try {
    if (isOgSeasonPageKey(resolvedKey)) {
      const uploaded = await loadOgImageUrl(resolvedKey)
      if (uploaded) return uploaded
      return staticPathForSeasonKey(resolvedKey)
    }
    if (VALID_SET.has(resolvedKey)) {
      const uploaded = await loadOgImageUrl(resolvedKey)
      if (uploaded) return uploaded
      return staticPathForPage(resolvedKey)
    }
  } catch (e) {
    console.warn('[og-images-db] getOgImageForPage DB error, using static fallback', {
      pageKey: key,
      resolvedKey,
      message: e instanceof Error ? e.message : String(e),
    })
  }

  if (isOgSeasonPageKey(resolvedKey)) return staticPathForSeasonKey(resolvedKey)
  if (VALID_SET.has(resolvedKey)) return staticPathForPage(resolvedKey)
  return getSeasonalDefaultOgImagePath()
}

export type OgImageMetadataEntry = { url: string; width: number; height: number; alt: string }

/** Next.js `metadata.openGraph.images` 한 줄 구성 */
export async function ogImagesForMetadata(pageKey: string, alt: string): Promise<OgImageMetadataEntry[]> {
  const url = await getOgImageForPage(pageKey)
  return [{ url, width: 1200, height: 630, alt }]
}

export async function getAllOgImages(): Promise<Record<OgPageKey, PageOgImage | null>> {
  const rows = await prisma.pageOgImage.findMany({
    where: { pageKey: { in: [...VALID_PAGE_KEYS] } },
  })
  const byKey = new Map(rows.map((r) => [r.pageKey, r]))
  const out = {} as Record<OgPageKey, PageOgImage | null>
  for (const k of VALID_PAGE_KEYS) {
    out[k] = byKey.get(k) ?? null
  }
  return out
}

export type UpsertOgImageInput = {
  pageKey: OgPageKey
  imageUrl: string
  storagePath: string | null
  width?: number | null
  height?: number | null
  fileSize?: number | null
  uploadedBy?: string | null
}

export async function upsertOgImage(input: UpsertOgImageInput): Promise<PageOgImage> {
  const {
    pageKey,
    imageUrl,
    storagePath,
    width,
    height,
    fileSize,
    uploadedBy,
  } = input
  return prisma.pageOgImage.upsert({
    where: { pageKey },
    create: {
      pageKey,
      imageUrl,
      storagePath: storagePath ?? null,
      width: width ?? null,
      height: height ?? null,
      fileSize: fileSize ?? null,
      uploadedBy: uploadedBy ?? null,
    },
    update: {
      imageUrl,
      storagePath: storagePath ?? null,
      width: width ?? null,
      height: height ?? null,
      fileSize: fileSize ?? null,
      uploadedBy: uploadedBy ?? null,
    },
  })
}

async function removeStorageIfConfigured(objectKey: string | null | undefined): Promise<void> {
  if (!objectKey?.trim() || !isObjectStorageConfigured()) return
  try {
    await removeStorageObject(objectKey.trim())
  } catch (e) {
    console.warn('[og-images-db] removeStorageObject', { objectKey, message: e instanceof Error ? e.message : String(e) })
  }
}

/** DB 행 삭제 + Storage 객체 삭제 → 해당 시즌은 정적 fallback */
export async function deleteOgImage(pageKey: string): Promise<void> {
  const key = (pageKey ?? '').trim()
  if (!key) return
  const row = await prisma.pageOgImage.findUnique({ where: { pageKey: key } })
  if (!row) return

  const path = row.storagePath?.trim() || tryParseObjectKeyFromPublicUrl(row.imageUrl)
  await removeStorageIfConfigured(path)

  await prisma.pageOgImage.delete({ where: { pageKey: key } }).catch(() => {
    /* 이미 없음 */
  })
}

/** 교체 업로드 전 기존 객체 제거 */
export async function deletePreviousOgStorageIfAny(pageKey: OgPageKey): Promise<void> {
  const row = await prisma.pageOgImage.findUnique({ where: { pageKey } })
  if (!row) return
  const path = row.storagePath?.trim() || tryParseObjectKeyFromPublicUrl(row.imageUrl)
  await removeStorageIfConfigured(path)
}

/** 관리자 UI — 업로드 없을 때 보여줄 정적 미리보기 경로 */
export function staticOgPreviewPathForPageKey(pageKey: OgPageKey): string {
  return staticPathForPage(pageKey)
}

export type { OgSeasonPageKey }
