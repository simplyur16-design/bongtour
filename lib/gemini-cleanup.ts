/**
 * Gemini 생성 이미지 정리: 참조되지 않고 유예기간이 지난 파일만 삭제.
 * - Product.bgImageUrl에 저장된 경로는 절대 삭제하지 않음.
 * - public/uploads/gemini/*.png 중 참조되지 않으며 수정 시각이 N일 초과인 파일만 삭제 대상.
 */

import { readdir, stat, unlink } from 'fs/promises'
import path from 'path'
import type { PrismaClient } from '@prisma/client'

const UPLOAD_DIR = 'public/uploads/gemini'
const WEB_PREFIX = '/uploads/gemini/'
/** 미선택 후보 파일 유예기간(일). 이 기간이 지나면 정리 대상. */
export const GEMINI_CLEANUP_GRACE_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** 정규화: 항상 /uploads/gemini/xxx 형태로 비교 */
function normalizeWebPath(url: string | null): string | null {
  if (!url || typeof url !== 'string') return null
  const t = url.trim()
  if (!t) return null
  const normalized = t.startsWith('/') ? t : `/${t}`
  if (!normalized.startsWith(WEB_PREFIX)) return null
  return normalized
}

/**
 * Product.bgImageUrl 중 /uploads/gemini/... 경로만 수집해 Set 반환.
 * 이 Set에 들어 있는 경로는 삭제 대상에서 제외한다.
 */
export async function getReferencedGeminiPaths(prisma: PrismaClient): Promise<Set<string>> {
  const products = await prisma.product.findMany({
    where: { bgImageUrl: { not: null } },
    select: { bgImageUrl: true },
  })
  const set = new Set<string>()
  for (const p of products) {
    const n = normalizeWebPath(p.bgImageUrl)
    if (n) set.add(n)
  }
  return set
}

/**
 * public/uploads/gemini 디렉터리 내 파일명 목록 반환.
 * .png만 대상으로 함.
 */
export async function listGeminiUploadFilenames(): Promise<string[]> {
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png')).map((e) => e.name)
  } catch {
    return []
  }
}

export type CleanupResult = {
  scannedCount: number
  preservedCount: number
  deletedCount: number
  deletedFiles: string[]
  dryRun: boolean
}

/**
 * 참조되지 않고 유예기간이 지난 Gemini 업로드 파일을 삭제(또는 dryRun 시 목록만 반환).
 * 참조 중인 파일은 절대 삭제하지 않는다.
 */
export async function runGeminiCleanup(
  prisma: PrismaClient,
  options: { dryRun?: boolean; graceDays?: number } = {}
): Promise<CleanupResult> {
  const dryRun = options.dryRun === true
  const graceDays = options.graceDays ?? GEMINI_CLEANUP_GRACE_DAYS
  const graceMs = graceDays * MS_PER_DAY
  const now = Date.now()

  const [referencedSet, filenames] = await Promise.all([
    getReferencedGeminiPaths(prisma),
    listGeminiUploadFilenames(),
  ])

  const dir = path.join(process.cwd(), UPLOAD_DIR)
  const toDelete: string[] = []
  let preservedCount = 0

  for (const filename of filenames) {
    const webPath = WEB_PREFIX + filename
    if (referencedSet.has(webPath)) {
      preservedCount++
      continue
    }
    const filePath = path.join(dir, filename)
    let mtimeMs: number
    try {
      const st = await stat(filePath)
      mtimeMs = st.mtimeMs
    } catch {
      preservedCount++
      continue
    }
    if (now - mtimeMs < graceMs) {
      preservedCount++
      continue
    }
    toDelete.push(filename)
  }

  const deletedFiles: string[] = []
  if (!dryRun && toDelete.length > 0) {
    for (const filename of toDelete) {
      const filePath = path.join(dir, filename)
      try {
        await unlink(filePath)
        deletedFiles.push(filename)
      } catch (e) {
        console.warn('[gemini-cleanup] unlink failed:', filename, e)
      }
    }
  } else if (dryRun) {
    deletedFiles.push(...toDelete)
  }

  return {
    scannedCount: filenames.length,
    preservedCount,
    deletedCount: deletedFiles.length,
    deletedFiles,
    dryRun,
  }
}
