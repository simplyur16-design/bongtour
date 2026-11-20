/**
 * 일정 동선 지도 잔재 1회 정리.
 * rawMeta.itineraryRouteMap 키와 NCLOUD `itinerary-route-maps/` 접두어 객체만 대상이다.
 *
 *   npx tsx scripts/purge-itinerary-route-map-remnants.ts
 *   npx tsx scripts/purge-itinerary-route-map-remnants.ts --apply
 *
 * 기본은 dry-run(건수만). --apply 는 백업 JSON을 쓴 뒤에만 삭제한다.
 */
import fs from 'fs'
import path from 'path'
import './load-env'
import { prisma } from '../lib/prisma'
import {
  isObjectStorageConfigured,
  listStorageObjectKeysRecursive,
  removeStorageObjectsBatched,
} from '../lib/object-storage'

export const ITINERARY_ROUTE_MAP_OBJECT_PREFIX = 'itinerary-route-maps/'
export const ITINERARY_ROUTE_MAP_RAW_KEY = 'itineraryRouteMap'

export function stripItineraryRouteMapFromRawMeta(raw: string | null | undefined): {
  next: string | null
  removed: unknown | null
} {
  if (raw == null) return { next: raw ?? null, removed: null }
  const text = String(raw)
  if (!text.trim()) return { next: text, removed: null }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { next: text, removed: null }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { next: text, removed: null }
  }
  const obj = parsed as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(obj, ITINERARY_ROUTE_MAP_RAW_KEY)) {
    return { next: text, removed: null }
  }
  const removed = obj[ITINERARY_ROUTE_MAP_RAW_KEY]
  delete obj[ITINERARY_ROUTE_MAP_RAW_KEY]
  return { next: JSON.stringify(obj), removed }
}

/** 다른 사진 경로는 거부한다. */
export function assertItineraryRouteMapObjectKey(key: string): string {
  const normalized = String(key ?? '').replace(/^\/+/, '')
  if (
    !normalized.startsWith(ITINERARY_ROUTE_MAP_OBJECT_PREFIX) ||
    normalized.includes('..') ||
    normalized.includes('\\') ||
    normalized.includes('//')
  ) {
    throw new Error('refusing object key outside itinerary-route-maps/')
  }
  return normalized
}

function argFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main() {
  const apply = argFlag('--apply')
  const products: Array<{ id: string; slug: string | null; removed: unknown }> = []
  const pageSize = 100
  let cursor: string | undefined
  for (;;) {
    const rows = await prisma.product.findMany({
      where: { rawMeta: { contains: ITINERARY_ROUTE_MAP_RAW_KEY } },
      select: { id: true, slug: true, rawMeta: true },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id
    for (const row of rows) {
      const stripped = stripItineraryRouteMapFromRawMeta(row.rawMeta)
      if (stripped.removed == null) continue
      products.push({ id: row.id, slug: row.slug, removed: stripped.removed })
    }
    if (rows.length < pageSize) break
  }

  let objectKeys: string[] = []
  let storageTruncated = false
  if (isObjectStorageConfigured()) {
    const listed = await listStorageObjectKeysRecursive({
      prefix: ITINERARY_ROUTE_MAP_OBJECT_PREFIX,
      maxKeys: 20_000,
    })
    objectKeys = listed.objects.map((o) => assertItineraryRouteMapObjectKey(o.objectKey))
    storageTruncated = listed.truncated
  }

  console.log(
    JSON.stringify({
      apply,
      rawMetaFields: products.length,
      objectKeys: objectKeys.length,
      storageTruncated,
      storageConfigured: isObjectStorageConfigured(),
    }),
  )
  if (!apply) return
  if (storageTruncated) {
    throw new Error('object list truncated; refusing apply')
  }

  const backupPath = path.join(
    process.cwd(),
    'tmp',
    `itinerary-route-map-purge-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  fs.mkdirSync(path.dirname(backupPath), { recursive: true })
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ createdAt: new Date().toISOString(), products, objectKeys }, null, 2),
  )
  console.log(JSON.stringify({ backupPath, rawMetaFields: products.length, objectKeys: objectKeys.length }))

  for (const item of products) {
    const row = await prisma.product.findUnique({
      where: { id: item.id },
      select: { rawMeta: true },
    })
    const stripped = stripItineraryRouteMapFromRawMeta(row?.rawMeta)
    if (stripped.removed == null || stripped.next == null) continue
    await prisma.product.update({
      where: { id: item.id },
      data: { rawMeta: stripped.next },
    })
  }

  if (objectKeys.length > 0) {
    const result = await removeStorageObjectsBatched(objectKeys.map(assertItineraryRouteMapObjectKey))
    if (result.failed.length > 0) {
      throw new Error(`object delete failed: ${result.failed.length}`)
    }
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').includes('purge-itinerary-route-map-remnants')
if (isDirectRun) {
  main()
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(msg.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]'))
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
