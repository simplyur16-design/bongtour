/**
 * 기존 Product.schedule JSON 안의 Pexels CDN imageUrl을 일괄 Supabase로 재호스팅.
 * Run: npx tsx scripts/rehost-schedule-pexels-batch.ts --dry-run
 * Apply: npx tsx scripts/rehost-schedule-pexels-batch.ts --apply
 * Optional: --limit=50 (최대 처리 상품 수), --page-size=200 (페이지당 스캔 수)
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '../lib/object-storage'
import { isPexelsCdnUrl } from '../lib/product-pexels-image-rehost'
import { rehostPexelsUrlsInScheduleEntries, type ScheduleEntryRecord } from '../lib/schedule-day-image-rehost'

function scheduleNeedsPexelsRehost(rows: ScheduleEntryRecord[]): boolean {
  for (const r of rows) {
    for (const field of ['imageUrl', 'imageUrl2'] as const) {
      const u = typeof r[field] === 'string' ? r[field].trim() : ''
      if (!u) continue
      if (tryParseObjectKeyFromPublicUrl(u)) continue
      if (isPexelsCdnUrl(u)) return true
    }
  }
  return false
}

function parseCli() {
  const apply = process.argv.includes('--apply')
  let maxProducts: number | null = null
  let pageSize = 200
  const limArg = process.argv.find((a) => a.startsWith('--limit='))
  if (limArg) {
    const n = Number(limArg.slice('--limit='.length))
    if (Number.isFinite(n) && n > 0) maxProducts = Math.floor(n)
  }
  const pageArg = process.argv.find((a) => a.startsWith('--page-size='))
  if (pageArg) {
    const n = Number(pageArg.slice('--page-size='.length))
    if (Number.isFinite(n) && n > 0) pageSize = Math.floor(n)
  }
  return { apply, maxProducts, pageSize }
}

type ProductScheduleRow = {
  id: string
  schedule: string
  primaryDestination: string | null
  destinationRaw: string | null
  destination: string | null
}

async function processProduct(p: ProductScheduleRow, apply: boolean): Promise<boolean> {
  let arr: ScheduleEntryRecord[]
  try {
    const parsed = JSON.parse(p.schedule) as unknown
    if (!Array.isArray(parsed)) return false
    arr = parsed as ScheduleEntryRecord[]
  } catch {
    return false
  }
  const cityFb =
    p.primaryDestination?.trim() || p.destinationRaw?.trim() || p.destination?.trim() || null
  if (!scheduleNeedsPexelsRehost(arr)) return false
  console.log(apply ? '[apply]' : '[dry-run]', 'would rehost schedule pexels for', p.id)
  if (!apply) return true
  const next = await rehostPexelsUrlsInScheduleEntries(prisma, p.id, arr, (_day, row) => {
    const kw = typeof row.imageKeyword === 'string' ? String(row.imageKeyword).trim() : ''
    const placeGuess = kw ? kw.split(/[|,]/)[0]?.trim() || null : null
    return { placeName: placeGuess, cityName: cityFb, searchKeyword: kw || placeGuess || cityFb }
  })
  const out = JSON.stringify(next)
  if (out === p.schedule) return true
  await prisma.product.update({ where: { id: p.id }, data: { schedule: out } })
  return true
}

async function main() {
  const { apply, maxProducts, pageSize } = parseCli()
  if (!isObjectStorageConfigured()) {
    console.error('[rehost-schedule-pexels-batch] Supabase env 필요')
    process.exit(1)
  }

  let scanned = 0
  let touched = 0
  let cursor: { updatedAt: Date; id: string } | undefined

  while (maxProducts == null || touched < maxProducts) {
    const rows = await prisma.product.findMany({
      where: { schedule: { not: null } },
      select: {
        id: true,
        schedule: true,
        primaryDestination: true,
        destinationRaw: true,
        destination: true,
        updatedAt: true,
      },
      take: pageSize,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor.id },
          }
        : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    if (rows.length === 0) break

    for (const row of rows) {
      if (maxProducts != null && touched >= maxProducts) break
      scanned++
      if (!row.schedule) continue
      const changed = await processProduct(
        {
          id: row.id,
          schedule: row.schedule,
          primaryDestination: row.primaryDestination,
          destinationRaw: row.destinationRaw,
          destination: row.destination,
        },
        apply
      )
      if (changed) touched++
    }

    const last = rows[rows.length - 1]!
    cursor = { updatedAt: last.updatedAt, id: last.id }
    if (rows.length < pageSize) break
  }

  console.log(
    '[rehost-schedule-pexels-batch] scanned',
    scanned,
    'changed',
    touched,
    apply ? '(applied)' : '(dry-run)',
    maxProducts != null ? `limit=${maxProducts}` : '(all pages)'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
