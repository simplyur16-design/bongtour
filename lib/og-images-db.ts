/**
 * 페이지별 OG 이미지 — Prisma `page_og_images` + Supabase Storage (`page-og/…`).
 */

import type { PageOgImage } from '../prisma-gen-runtime'
import { prisma } from '@/lib/prisma'
import { isObjectStorageConfigured, removeStorageObject, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'

export const VALID_PAGE_KEYS = [
  'default',
  'overseas',
  'private-trip',
  'domestic',
  'training',
  'esim',
] as const

export type OgPageKey = (typeof VALID_PAGE_KEYS)[number]

const VALID_SET = new Set<string>(VALID_PAGE_KEYS)

export function isValidOgPageKey(key: string): key is OgPageKey {
  return VALID_SET.has(key)
}

function staticPathForPage(pageKey: string): string {
  return `/og/${pageKey}.png`
}

/**
 * OG 이미지 URL (절대 또는 `/` 시작 상대). DB/네트워크 오류 시 정적 경로로 폴백.
 */
export async function getOgImageForPage(pageKey: string): Promise<string> {
  const key = (pageKey ?? '').trim()
  try {
    if (key && VALID_SET.has(key)) {
      const row = await prisma.pageOgImage.findUnique({ where: { pageKey: key } })
      if (row?.imageUrl?.trim()) return row.imageUrl.trim()
    }
    const def = await prisma.pageOgImage.findUnique({ where: { pageKey: 'default' } })
    if (def?.imageUrl?.trim()) return def.imageUrl.trim()
  } catch (e) {
    console.warn('[og-images-db] getOgImageForPage DB error, using static fallback', {
      pageKey: key,
      message: e instanceof Error ? e.message : String(e),
    })
  }
  if (key && VALID_SET.has(key)) return staticPathForPage(key)
  return '/og/default.png'
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

/** DB 행 삭제 + 알려진 storagePath(또는 imageUrl에서 파싱한 키)로 Storage 객체 삭제 */
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
