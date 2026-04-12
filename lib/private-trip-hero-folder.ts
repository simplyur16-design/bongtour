import fs from 'fs'
import path from 'path'
import { PRIVATE_TRIP_HERO_FOLDER_PUBLIC } from '@/lib/private-trip-hero-constants'
import { getPrivateTripHeroSlides } from '@/lib/private-trip-hero-slides'
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
  return urls.map((imageUrl) => {
    const rawName = decodeURIComponent(imageUrl.split('/').pop() ?? '').replace(/\+/g, ' ')
    const base = rawName.replace(/\.[^.]+$/i, '').replace(/[-_]+/g, ' ').trim()
    return {
      imageUrl,
      caption: base || undefined,
    }
  })
}

/**
 * 우리여행 히어로용 슬라이드: **전용 폴더에 파일이 있으면 그것만** 사용(개수 제한 없음, 상한만).
 * 폴더가 비어 있으면 JSON(`getPrivateTripHeroSlides`) 폴백.
 */
export function resolvePrivateTripManagedHeroSlides(): PrivateTripHeroSlide[] {
  const folderUrls = listPrivateTripHeroFolderImagePublicUrls()
  if (folderUrls.length > 0) {
    return folderUrlsToSlides(folderUrls)
  }
  return getPrivateTripHeroSlides()
}

/** 관리자 API: 폴더 절대 경로 + 공개 URL 목록 */
export function getPrivateTripHeroFolderListing(): { diskPath: string; publicUrls: string[] } {
  return {
    diskPath: getPrivateTripHeroFolderAbsPath(),
    publicUrls: listPrivateTripHeroFolderImagePublicUrls(),
  }
}
