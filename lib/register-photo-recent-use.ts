/**
 * 사진 최근 사용 정보(읽기 전용) — AssetUsageLog(일차 사진 교체 이력) + 같은 목적지 상품 대표 사진.
 * register-photo-score 의 감점·같은 도시 돌려쓰기에 쓴다. 쓰기 없음, 가격 필드 읽지 않음.
 * REGRESSION-FREEZE[register-photo-score]
 */
import type { PrismaClient } from '@prisma/client'
import {
  normPhotoUrl,
  RECENT_USE_WINDOW_DAYS,
  type RecentUse,
  type RecentUseIndex,
} from '@/lib/register-photo-score'

type UseRow = { url: string; productId: string; at: Date | null; sameCity: boolean }

/** 순수: 사용 행 → 색인 (pool 주소 → pexels:id 별칭 포함) */
export function buildRecentUseIndex(
  rows: readonly UseRow[],
  poolAlias: ReadonlyMap<string, string[]>,
  now: Date = new Date()
): RecentUseIndex {
  const idx: RecentUseIndex = new Map()
  for (const r of rows) {
    const base = normPhotoUrl(r.url)
    if (!base) continue
    for (const key of [base, ...(poolAlias.get(base) ?? [])]) {
      const cur: RecentUse = idx.get(key) ?? { uses: 0, lastUsedDaysAgo: null, sameCityUses: 0 }
      cur.uses += 1
      if (r.sameCity) cur.sameCityUses += 1
      if (r.at) {
        const d = Math.max(0, Math.floor((now.getTime() - r.at.getTime()) / 86_400_000))
        if (cur.lastUsedDaysAgo == null || d < cur.lastUsedDaysAgo) cur.lastUsedDaysAgo = d
      }
      idx.set(key, cur)
    }
  }
  return idx
}

export async function loadRecentUseIndex(
  prisma: PrismaClient,
  p: { productId: string; destination: string; windowDays?: number }
): Promise<RecentUseIndex> {
  try {
    const since = new Date(Date.now() - (p.windowDays ?? RECENT_USE_WINDOW_DAYS) * 86_400_000)
    const logs = await prisma.assetUsageLog.findMany({
      where: { usedAt: { gte: since }, productId: { not: p.productId }, assetPath: { not: null } },
      select: { assetPath: true, productId: true, usedAt: true },
      orderBy: { usedAt: 'desc' },
      take: 5000,
    })
    const dest = p.destination.trim()
    const sameCityProducts = dest
      ? await prisma.product.findMany({
          where: { destination: dest, id: { not: p.productId } },
          select: { id: true, bgImageUrl: true, updatedAt: true },
          take: 1000,
        })
      : []
    const sameCityIds = new Set(sameCityProducts.map((x) => x.id))
    const rows: UseRow[] = logs.map((l) => ({
      url: String(l.assetPath ?? ''),
      productId: l.productId,
      at: l.usedAt,
      sameCity: sameCityIds.has(l.productId),
    }))
    for (const sp of sameCityProducts) {
      if (sp.bgImageUrl) rows.push({ url: sp.bgImageUrl, productId: sp.id, at: sp.updatedAt, sameCity: true })
    }
    const urls = [...new Set(rows.map((r) => r.url).filter(Boolean))]
    const alias = new Map<string, string[]>()
    for (let i = 0; i < urls.length; i += 500) {
      const pool = await prisma.photoPool.findMany({
        where: { filePath: { in: urls.slice(i, i + 500) } },
        select: { filePath: true, source: true, sourcePhotoId: true },
      })
      for (const pr of pool) {
        if (!pr.sourcePhotoId) continue
        alias.set(normPhotoUrl(pr.filePath), [`${pr.source.toLowerCase()}:${pr.sourcePhotoId}`])
      }
    }
    return buildRecentUseIndex(rows, alias)
  } catch (e) {
    console.warn('[photo-recent-use] index load failed', e instanceof Error ? e.message : String(e))
    return new Map()
  }
}
