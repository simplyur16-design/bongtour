/**
 * Memory #5 — DB·JSON 전역 외부 CDN URL → NCloud(PhotoPool WebP) 일괄 재호스팅 runner.
 * CLI: scripts/rehost-all-external-cdn-to-ncloud.ts
 */
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  isExternalCdnImageUrl,
  normalizeImageUrlForPolicy,
} from '@/lib/external-cdn-image-ssot'
import { flagcdnImageUrl } from '@/lib/bongsim-flag-image-url'
import {
  buildPublicUrlForObjectKey,
  getImageStorageBucket,
  getObjectStorageEnv,
  isObjectStorageConfigured,
  tryParseObjectKeyFromPublicUrl,
  uploadStorageObject,
} from '@/lib/object-storage'
import { savePhotoFromUrlWithRetry } from '@/lib/photo-pool'
import {
  rehostPexelsUrlsInScheduleEntries,
  type ScheduleEntryRecord,
} from '@/lib/schedule-day-image-rehost'
import { convertToWebp } from '@/lib/image-to-webp'

export const REHOST_ALL_TABLES = [
  'Product',
  'PhotoPool',
  'MonthlyCurationContent',
  'Destination',
  'DestinationImageSet',
  'EditorialContent',
  'ImageAsset',
  'Brand',
] as const

export type RehostAllTable = (typeof REHOST_ALL_TABLES)[number]

export type RehostAllOptions = {
  apply: boolean
  tables?: RehostAllTable[]
  limit?: number | null
  pageSize?: number
  concurrency?: number
  /** Product.schedule 만 (legacy pexels batch 호환) */
  onlyProductSchedule?: boolean
  /** ISO 국기 flagcdn → NCloud + manifest TS 갱신 */
  syncBongsimFlags?: boolean
}

export type RehostTableStats = { scanned: number; changed: number; failed: number }

export type RehostAllResult = {
  scanned: number
  changed: number
  failed: number
  elapsedMs: number
  byTable: Record<string, RehostTableStats>
  failedUrls: string[]
}

const FAILED_URL_CAP = 200

function bump(
  byTable: Record<string, RehostTableStats>,
  table: string,
  field: keyof RehostTableStats,
  n = 1,
) {
  const cur = byTable[table] ?? { scanned: 0, changed: 0, failed: 0 }
  cur[field] += n
  byTable[table] = cur
}

type UrlCache = Map<string, string | null>

async function rehostScalarUrl(
  db: PrismaClient,
  url: string,
  ctx: { city: string; attraction: string; source: string },
  cache: UrlCache,
  apply: boolean,
): Promise<{ url: string | null; wouldChange: boolean; failed: boolean }> {
  const raw = url.trim()
  if (!raw || !isExternalCdnImageUrl(raw)) {
    return { url: raw || null, wouldChange: false, failed: false }
  }
  const norm = normalizeImageUrlForPolicy(raw)
  if (cache.has(norm)) {
    const cached = cache.get(norm)
    if (cached === undefined) return { url: raw, wouldChange: false, failed: false }
    return {
      url: cached,
      wouldChange: cached !== raw,
      failed: cached === null,
    }
  }
  if (!apply) {
    return { url: raw, wouldChange: true, failed: false }
  }
  const pooled = await savePhotoFromUrlWithRetry(db, raw, ctx.city, ctx.attraction, ctx.source, {
    retries: 3,
  })
  if (pooled?.filePath) {
    cache.set(norm, pooled.filePath)
    return { url: pooled.filePath, wouldChange: true, failed: false }
  }
  cache.set(norm, null)
  return { url: null, wouldChange: true, failed: true }
}

const BONGSIM_FLAG_ISO_CODES = [
  'ad', 'ae', 'af', 'ag', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bj',
  'bn', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cd', 'ch', 'ci', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv',
  'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'ee', 'eg', 'er', 'es', 'et', 'fi', 'fj', 'fr', 'ga', 'gb',
  'gd', 'ge', 'gh', 'gm', 'gn', 'gq', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'in',
  'iq', 'ir', 'is', 'it', 'jm', 'jo', 'jp', 'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'kz', 'la', 'lb',
  'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mg', 'mk', 'ml', 'mm', 'mn', 'mo',
  'mr', 'mu', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'ne', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nz', 'om', 'pa', 'pe',
  'pg', 'ph', 'pk', 'pl', 'pt', 'py', 'qa', 'ro', 'rs', 'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'si', 'sk',
  'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'sv', 'sy', 'sz', 'td', 'tg', 'th', 'tj', 'tl', 'tm', 'tn', 'to', 'tr',
  'tt', 'tv', 'tw', 'tz', 'ua', 'ug', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vn', 'vu', 'ws', 'ye', 'za', 'zm', 'zw',
] as const

async function uploadFlagBufferToNcloud(code: string, buffer: Buffer): Promise<string> {
  const webp = await convertToWebp(buffer, { maxWidth: 320, quality: 82 })
  const objectKey = `flags/iso/${code}.webp`
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: webp.buffer,
    contentType: 'image/webp',
  })
  return publicUrl
}

export async function syncBongsimFlagsToNcloudManifest(opts: {
  apply: boolean
}): Promise<{ uploaded: number; failed: number; manifestEntries: Record<string, string> }> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Object Storage(NCLOUD_*)가 필요합니다.')
  }
  const manifestEntries: Record<string, string> = {}
  let uploaded = 0
  let failed = 0
  for (const code of BONGSIM_FLAG_ISO_CODES) {
    const remote = flagcdnImageUrl(code)
    if (!opts.apply) {
      manifestEntries[code] = buildPublicUrlForObjectKey(`flags/iso/${code}.webp`)
      uploaded++
      continue
    }
    try {
      const res = await fetch(remote, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!res.ok) {
        failed++
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const publicUrl = await uploadFlagBufferToNcloud(code, buf)
      manifestEntries[code] = publicUrl
      uploaded++
    } catch {
      failed++
    }
  }
  if (opts.apply && Object.keys(manifestEntries).length > 0) {
    const lines = Object.entries(manifestEntries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    const body = `/** Auto-generated — scripts/rehost-all-external-cdn-to-ncloud.ts --sync-bongsim-flags */\nexport const BONGSIM_FLAG_NCLOUD_BY_ISO: Readonly<Record<string, string>> = {\n${lines.join('\n')}\n}\n`
    await writeFile(join(process.cwd(), 'lib', 'bongsim-flag-ncloud-manifest.ts'), body, 'utf8')
  }
  return { uploaded, failed, manifestEntries }
}

async function processProductTable(
  db: PrismaClient,
  opts: RehostAllOptions,
  cache: UrlCache,
  byTable: Record<string, RehostTableStats>,
  failedUrls: string[],
  limitRemaining: () => number | null,
): Promise<void> {
  const table = 'Product'
  let cursor: { updatedAt: Date; id: string } | undefined
  const pageSize = opts.pageSize ?? 200

  while (limitRemaining() == null || limitRemaining()! > 0) {
    const rows = await db.product.findMany({
      where: opts.onlyProductSchedule ? { schedule: { not: null } } : undefined,
      select: {
        id: true,
        updatedAt: true,
        bgImageUrl: true,
        schedule: true,
        primaryDestination: true,
        destinationRaw: true,
        destination: true,
      },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor.id } } : {}),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    if (rows.length === 0) break

    for (const row of rows) {
      if (limitRemaining() != null && limitRemaining()! <= 0) return
      bump(byTable, table, 'scanned')

      const cityFb =
        row.primaryDestination?.trim() ||
        row.destinationRaw?.trim() ||
        row.destination?.trim() ||
        'unknown'
      let rowChanged = false
      let rowFailed = false

      if (!opts.onlyProductSchedule && row.bgImageUrl && isExternalCdnImageUrl(row.bgImageUrl)) {
        const r = await rehostScalarUrl(
          db,
          row.bgImageUrl,
          { city: cityFb, attraction: 'product-cover', source: 'migrate-all' },
          cache,
          opts.apply,
        )
        if (r.failed) {
          rowFailed = true
          if (failedUrls.length < FAILED_URL_CAP) failedUrls.push(row.bgImageUrl)
        }
        if (r.wouldChange) rowChanged = true
        if (opts.apply && r.url !== row.bgImageUrl) {
          await db.product.update({ where: { id: row.id }, data: { bgImageUrl: r.url } })
        }
      }

      if (row.schedule) {
        let arr: ScheduleEntryRecord[]
        try {
          const parsed = JSON.parse(row.schedule) as unknown
          if (!Array.isArray(parsed)) continue
          arr = parsed as ScheduleEntryRecord[]
        } catch {
          continue
        }
        const needs = arr.some((entry) => {
          for (const f of ['imageUrl', 'imageUrl2'] as const) {
            const u = typeof entry[f] === 'string' ? String(entry[f]).trim() : ''
            if (u && isExternalCdnImageUrl(u)) return true
          }
          return false
        })
        if (needs) {
          if (!opts.apply) {
            rowChanged = true
          } else {
            try {
              const nextArr = await rehostPexelsUrlsInScheduleEntries(db, row.id, arr, (_day, r) => {
                const kw = typeof r.imageKeyword === 'string' ? String(r.imageKeyword).trim() : ''
                const placeGuess = kw ? kw.split(/[|,]/)[0]?.trim() || null : null
                return {
                  placeName: placeGuess,
                  cityName: cityFb,
                  searchKeyword: kw || placeGuess || cityFb,
                }
              })
              const out = JSON.stringify(nextArr)
              if (out !== row.schedule) {
                await db.product.update({ where: { id: row.id }, data: { schedule: out } })
                rowChanged = true
              }
            } catch {
              rowFailed = true
            }
          }
        }
      }

      if (rowChanged) bump(byTable, table, 'changed')
      if (rowFailed) bump(byTable, table, 'failed')
    }

    const last = rows[rows.length - 1]!
    cursor = { updatedAt: last.updatedAt, id: last.id }
    if (rows.length < pageSize) break
  }
}

async function processPhotoPool(
  db: PrismaClient,
  opts: RehostAllOptions,
  cache: UrlCache,
  byTable: Record<string, RehostTableStats>,
  failedUrls: string[],
): Promise<void> {
  const table = 'PhotoPool'
  let cursor: string | undefined
  const pageSize = opts.pageSize ?? 200
  while (true) {
    const rows = await db.photoPool.findMany({
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, filePath: true, cityName: true, attractionName: true, source: true },
    })
    if (rows.length === 0) break
    for (const row of rows) {
      bump(byTable, table, 'scanned')
      if (!isExternalCdnImageUrl(row.filePath)) continue
      const r = await rehostScalarUrl(
        db,
        row.filePath,
        {
          city: row.cityName,
          attraction: row.attractionName,
          source: row.source || 'PhotoPool',
        },
        cache,
        opts.apply,
      )
      if (r.wouldChange) bump(byTable, table, 'changed')
      if (r.failed) {
        bump(byTable, table, 'failed')
        if (failedUrls.length < FAILED_URL_CAP) failedUrls.push(row.filePath)
        continue
      }
      if (opts.apply && r.url && r.url !== row.filePath) {
        await db.photoPool.update({ where: { id: row.id }, data: { filePath: r.url } })
      }
    }
    cursor = rows[rows.length - 1]!.id
    if (rows.length < pageSize) break
  }
}

async function processScalarTable(
  db: PrismaClient,
  table: string,
  opts: RehostAllOptions,
  cache: UrlCache,
  byTable: Record<string, RehostTableStats>,
  failedUrls: string[],
  fetchPage: (cursor: string | undefined, take: number) => Promise<Array<{ id: string; url: string | null; label: string }>>,
  updateRow: (id: string, url: string | null) => Promise<void>,
): Promise<void> {
  let cursor: string | undefined
  const pageSize = opts.pageSize ?? 200
  while (true) {
    const rows = await fetchPage(cursor, pageSize)
    if (rows.length === 0) break
    for (const row of rows) {
      bump(byTable, table, 'scanned')
      if (!row.url || !isExternalCdnImageUrl(row.url)) continue
      const r = await rehostScalarUrl(
        db,
        row.url,
        { city: 'migrate', attraction: row.label, source: 'migrate-all' },
        cache,
        opts.apply,
      )
      if (r.wouldChange) bump(byTable, table, 'changed')
      if (r.failed) {
        bump(byTable, table, 'failed')
        if (failedUrls.length < FAILED_URL_CAP) failedUrls.push(row.url)
        continue
      }
      if (opts.apply && r.url !== row.url) {
        await updateRow(row.id, r.url)
      }
    }
    cursor = rows[rows.length - 1]!.id
    if (rows.length < pageSize) break
  }
}

export async function runRehostAllExternalCdn(
  opts: RehostAllOptions,
  db: PrismaClient = prisma,
): Promise<RehostAllResult> {
  if (!isObjectStorageConfigured()) {
    throw new Error('Object Storage(NCLOUD_*)가 설정되지 않았습니다.')
  }
  getObjectStorageEnv()

  const started = Date.now()
  const byTable: Record<string, RehostTableStats> = {}
  const failedUrls: string[] = []
  const cache: UrlCache = new Map()
  let changeBudget = opts.limit ?? null

  const tables: RehostAllTable[] =
    opts.tables && opts.tables.length > 0 ? opts.tables : [...REHOST_ALL_TABLES]

  if (opts.syncBongsimFlags) {
    const flagResult = await syncBongsimFlagsToNcloudManifest({ apply: opts.apply })
    console.log('[rehost-all] bongsim-flags', flagResult)
  }

  const limitRemaining = () => changeBudget
  for (const t of tables) {
    if (t === 'Product') {
      await processProductTable(db, opts, cache, byTable, failedUrls, limitRemaining)
      continue
    }
    if (t === 'PhotoPool') {
      await processPhotoPool(db, opts, cache, byTable, failedUrls)
      continue
    }
    if (t === 'MonthlyCurationContent') {
      await processScalarTable(
        db,
        t,
        opts,
        cache,
        byTable,
        failedUrls,
        async (cursor, take) => {
          const rows = await db.monthlyCurationContent.findMany({
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, imageUrl: true, title: true },
          })
          return rows.map((r) => ({ id: r.id, url: r.imageUrl, label: r.title }))
        },
        async (id, url) => {
          await db.monthlyCurationContent.update({ where: { id }, data: { imageUrl: url } })
        },
      )
      continue
    }
    if (t === 'Destination') {
      await processScalarTable(
        db,
        t,
        opts,
        cache,
        byTable,
        failedUrls,
        async (cursor, take) => {
          const rows = await db.destination.findMany({
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, imageUrl: true, name: true },
          })
          return rows.map((r) => ({ id: r.id, url: r.imageUrl, label: r.name }))
        },
        async (id, url) => {
          await db.destination.update({ where: { id }, data: { imageUrl: url } })
        },
      )
      continue
    }
    if (t === 'EditorialContent') {
      await processScalarTable(
        db,
        t,
        opts,
        cache,
        byTable,
        failedUrls,
        async (cursor, take) => {
          const rows = await db.editorialContent.findMany({
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, heroImageUrl: true, title: true },
          })
          return rows.map((r) => ({ id: r.id, url: r.heroImageUrl, label: r.title }))
        },
        async (id, url) => {
          await db.editorialContent.update({ where: { id }, data: { heroImageUrl: url } })
        },
      )
      continue
    }
    if (t === 'Brand') {
      await processScalarTable(
        db,
        t,
        opts,
        cache,
        byTable,
        failedUrls,
        async (cursor, take) => {
          const rows = await db.brand.findMany({
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, logoPath: true, brandKey: true },
          })
          return rows.map((r) => ({ id: r.id, url: r.logoPath, label: r.brandKey }))
        },
        async (id, url) => {
          await db.brand.update({ where: { id }, data: { logoPath: url } })
        },
      )
      continue
    }
    if (t === 'ImageAsset') {
      const bucket = getImageStorageBucket()
      await processScalarTable(
        db,
        t,
        opts,
        cache,
        byTable,
        failedUrls,
        async (cursor, take) => {
          const rows = await db.imageAsset.findMany({
            take,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' },
            select: { id: true, publicUrl: true, fileName: true },
          })
          return rows.map((r) => ({ id: r.id, url: r.publicUrl, label: r.fileName }))
        },
        async (id, url) => {
          if (!url) return
          const key = tryParseObjectKeyFromPublicUrl(url)
          await db.imageAsset.update({
            where: { id },
            data: {
              publicUrl: url,
              ...(key ? { storagePath: key, storageBucket: bucket } : {}),
            },
          })
        },
      )
      continue
    }
    if (t === 'DestinationImageSet') {
      let cursor: string | undefined
      const pageSize = opts.pageSize ?? 200
      const table = 'DestinationImageSet'
      while (true) {
        const rows = await db.destinationImageSet.findMany({
          take: pageSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: { id: true, destinationName: true, mainImageUrl: true, scheduleImageUrls: true },
        })
        if (rows.length === 0) break
        for (const row of rows) {
          bump(byTable, table, 'scanned')
          let main = row.mainImageUrl
          let schedStr = row.scheduleImageUrls
          let ch = false
          if (main && isExternalCdnImageUrl(main)) {
            const r = await rehostScalarUrl(
              db,
              main,
              { city: row.destinationName, attraction: 'main', source: 'destination-set' },
              cache,
              opts.apply,
            )
            if (r.wouldChange) ch = true
            if (r.failed) {
              bump(byTable, table, 'failed')
              if (failedUrls.length < FAILED_URL_CAP) failedUrls.push(main)
            } else if (r.url !== main) {
              main = r.url
            }
          }
          if (schedStr) {
            try {
              const arr = JSON.parse(schedStr) as Array<{ url?: string }>
              let schCh = false
              const next = await Promise.all(
                arr.map(async (item) => {
                  const u = typeof item.url === 'string' ? item.url.trim() : ''
                  if (!u || !isExternalCdnImageUrl(u)) return item
                  const r = await rehostScalarUrl(
                    db,
                    u,
                    { city: row.destinationName, attraction: 'schedule-slot', source: 'destination-set' },
                    cache,
                    opts.apply,
                  )
                  if (r.wouldChange) schCh = true
                  if (r.failed && failedUrls.length < FAILED_URL_CAP) failedUrls.push(u)
                  return { ...item, url: r.url ?? '' }
                }),
              )
              if (schCh) {
                schedStr = JSON.stringify(next)
                ch = true
              }
            } catch {
              /* ignore */
            }
          }
          if (ch) {
            bump(byTable, table, 'changed')
            if (opts.apply) {
              await db.destinationImageSet.update({
                where: { id: row.id },
                data: { mainImageUrl: main, scheduleImageUrls: schedStr },
              })
            }
          }
        }
        cursor = rows[rows.length - 1]!.id
        if (rows.length < pageSize) break
      }
    }
  }

  let scanned = 0
  let changed = 0
  let failed = 0
  for (const s of Object.values(byTable)) {
    scanned += s.scanned
    changed += s.changed
    failed += s.failed
  }

  const elapsedMs = Date.now() - started
  const result: RehostAllResult = { scanned, changed, failed, elapsedMs, byTable, failedUrls }
  console.log(
    `[rehost-all] scanned=${scanned} changed=${changed} failed=${failed} elapsed=${Math.round(elapsedMs / 1000)}s`,
    opts.apply ? '(applied)' : '(dry-run)',
  )
  for (const [name, s] of Object.entries(byTable)) {
    if (s.scanned > 0) {
      console.log(`[rehost-all] table ${name}: scanned=${s.scanned} changed=${s.changed} failed=${s.failed}`)
    }
  }
  if (failedUrls.length > 0) {
    console.log('[rehost-all] failedUrls sample:', failedUrls.slice(0, 5))
  }
  return result
}

/** dry-run 기본: 외부 URL 건수 스캔만 */
export async function countExternalCdnUrlsInDb(db: PrismaClient = prisma): Promise<{
  total: number
  byTable: Record<string, number>
}> {
  const byTable: Record<string, number> = {}
  let total = 0

  const bump = (table: string, n: number) => {
    byTable[table] = (byTable[table] ?? 0) + n
    total += n
  }

  const products = await db.product.findMany({ select: { bgImageUrl: true, schedule: true } })
  for (const p of products) {
    if (p.bgImageUrl && isExternalCdnImageUrl(p.bgImageUrl)) bump('Product.bgImageUrl', 1)
    if (p.schedule) {
      try {
        const arr = JSON.parse(p.schedule) as unknown[]
        if (Array.isArray(arr)) {
          for (const row of arr) {
            if (!row || typeof row !== 'object') continue
            const o = row as Record<string, unknown>
            for (const f of ['imageUrl', 'imageUrl2']) {
              const u = typeof o[f] === 'string' ? o[f].trim() : ''
              if (u && isExternalCdnImageUrl(u)) bump('Product.schedule', 1)
            }
          }
        }
      } catch {
        /* */
      }
    }
  }

  const pools = await db.photoPool.findMany({ select: { filePath: true } })
  for (const ph of pools) {
    if (isExternalCdnImageUrl(ph.filePath)) bump('PhotoPool', 1)
  }

  for (const m of await db.monthlyCurationContent.findMany({ select: { imageUrl: true } })) {
    if (m.imageUrl && isExternalCdnImageUrl(m.imageUrl)) bump('MonthlyCurationContent', 1)
  }
  for (const d of await db.destination.findMany({ select: { imageUrl: true } })) {
    if (d.imageUrl && isExternalCdnImageUrl(d.imageUrl)) bump('Destination', 1)
  }
  for (const e of await db.editorialContent.findMany({ select: { heroImageUrl: true } })) {
    if (e.heroImageUrl && isExternalCdnImageUrl(e.heroImageUrl)) bump('EditorialContent', 1)
  }
  for (const b of await db.brand.findMany({ select: { logoPath: true } })) {
    if (b.logoPath && isExternalCdnImageUrl(b.logoPath)) bump('Brand', 1)
  }
  for (const a of await db.imageAsset.findMany({ select: { publicUrl: true } })) {
    if (a.publicUrl && isExternalCdnImageUrl(a.publicUrl)) bump('ImageAsset', 1)
  }
  for (const s of await db.destinationImageSet.findMany({
    select: { mainImageUrl: true, scheduleImageUrls: true },
  })) {
    if (s.mainImageUrl && isExternalCdnImageUrl(s.mainImageUrl)) bump('DestinationImageSet', 1)
    if (s.scheduleImageUrls) {
      try {
        const arr = JSON.parse(s.scheduleImageUrls) as Array<{ url?: string }>
        for (const item of arr) {
          if (item.url && isExternalCdnImageUrl(item.url)) bump('DestinationImageSet.schedule', 1)
        }
      } catch {
        /* */
      }
    }
  }

  return { total, byTable }
}
