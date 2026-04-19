/**
 * 기존 Product.schedule JSON 안의 Pexels CDN imageUrl을 일괄 Supabase로 재호스팅.
 * Run: npx tsx scripts/rehost-schedule-pexels-batch.ts --dry-run
 * Apply: npx tsx scripts/rehost-schedule-pexels-batch.ts --apply --limit=20
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { isObjectStorageConfigured, tryParseObjectKeyFromPublicUrl } from '../lib/object-storage'
import { isPexelsCdnUrl } from '../lib/product-pexels-image-rehost'
import { rehostPexelsUrlsInScheduleEntries, type ScheduleEntryRecord } from '../lib/schedule-day-image-rehost'

function scheduleNeedsPexelsRehost(rows: ScheduleEntryRecord[]): boolean {
  for (const r of rows) {
    const u = typeof r.imageUrl === 'string' ? r.imageUrl.trim() : ''
    if (!u) continue
    if (tryParseObjectKeyFromPublicUrl(u)) continue
    if (isPexelsCdnUrl(u)) return true
  }
  return false
}

function parseCli() {
  const apply = process.argv.includes('--apply')
  let limit = 200
  const limArg = process.argv.find((a) => a.startsWith('--limit='))
  if (limArg) {
    const n = Number(limArg.slice('--limit='.length))
    if (Number.isFinite(n) && n > 0) limit = Math.floor(n)
  }
  return { apply, limit }
}

async function main() {
  const { apply, limit } = parseCli()
  if (!isObjectStorageConfigured()) {
    console.error('[rehost-schedule-pexels-batch] Supabase env 필요')
    process.exit(1)
  }
  const rows = await prisma.product.findMany({
    where: { schedule: { not: null } },
    select: {
      id: true,
      schedule: true,
      primaryDestination: true,
      destinationRaw: true,
      destination: true,
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
  let touched = 0
  for (const p of rows) {
    if (!p.schedule) continue
    let arr: ScheduleEntryRecord[]
    try {
      const parsed = JSON.parse(p.schedule) as unknown
      if (!Array.isArray(parsed)) continue
      arr = parsed as ScheduleEntryRecord[]
    } catch {
      continue
    }
    const cityFb =
      p.primaryDestination?.trim() || p.destinationRaw?.trim() || p.destination?.trim() || null
    if (!scheduleNeedsPexelsRehost(arr)) continue
    touched++
    console.log(apply ? '[apply]' : '[dry-run]', 'would rehost schedule pexels for', p.id)
    if (!apply) continue
    const next = await rehostPexelsUrlsInScheduleEntries(prisma, p.id, arr, (_day, row) => {
      const kw = typeof row.imageKeyword === 'string' ? String(row.imageKeyword).trim() : ''
      const placeGuess = kw ? kw.split(/[|,]/)[0]?.trim() || null : null
      return { placeName: placeGuess, cityName: cityFb, searchKeyword: kw || placeGuess || cityFb }
    })
    const out = JSON.stringify(next)
    if (out === p.schedule) continue
    await prisma.product.update({ where: { id: p.id }, data: { schedule: out } })
  }
  console.log('[rehost-schedule-pexels-batch] scanned', rows.length, 'changed', touched, apply ? '(applied)' : '(dry-run)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
