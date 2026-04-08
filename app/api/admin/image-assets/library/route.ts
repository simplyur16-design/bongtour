import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type ScheduleEntry = {
  day?: number
  imageUrl?: string | null
}

type UsageMeta = { count: number; lastUsedAt: string | null; refs: string[] }

function norm(u: string): string {
  return String(u).trim().toLowerCase()
}

/**
 * GET /api/admin/image-assets/library
 * Prisma PhotoPool + 사용 메타(일정/AssetUsageLog 스캔). 운영형 image_assets(Prisma)와는 별 테이블.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const sourceType = searchParams.get('sourceType')?.trim() || ''
    const keyword = searchParams.get('keyword')?.trim() || ''
    const sort = (searchParams.get('sort')?.trim() || 'recent-upload') as 'recent-upload' | 'recent-used' | 'most-used'
    const take = Math.max(1, Math.min(100, Number(searchParams.get('take') ?? 24)))
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))

    const where: Record<string, unknown> = {}
    if (sourceType && sourceType !== 'all') where.source = { contains: sourceType }
    if (keyword) {
      where.OR = [{ cityName: { contains: keyword } }, { attractionName: { contains: keyword } }, { source: { contains: keyword } }]
    }

    const poolAll = await prisma.photoPool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const usageLogs = await prisma.assetUsageLog.findMany({
      orderBy: { usedAt: 'desc' },
      take: 5000,
      select: { assetId: true, assetPath: true, productId: true, day: true, usedAt: true },
    })

    const logByAssetId = new Map<string, UsageMeta>()
    const logByPath = new Map<string, UsageMeta>()
    for (const l of usageLogs) {
      const keyId = (l.assetId ?? '').trim()
      const keyPath = norm(String(l.assetPath ?? ''))
      const apply = (map: Map<string, UsageMeta>, key: string) => {
        if (!key) return
        const prev = map.get(key) ?? { count: 0, lastUsedAt: null, refs: [] }
        prev.count += 1
        if (!prev.lastUsedAt) prev.lastUsedAt = l.usedAt.toISOString()
        if (prev.refs.length < 5) prev.refs.push(`${l.productId}:day${l.day}`)
        map.set(key, prev)
      }
      apply(logByAssetId, keyId)
      apply(logByPath, keyPath)
    }

    const products = await prisma.product.findMany({
      where: { schedule: { not: null } },
      select: { id: true, updatedAt: true, schedule: true },
      take: 400,
      orderBy: { updatedAt: 'desc' },
    })

    const usage = new Map<string, { count: number; lastUsedAt: string | null; refs: string[] }>()
    for (const p of products) {
      let arr: ScheduleEntry[] = []
      try {
        const parsed = JSON.parse(p.schedule ?? '[]') as unknown
        arr = Array.isArray(parsed) ? (parsed as ScheduleEntry[]) : []
      } catch {
        arr = []
      }
      for (const s of arr) {
        const imageUrl = s.imageUrl ? String(s.imageUrl).trim() : ''
        if (!imageUrl) continue
        const key = norm(imageUrl)
        const prev = usage.get(key) ?? { count: 0, lastUsedAt: null, refs: [] }
        prev.count += 1
        prev.lastUsedAt = p.updatedAt.toISOString()
        if (prev.refs.length < 5) prev.refs.push(`${p.id}:day${s.day ?? '?'}`)
        usage.set(key, prev)
      }
    }

    const items = poolAll.map((row) => {
      const key = norm(row.filePath.startsWith('/') ? row.filePath : `/${row.filePath}`)
      const logMeta = logByAssetId.get(row.id) ?? logByPath.get(key)
      const scanMeta = usage.get(key)
      const u = logMeta ?? scanMeta
      return {
        assetId: row.id,
        sourceType: row.source,
        cityName: row.cityName,
        attractionName: row.attractionName,
        normalizedPath: row.filePath,
        createdAt: row.createdAt.toISOString(),
        usageCount: u?.count ?? 0,
        lastUsedAt: u?.lastUsedAt ?? null,
        usedIn: u?.refs ?? [],
        usageSource: logMeta ? 'asset-usage-log' : scanMeta ? 'schedule-scan' : 'none',
      }
    })

    if (sort === 'most-used') {
      items.sort((a, b) => b.usageCount - a.usageCount || b.createdAt.localeCompare(a.createdAt))
    } else if (sort === 'recent-used') {
      items.sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || b.createdAt.localeCompare(a.createdAt))
    } else {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    const frequentAssets = [...items]
      .sort((a, b) => b.usageCount - a.usageCount || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
      .slice(0, 8)
    const total = items.length
    const totalPages = Math.max(1, Math.ceil(total / take))
    const start = (page - 1) * take
    const pagedItems = items.slice(start, start + take)

    return NextResponse.json({ ok: true, items: pagedItems, total, page, take, totalPages, frequentAssets })
  } catch (e) {
    console.error('[image-assets/library]', e)
    return NextResponse.json({ ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
