/**
 * verygoodtour 등록 상품 URL 건강 inventory — HEAD/GET 만료·정규화 URL.
 *
 *   npm run verify:verygoodtour-url-health-inventory
 *   npm run verify:verygoodtour-url-health-inventory -- --apply
 *
 * 결과: ops/verygoodtour-url-health-inventory.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import {
  isVerygoodtourDetailUrlExpired,
  normalizeVerygoodtourDetailUrlForCollect,
} from '@/lib/verygoodtour-detail-url-health'

const OUT_PATH = path.join(process.cwd(), 'ops', 'verygoodtour-url-health-inventory.json')

function readIntArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return fallback
  const n = Number.parseInt(process.argv[i + 1] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function resolveDetailUrl(originUrl: string | null, originCode: string | null): string | null {
  const stored = (originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (originCode ?? '').trim()
  if (!code) return null
  const built = buildDetailUrl('verygoodtour', code)
  return built.startsWith('http') ? built : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const limit = readIntArg('--limit', 500)
  const apply = process.argv.includes('--apply')
  const pauseMs = Number(process.env.VERYGOOD_URL_PROBE_PAUSE_MS ?? '400')

  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
    where: { originSource: 'verygoodtour', registrationStatus: 'registered' },
    select: { id: true, slug: true, title: true, originUrl: true, originCode: true },
    orderBy: [{ slug: 'asc' }, { id: 'asc' }],
    take: limit,
  })

  const items: Array<{
    slug: string | null
    id: string
    originCode: string | null
    storedUrl: string | null
    normalizedUrl: string | null
    expired: boolean
    applied: boolean
  }> = []

  for (let i = 0; i < products.length; i += 1) {
    const p = products[i]!
    const raw = resolveDetailUrl(p.originUrl, p.originCode)
    const normalized = raw ? normalizeVerygoodtourDetailUrlForCollect(raw) : null
    const expired = normalized ? await isVerygoodtourDetailUrlExpired(normalized) : true
    let applied = false

    if (apply && normalized && !expired && normalized !== (p.originUrl ?? '').trim()) {
      await prisma.product.update({
        where: { id: p.id },
        data: { originUrl: normalized },
      })
      applied = true
    }

    items.push({
      slug: p.slug,
      id: p.id,
      originCode: p.originCode,
      storedUrl: p.originUrl,
      normalizedUrl: normalized,
      expired,
      applied,
    })

    console.error(
      `[${i + 1}/${products.length}] ${p.slug ?? p.id} expired=${expired} applied=${applied}`,
    )

    if (i + 1 < products.length && pauseMs > 0) await sleep(pauseMs)
  }

  const summary = {
    total: items.length,
    live: items.filter((x) => !x.expired).length,
    expired: items.filter((x) => x.expired).length,
    applied: items.filter((x) => x.applied).length,
  }

  const report = {
    finishedAt: new Date().toISOString(),
    apply,
    summary,
    items,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, outFile: OUT_PATH, summary }, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
