/**
 * 등록 상품 동선지도 백필 — Gemini로 그려 rawMeta에 저장.
 *
 *   npx tsx scripts/persist-bongtour-route-map.ts --slug=pkg-vg-0025
 *   npx tsx scripts/persist-bongtour-route-map.ts --slug=pkg-vg-0025 --force
 */
import { loadEnvForScripts } from './load-env-for-scripts'
loadEnvForScripts()

import { prisma } from '@/lib/prisma'
import { ensureBongtourRouteMapPersisted } from '@/lib/bongtour-route-map-persist-ssot'

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3).trim() : undefined
}

async function main() {
  const force = process.argv.includes('--force')
  const key = (arg('slug') || arg('id') || 'pkg-vg-0025').trim()
  const row = await prisma.product.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    select: { id: true, slug: true },
  })
  if (!row) {
    console.error('[persist-route-map] not found', key)
    process.exitCode = 1
    return
  }
  console.log('[persist-route-map] start', { id: row.id, slug: row.slug, force })
  const out = await ensureBongtourRouteMapPersisted(row.id, { force })
  console.log('[persist-route-map] done', {
    status: out?.status,
    imageUrl: out?.imageUrl ? `${out.imageUrl.slice(0, 80)}…` : null,
    failReason: out?.failReason,
    cities: out?.cities,
  })
  if (out?.status !== 'ready' || !out.imageUrl) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
