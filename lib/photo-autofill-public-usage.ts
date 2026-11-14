/**
 * 공개(registered) 상품이 쓰는 사진 색인 읽기(읽기 전용).
 * 대표·일차 사진의 출처 id·주소와, 재호스팅 주소에 연결된 원 출처 id(PhotoPool.sourcePhotoId)를 모은다.
 */
import type { PrismaClient } from '@prisma/client'
import {
  buildPublicPhotoUsage,
  photoIdentityKeys,
  type PublicPhotoUsage,
  type PublicUsageRow,
} from '@/lib/photo-autofill-gate'

/** 출처 id 가 없는 저장 주소(재호스팅 파일) — 풀에서 원 id 를 찾아야 하는 주소 */
export function urlsNeedingPoolId(rows: readonly PublicUsageRow[]): string[] {
  const out = new Set<string>()
  const hasId = (keys: string[]) => keys.some((k) => k.startsWith('id:'))
  for (const r of rows) {
    const cover = String(r.bgImageUrl ?? '').trim()
    if (cover && !hasId(photoIdentityKeys({ url: cover, externalId: r.bgImageExternalId, originalLink: r.bgImageSourceUrl }))) out.add(cover)
    let days: unknown
    try {
      days = r.schedule ? JSON.parse(r.schedule) : []
    } catch {
      days = []
    }
    if (!Array.isArray(days)) continue
    for (const d of days as Array<Record<string, unknown>>) {
      for (const [u, s] of [
        [d?.imageUrl, d?.imageSource],
        [d?.imageUrl2, d?.imageSource2],
      ] as const) {
        const url = String(u ?? '').trim()
        if (!url) continue
        const o = s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
        if (!hasId(photoIdentityKeys({ url, externalId: String(o.externalId ?? ''), originalLink: String(o.originalLink ?? d?.imageSourcePageUrl ?? '') }))) out.add(url)
      }
    }
  }
  return [...out]
}

export async function loadPublicPhotoUsage(prisma: PrismaClient): Promise<PublicPhotoUsage> {
  const rows = (await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: { id: true, bgImageUrl: true, bgImageExternalId: true, bgImageSourceUrl: true, schedule: true },
  })) as Array<{ id: string; bgImageUrl: string | null; bgImageExternalId: string | null; bgImageSourceUrl: string | null; schedule: string | null }>
  const usageRows: PublicUsageRow[] = rows.map((r) => ({
    productId: r.id,
    bgImageUrl: r.bgImageUrl,
    bgImageExternalId: r.bgImageExternalId,
    bgImageSourceUrl: r.bgImageSourceUrl,
    schedule: r.schedule,
  }))
  const poolIdByUrl = new Map<string, string>()
  const need = urlsNeedingPoolId(usageRows)
  for (let i = 0; i < need.length; i += 400) {
    const chunk = need.slice(i, i + 400)
    const found = await prisma.photoPool.findMany({
      where: { filePath: { in: chunk }, sourcePhotoId: { not: null } },
      select: { filePath: true, sourcePhotoId: true },
    })
    for (const f of found) if (f.sourcePhotoId) poolIdByUrl.set(f.filePath, f.sourcePhotoId)
  }
  return buildPublicPhotoUsage(usageRows, poolIdByUrl)
}

export const PUBLIC_USAGE_TTL_MS = 5 * 60 * 1000
let usageCache: { at: number; value: PublicPhotoUsage } | null = null

/** 한 번 실행 안에서 여러 상품이 같은 색인을 쓰도록 5분 캐시. 채택한 사진은 호출부가 usage.add 로 바로 더한다. */
export async function loadPublicPhotoUsageCached(prisma: PrismaClient, ttlMs = PUBLIC_USAGE_TTL_MS, now = Date.now()): Promise<PublicPhotoUsage> {
  if (usageCache && now - usageCache.at < ttlMs) return usageCache.value
  const value = await loadPublicPhotoUsage(prisma)
  usageCache = { at: now, value }
  return value
}

export function resetPublicPhotoUsageCache(): void {
  usageCache = null
}