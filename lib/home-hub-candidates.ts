import fs from 'fs'
import path from 'path'
import { removeStorageObject, tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { homeHubCardImageSrc, type HomeHubCardImageKey } from '@/lib/home-hub-images'
import {
  getHomeHubActiveFile,
  writeHomeHubActiveMerged,
  type HomeHubActiveFile,
} from '@/lib/home-hub-resolve-images'
import type {
  HomeHubCandidateRecord,
  HomeHubCandidatesFile,
  HubImageSeasonKey,
} from '@/lib/home-hub-candidates-types'

const CANDIDATES_REL = ['public', 'data', 'home-hub-candidates.json'] as const

export type { HomeHubCandidateRecord, HomeHubCandidatesFile, HubImageSeasonKey }

function candidatesPath(): string {
  return path.join(process.cwd(), ...CANDIDATES_REL)
}

const VALID_CARD: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'esim']
const VALID_SEASON: HubImageSeasonKey[] = ['default', 'spring', 'summer', 'autumn', 'winter']

export function isValidCardKey(k: string): k is HomeHubCardImageKey {
  return VALID_CARD.includes(k as HomeHubCardImageKey)
}

export function isValidSeason(s: string): s is HubImageSeasonKey {
  return VALID_SEASON.includes(s as HubImageSeasonKey)
}

export function readHomeHubCandidates(): HomeHubCandidatesFile {
  try {
    const raw = fs.readFileSync(candidatesPath(), 'utf8')
    const j = JSON.parse(raw) as HomeHubCandidatesFile
    if (!Array.isArray(j.candidates)) return { candidates: [] }
    return { candidates: j.candidates }
  } catch {
    return { candidates: [] }
  }
}

export function writeHomeHubCandidates(data: HomeHubCandidatesFile): void {
  const dir = path.dirname(candidatesPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(candidatesPath(), JSON.stringify(data, null, 2), 'utf8')
}

export type ListHomeHubCandidatesFilter = {
  cardKey?: HomeHubCardImageKey | string
  season?: string
}

export function listHomeHubCandidates(filter?: ListHomeHubCandidatesFilter): HomeHubCandidateRecord[] {
  const { candidates } = readHomeHubCandidates()
  let list = [...candidates]
  if (filter?.cardKey) list = list.filter((c) => c.cardKey === filter.cardKey)
  if (filter?.season) list = list.filter((c) => c.season === filter.season)
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function appendHomeHubCandidates(newItems: HomeHubCandidateRecord[]): HomeHubCandidateRecord[] {
  const data = readHomeHubCandidates()
  data.candidates.push(...newItems)
  writeHomeHubCandidates(data)
  return newItems
}

/**
 * 후보를 메인 활성으로 승격. 동일 `cardKey`의 다른 후보 `isActive`/`isSelected` 해제 후
 * `home-hub-active.json` 의 해당 카드 URL·`activeSeason` 갱신.
 */
export function activateHomeHubCandidate(
  candidateId: string,
  options?: { updatedBy?: string }
): { candidate: HomeHubCandidateRecord; active: HomeHubActiveFile } {
  const data = readHomeHubCandidates()
  const idx = data.candidates.findIndex((c) => c.id === candidateId)
  if (idx < 0) throw new Error('후보를 찾을 수 없습니다.')

  const target = data.candidates[idx]
  const now = new Date().toISOString()

  /** 공개 메인은 카드당 URL 1개라, 후보 중 `isActive`도 카드 단위로 1장만 둔다. */
  for (const c of data.candidates) {
    if (c.cardKey === target.cardKey) {
      const isPick = c.id === candidateId
      c.isActive = isPick
      c.isSelected = isPick
      c.updatedAt = now
    }
  }

  writeHomeHubCandidates(data)

  const active = writeHomeHubActiveMerged({
    images: { [target.cardKey]: target.imagePath },
    activeSeason: target.season,
    lastUpdatedBy: options?.updatedBy,
  })

  return { candidate: data.candidates[idx]!, active }
}

const CANDIDATES_IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'home-hub', 'candidates')

function safeUnlinkCandidateImageFile(imagePath: string): void {
  const normalized = imagePath.trim()
  if (!normalized.startsWith('/images/home-hub/candidates/')) return
  const rel = normalized.replace(/^\//, '')
  const full = path.resolve(process.cwd(), 'public', rel)
  const relToDir = path.relative(CANDIDATES_IMAGE_DIR, full)
  if (relToDir.startsWith('..') || path.isAbsolute(relToDir)) return
  try {
    if (fs.existsSync(full)) fs.unlinkSync(full)
  } catch {
    /* ignore */
  }
}

/** Supabase Storage 공개 URL이면 객체 삭제, 레거시 로컬 후보 경로면 파일 삭제 */
async function removeStoredCandidateImage(imagePath: string): Promise<void> {
  const trimmed = imagePath.trim()
  const key = tryParseObjectKeyFromPublicUrl(trimmed)
  if (key) {
    try {
      await removeStorageObject(key)
    } catch (e) {
      console.warn('[home-hub] Storage 이미지 삭제 실패', key, e)
    }
    return
  }
  safeUnlinkCandidateImageFile(trimmed)
}

/**
 * 후보 1건 삭제: JSON에서 제거 + Supabase Storage 또는 레거시 `public/images/home-hub/candidates/` 파일 삭제.
 * 메인 활성 URL이 이 후보와 같으면 카드별 기본 이미지로 되돌림.
 */
export async function deleteHomeHubCandidate(
  candidateId: string,
  options?: { updatedBy?: string }
): Promise<{ removed: HomeHubCandidateRecord }> {
  const data = readHomeHubCandidates()
  const idx = data.candidates.findIndex((c) => c.id === candidateId)
  if (idx < 0) throw new Error('후보를 찾을 수 없습니다.')

  const target = data.candidates[idx]!
  const imageUrl = target.imagePath.trim()

  const active = getHomeHubActiveFile()
  const mainPointsHere =
    active?.images?.[target.cardKey]?.trim() === imageUrl

  await removeStoredCandidateImage(target.imagePath)

  data.candidates.splice(idx, 1)

  if (mainPointsHere) {
    writeHomeHubActiveMerged({
      images: { [target.cardKey]: homeHubCardImageSrc(target.cardKey) },
      lastUpdatedBy: options?.updatedBy,
    })
  }

  if (target.isActive || mainPointsHere) {
    const now = new Date().toISOString()
    for (const c of data.candidates) {
      if (c.cardKey === target.cardKey) {
        c.isActive = false
        c.isSelected = false
        c.updatedAt = now
      }
    }
  }

  writeHomeHubCandidates(data)
  return { removed: target }
}
