import fs from 'fs'
import path from 'path'
import {
  PRIVATE_TRIP_HERO_FOLDER_PUBLIC,
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
} from '@/lib/private-trip-hero-constants'
import { getImageStorageBucket, isObjectStorageConfigured } from '@/lib/object-storage'
import { getPrivateTripHeroSlides } from '@/lib/private-trip-hero-slides'
import { listPrivateTripHeroStoragePublicUrls } from '@/lib/private-trip-hero-supabase'
import type { PrivateTripHeroSlide } from '@/lib/private-trip-hero-types'

export { PRIVATE_TRIP_HERO_FOLDER_PUBLIC } from '@/lib/private-trip-hero-constants'

const DISK_SEGMENTS = ['public', 'images', 'private-trip-hero'] as const

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])

/** 폴더에 파일이 너무 많을 때를 대비한 상한 (운영에서 폴더만 쓰는 전제) */
const MAX_FILES = 500

/** 서버 디스크상 전용 폴더 절대 경로 (업로드·스캔 공통) */
export function getPrivateTripHeroFolderAbsPath(): string {
  return path.join(process.cwd(), ...DISK_SEGMENTS)
}

/**
 * `public/images/private-trip-hero/` 안의 이미지 파일만 읽어, 공개 URL 배열로 반환한다.
 * 하위 폴더는 보지 않음. 파일명 localeCompare 정렬.
 */
export function listPrivateTripHeroFolderImagePublicUrls(): string[] {
  const dir = getPrivateTripHeroFolderAbsPath()
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return []
  const names = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const ent of names) {
    if (!ent.isFile()) continue
    const lower = ent.name.toLowerCase()
    const dot = lower.lastIndexOf('.')
    if (dot < 0) continue
    if (!IMAGE_EXT.has(lower.slice(dot))) continue
    files.push(ent.name)
  }
  files.sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }))
  return files.slice(0, MAX_FILES).map((name) => {
    // ASCII-only 파일명은 그대로(nginx·Next 정적 일치). 그 외는 RFC3986 인코딩(레거시 호환).
    if (/^[a-zA-Z0-9._-]+$/.test(name)) {
      return `${PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/${name}`
    }
    return `${PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/${encodeURIComponent(name)}`
  })
}

function folderUrlsToSlides(urls: string[]): PrivateTripHeroSlide[] {
  return urls.map((imageUrl) => ({
    imageUrl,
    /** 파일명·스토리지 키는 공개 UI에 쓰지 않음 — 멘트는 `private-trip-hero-ops-ment` 규칙 */
    caption: undefined,
  }))
}

/**
 * 우리여행 히어로용 슬라이드.
 * Supabase Storage(`private-trip-hero/` 접두사)에 파일이 있으면 그 URL만 사용하고,
 * 없으면 `public/images/private-trip-hero/` 디스크, 그다음 JSON(`getPrivateTripHeroSlides`) 순으로 폴백한다.
 */
export async function resolvePrivateTripManagedHeroSlides(): Promise<PrivateTripHeroSlide[]> {
  if (isObjectStorageConfigured()) {
    try {
      const storageUrls = await listPrivateTripHeroStoragePublicUrls()
      if (storageUrls.length > 0) {
        return folderUrlsToSlides(storageUrls)
      }
    } catch (e) {
      console.warn('[private-trip-hero] Storage 목록 실패, 디스크·JSON 폴백', e)
    }
  }

  const folderUrls = listPrivateTripHeroFolderImagePublicUrls()
  if (folderUrls.length > 0) {
    return folderUrlsToSlides(folderUrls)
  }
  return getPrivateTripHeroSlides()
}

export type PrivateTripHeroFolderListingSource = 'supabase' | 'disk'

/** 관리자 API: 저장 위치 설명 + 공개 URL 목록 */
export async function getPrivateTripHeroFolderListing(): Promise<{
  diskPath: string
  publicUrls: string[]
  source: PrivateTripHeroFolderListingSource
}> {
  const diskPathDefault = getPrivateTripHeroFolderAbsPath()
  const diskUrls = listPrivateTripHeroFolderImagePublicUrls()

  if (isObjectStorageConfigured()) {
    try {
      const storageUrls = await listPrivateTripHeroStoragePublicUrls()
      if (storageUrls.length > 0) {
        return {
          diskPath: `Supabase Storage · ${getImageStorageBucket()}/${PRIVATE_TRIP_HERO_STORAGE_PREFIX}/`,
          publicUrls: storageUrls,
          source: 'supabase',
        }
      }
    } catch (e) {
      console.warn('[private-trip-hero] 관리자 목록: Storage 실패, 디스크 폴백', e)
    }
  }

  return {
    diskPath: diskPathDefault,
    publicUrls: diskUrls,
    source: 'disk',
  }
}
