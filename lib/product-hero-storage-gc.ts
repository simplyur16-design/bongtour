/**
 * 상품 대표 히어로 이미지(cities/*, places/*) Supabase 객체 GC 판별 로직.
 * 삭제 IO는 스크립트·object-storage에서 수행.
 */

import { tryParseObjectKeyFromPublicUrl } from '@/lib/object-storage'
import { HERO_FILENAME_SOURCE_SEGMENTS } from '@/lib/product-hero-image-source-type'

export const DEFAULT_PRODUCT_HERO_GC_ROOTS = ['cities', 'places'] as const

export function normalizeStorageObjectKey(key: string): string {
  return key.replace(/^\/+/, '').replace(/\/+/g, '/').trim()
}

export function keyMatchesAnyPrefix(key: string, prefixes: string[]): boolean {
  const k = normalizeStorageObjectKey(key)
  for (const raw of prefixes) {
    const p = raw.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!p) continue
    if (k === p || k.startsWith(`${p}/`)) return true
  }
  return false
}

/** 신규 규칙: `{...}-{canonicalSource}-{sourceId}` — sourceId 앞 토큰이 HERO_FILENAME_SOURCE_SEGMENTS 에 속함 */
export function isNewFormatProductHeroBasename(basenameWithoutExt: string): boolean {
  const parts = basenameWithoutExt.split('-').filter(Boolean)
  if (parts.length < 3) return false
  const source = parts[parts.length - 2]!
  return HERO_FILENAME_SOURCE_SEGMENTS.has(source)
}

/**
 * 구형 Pexels 재호스팅 파일명: 마지막 토큰이 숫자 id(pexels photo id)이고,
 * 바로 앞 토큰이 canonical source 가 아님 (예: dragon-bridge-987654).
 */
export function isLegacyPexelsStyleHeroBasename(basenameWithoutExt: string): boolean {
  if (isNewFormatProductHeroBasename(basenameWithoutExt)) return false
  const parts = basenameWithoutExt.split('-').filter(Boolean)
  if (parts.length < 2) return false
  const last = parts[parts.length - 1]!
  return /^\d+$/.test(last)
}

export function extractTrailingNumericIdFromLegacyBasename(basenameWithoutExt: string): string | null {
  if (!isLegacyPexelsStyleHeroBasename(basenameWithoutExt)) return null
  const parts = basenameWithoutExt.split('-').filter(Boolean)
  return parts[parts.length - 1] ?? null
}

export function objectKeyDirAndBasename(objectKey: string): { dir: string; basename: string } {
  const k = normalizeStorageObjectKey(objectKey)
  const li = k.lastIndexOf('/')
  if (li < 0) return { dir: '', basename: k }
  return { dir: k.slice(0, li), basename: k.slice(li + 1) }
}

export function basenameWithoutExtension(basename: string): string {
  const li = basename.lastIndexOf('.')
  if (li <= 0) return basename
  return basename.slice(0, li)
}

/** 동일 폴더에 `{anything}-{source}-{numericId}.ext` 형태(신규)가 하나라도 있으면 true */
export function folderHasNewFormatWithNumericId(
  dir: string,
  numericId: string,
  allObjectKeys: Set<string>,
  sourceSegments: ReadonlySet<string> = HERO_FILENAME_SOURCE_SEGMENTS
): boolean {
  const prefix = dir ? `${dir}/` : ''
  for (const k of allObjectKeys) {
    if (!k.startsWith(prefix)) continue
    const rest = prefix ? k.slice(prefix.length) : k
    if (rest.includes('/')) continue
    const baseNoExt = basenameWithoutExtension(rest)
    if (!isNewFormatProductHeroBasename(baseNoExt)) continue
    for (const seg of sourceSegments) {
      if (baseNoExt.endsWith(`-${seg}-${numericId}`)) return true
    }
  }
  return false
}

/** 신규 규칙 파일명(확장자 제거)만 dir → Set 으로 묶어 supersede 판별을 O(1)~O(폴더 파일 수)로 */
export function buildNewFormatBasenamesByDir(allObjectKeys: Iterable<string>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>()
  for (const key of allObjectKeys) {
    const k = normalizeStorageObjectKey(key)
    const { dir, basename } = objectKeyDirAndBasename(k)
    if (basename.includes('/')) continue
    const baseNoExt = basenameWithoutExtension(basename)
    if (!isNewFormatProductHeroBasename(baseNoExt)) continue
    let set = m.get(dir)
    if (!set) {
      set = new Set()
      m.set(dir, set)
    }
    set.add(baseNoExt)
  }
  return m
}

export function folderHasNewFormatWithNumericIdFromIndex(
  dir: string,
  numericId: string,
  newFormatByDir: Map<string, Set<string>>,
  sourceSegments: ReadonlySet<string> = HERO_FILENAME_SOURCE_SEGMENTS
): boolean {
  const bases = newFormatByDir.get(dir)
  if (!bases) return false
  for (const baseNoExt of bases) {
    for (const seg of sourceSegments) {
      if (baseNoExt.endsWith(`-${seg}-${numericId}`)) return true
    }
  }
  return false
}

export type ProductHeroImageRefRow = {
  bgImageUrl: string | null
  bgImageStoragePath: string | null
}

export function collectReferencedProductHeroObjectKeys(rows: ProductHeroImageRefRow[]): Set<string> {
  const set = new Set<string>()
  for (const row of rows) {
    const p = row.bgImageStoragePath?.trim()
    if (p) set.add(normalizeStorageObjectKey(p))
    const u = row.bgImageUrl?.trim()
    if (u) {
      const k = tryParseObjectKeyFromPublicUrl(u)
      if (k) set.add(normalizeStorageObjectKey(k))
    }
  }
  return set
}

export type ProductHeroGcCandidateReason =
  | 'unreferenced'
  | 'legacy_filename'
  | 'superseded_by_new_format_in_folder'
  | 'skipped_not_legacy'
  | 'skipped_referenced'
  | 'skipped_min_age'
  | 'skipped_prefix'
  | 'skipped_require_superseded_not_met'

export type ProductHeroGcRow = {
  objectKey: string
  referenced: boolean
  legacyFilename: boolean
  supersededInFolder: boolean
  reasons: ProductHeroGcCandidateReason[]
  created_at?: string
  updated_at?: string
}

export function classifyProductHeroStorageKey(params: {
  objectKey: string
  referencedKeys: Set<string>
  allKeys: Set<string>
  /** 있으면 supersede 판별에 사용(대량 스캔 시 권장) */
  newFormatBasenamesByDir?: Map<string, Set<string>> | null
  /** true이면 동일 폴더에 신규 규칙 파일(같은 숫자 id)이 있을 때만 legacy 후보 인정 */
  requireSupersededByNewFormat: boolean
  /** supersede 판별 시 허용할 source 세그먼트(예: pexels만). null이면 전체 canonical */
  supersedeSourceSegments?: ReadonlySet<string> | null
}): ProductHeroGcRow {
  const key = normalizeStorageObjectKey(params.objectKey)
  const referenced = params.referencedKeys.has(key)
  const { dir, basename } = objectKeyDirAndBasename(key)
  const baseNoExt = basenameWithoutExtension(basename)
  const legacyFilename = isLegacyPexelsStyleHeroBasename(baseNoExt)
  const numericId = extractTrailingNumericIdFromLegacyBasename(baseNoExt)
  const segs = params.supersedeSourceSegments ?? HERO_FILENAME_SOURCE_SEGMENTS
  const supersededInFolder =
    numericId != null
      ? params.newFormatBasenamesByDir
        ? folderHasNewFormatWithNumericIdFromIndex(dir, numericId, params.newFormatBasenamesByDir, segs)
        : folderHasNewFormatWithNumericId(dir, numericId, params.allKeys, segs)
      : false

  const reasons: ProductHeroGcCandidateReason[] = []
  if (referenced) reasons.push('skipped_referenced')
  if (!referenced) reasons.push('unreferenced')
  if (!legacyFilename) reasons.push('skipped_not_legacy')
  else reasons.push('legacy_filename')
  if (legacyFilename && supersededInFolder) reasons.push('superseded_by_new_format_in_folder')
  if (params.requireSupersededByNewFormat && legacyFilename && !supersededInFolder) {
    reasons.push('skipped_require_superseded_not_met')
  }

  return {
    objectKey: key,
    referenced,
    legacyFilename,
    supersededInFolder,
    reasons,
    created_at: undefined,
    updated_at: undefined,
  }
}

export function isGcDeletionCandidate(row: ProductHeroGcRow, requireSuperseded: boolean): boolean {
  if (row.referenced) return false
  if (!row.legacyFilename) return false
  if (requireSuperseded && !row.supersededInFolder) return false
  return true
}
