/**
 * 사진 풀: 관리자 업로드 + Pexels/제미나이에서 가져온 사진 저장.
 * process-images 우선순위: PhotoPool → DestinationImageSet → Pexels → 제미나이
 *
 * 저장소: **Supabase Storage** (공개 HTTPS URL을 DB `filePath`에 저장).
 * 로컬 `public/uploads/photos`에는 더 이상 쓰지 않음 — URL이 바뀌며 깜빡이는 문제 방지.
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { convertToWebp } from '@/lib/image-to-webp'
import { buildWebpFilename } from '@/lib/webp-filename'
import {
  buildPhotoPoolObjectKey,
  isObjectStorageConfigured,
  removeStorageObject,
  tryParseObjectKeyFromPublicUrl,
  uploadStorageObject,
} from '@/lib/object-storage'

/** 레거시: 로컬 상대 경로 (마이그레이션·삭제용) */
const LEGACY_WEB_PATH_PREFIX = '/uploads/photos/'

export type PoolPhotoRecord = {
  id: string
  cityName: string
  attractionName: string
  source: string
  filePath: string
  sortOrder: number
  createdAt: Date
}

/**
 * 도시별 풀 사진 5장 (메인 1 + 일정 4) 반환. sortOrder 순, 없으면 빈 배열.
 */
export async function getPoolPhotosForDestination(
  prisma: { photoPool: { findMany: (args: { where: { cityName: string }; orderBy: { sortOrder: 'asc' }; take: number }) => Promise<PoolPhotoRecord[]> } },
  destination: string
): Promise<PoolPhotoRecord[]> {
  const city = (destination ?? '').trim()
  if (!city) return []
  const list = await prisma.photoPool.findMany({
    where: { cityName: city },
    orderBy: { sortOrder: 'asc' },
    take: 5,
  })
  return list as PoolPhotoRecord[]
}

/**
 * WebP 버퍼를 Supabase Storage에 올리고 PhotoPool 레코드 생성/갱신.
 * 같은 `buildWebpFilename`이면 동일 object key로 덮어쓰기 — 레거시 로컬 행이 있으면 URL로 교체.
 */
export async function savePhotoToPool(
  prisma: PrismaClient,
  buffer: Buffer,
  cityName: string,
  attractionName: string,
  source: string,
  options?: { convertToWebpFirst?: boolean; maxWidth?: number; quality?: number }
): Promise<PoolPhotoRecord> {
  if (!isObjectStorageConfigured()) {
    throw new Error(
      'Supabase Storage가 설정되지 않았습니다. SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 선택 SUPABASE_IMAGE_BUCKET을 .env에 설정하세요.'
    )
  }

  let data = buffer
  if (options?.convertToWebpFirst !== false) {
    const converted = await convertToWebp(buffer, {
      maxWidth: options?.maxWidth ?? 1600,
      quality: options?.quality ?? 82,
    })
    data = converted.buffer
  }

  const filename = buildWebpFilename(cityName, attractionName, source)
  const objectKey = buildPhotoPoolObjectKey(filename)
  const storageLeaf = objectKey.startsWith('photo-pool/') ? objectKey.slice('photo-pool/'.length) : objectKey
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: data,
    contentType: 'image/webp',
  })

  const legacyPath = LEGACY_WEB_PATH_PREFIX + filename
  const city = cityName.trim()

  const existing = await prisma.photoPool.findFirst({
    where: {
      cityName: city,
      OR: [
        { filePath: legacyPath },
        { filePath: publicUrl },
        { filePath: { endsWith: filename } },
        { filePath: { endsWith: storageLeaf } },
      ],
    },
  })

  if (existing) {
    const oldPath = existing.filePath
    if (oldPath.startsWith('/uploads/')) {
      try {
        const abs = path.join(process.cwd(), 'public', oldPath.replace(/^\//, ''))
        await fs.unlink(abs)
      } catch {
        /* ignore */
      }
    } else {
      const oldKey = tryParseObjectKeyFromPublicUrl(oldPath)
      if (oldKey && oldKey !== objectKey) {
        try {
          await removeStorageObject(oldKey)
        } catch {
          /* ignore */
        }
      }
    }

    return prisma.photoPool.update({
      where: { id: existing.id },
      data: {
        cityName: city,
        attractionName: attractionName.trim(),
        source: (source || 'Upload').trim(),
        filePath: publicUrl,
      },
    }) as Promise<PoolPhotoRecord>
  }

  const lastInCity = await prisma.photoPool.findFirst({
    where: { cityName: city },
    orderBy: { sortOrder: 'desc' },
  })
  const nextOrder = (lastInCity?.sortOrder ?? -1) + 1

  return prisma.photoPool.create({
    data: {
      cityName: city,
      attractionName: attractionName.trim(),
      source: (source || 'Upload').trim(),
      filePath: publicUrl,
      sortOrder: nextOrder,
    },
  }) as Promise<PoolPhotoRecord>
}

/**
 * URL에서 이미지 다운로드 후 풀에 저장 (Pexels/제미나이 결과 보강용)
 */
export async function savePhotoFromUrl(
  prisma: Parameters<typeof savePhotoToPool>[0],
  imageUrl: string,
  cityName: string,
  attractionName: string,
  source: string
): Promise<PoolPhotoRecord | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return savePhotoToPool(prisma, buf, cityName, attractionName, source, {
      convertToWebpFirst: true,
      maxWidth: 1600,
      quality: 82,
    })
  } catch {
    return null
  }
}
