/**
 * 사진 풀: 관리자 업로드 + Pexels/제미나이에서 가져온 사진 저장.
 * process-images 우선순위: PhotoPool → DestinationImageSet → Pexels → 제미나이
 * 파일명: [도시명]_[명소명]_[출처].webp
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { convertToWebp } from '@/lib/image-to-webp'
import { buildWebpFilename } from '@/lib/webp-filename'

const UPLOAD_DIR = 'public/uploads/photos'
const WEB_PATH_PREFIX = '/uploads/photos/'

function getUploadDir(): string {
  return path.join(process.cwd(), UPLOAD_DIR)
}

export async function ensureUploadDir(): Promise<string> {
  const dir = getUploadDir()
  await fs.mkdir(dir, { recursive: true })
  return dir
}

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
 * WebP 버퍼를 파일로 저장하고 PhotoPool 레코드 생성. 같은 파일명이 있으면 덮어쓰고 sortOrder 유지.
 */
export async function savePhotoToPool(
  prisma: PrismaClient,
  buffer: Buffer,
  cityName: string,
  attractionName: string,
  source: string,
  options?: { convertToWebpFirst?: boolean; maxWidth?: number; quality?: number }
): Promise<PoolPhotoRecord> {
  const dir = await ensureUploadDir()
  const filename = buildWebpFilename(cityName, attractionName, source)
  const absolutePath = path.join(dir, filename)

  let data = buffer
  if (options?.convertToWebpFirst) {
    const converted = await convertToWebp(buffer, {
      maxWidth: options.maxWidth ?? 1600,
      quality: options.quality ?? 82,
    })
    data = converted.buffer
  }

  await fs.writeFile(absolutePath, data)

  const webPath = WEB_PATH_PREFIX + filename
  const city = cityName.trim()
  const existing = await prisma.photoPool.findFirst({
    where: { filePath: webPath },
    select: { sortOrder: true },
  })
  const lastInCity = await prisma.photoPool.findFirst({
    where: { cityName: city },
    orderBy: { sortOrder: 'desc' },
  })
  const nextOrder = existing != null ? existing.sortOrder : (lastInCity?.sortOrder ?? -1) + 1

  const row = await prisma.photoPool.upsert({
    where: { filePath: webPath },
    create: {
      cityName: city,
      attractionName: attractionName.trim(),
      source: (source || 'Upload').trim(),
      filePath: webPath,
      sortOrder: nextOrder,
    },
    update: {},
  })
  return row
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
