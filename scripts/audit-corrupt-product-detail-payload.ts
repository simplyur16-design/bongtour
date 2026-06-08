#!/usr/bin/env tsx
/**
 * 등록 상품 중 publicDetailPayloadJson 이 "유효 envelope + 빈 본문" 인 오염 건 탐지.
 *
 *   npx tsx scripts/audit-corrupt-product-detail-payload.ts
 *   npx tsx scripts/audit-corrupt-product-detail-payload.ts --json
 *   npx tsx scripts/audit-corrupt-product-detail-payload.ts --slug=fit-hn-0028
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { productDetailPayloadDtoHit } from '../lib/product-detail-payload-hit'
import { bookableMinDateYmdForPayload } from '../lib/product-public-detail/payload-io'
import {
  assessPayloadCorruption,
  payloadViewScheduleLen,
  type PayloadCorruptKind,
} from '../lib/product-public-detail/payload-corrupt-guard'
import { buildProductDetailPageSelect } from '../lib/product-detail-page-include'
import { buildProductPublicDetailPayload } from '../lib/product-public-detail/build-product-public-detail-payload'

const SLUG_FILTER = process.argv.find((a) => a.startsWith('--slug='))?.slice(7)?.trim()
const JSON_OUT = process.argv.includes('--json')
const REBUILD_CORRUPT = process.argv.includes('--rebuild-corrupt')

type PayloadView = {
  title?: string
  schedule?: unknown[] | null
  destination?: string
  listingKind?: string | null
  variant?: string
}

type CorruptRow = {
  id: string
  slug: string | null
  originSource: string | null
  productType: string | null
  listingKind: string | null
  dbTitle: string
  dbScheduleLen: number
  dbRawMetaLen: number
  payloadBytes: number
  payloadBuiltAt: string | null
  payloadDtoHit: boolean
  payloadTitle: string
  payloadScheduleLen: number | null
  payloadVariant: string | null
  liveRebuildBytes: number | null
  liveRebuildTitle: string | null
  liveRebuildScheduleLen: number | null
  corruptKind: PayloadCorruptKind
}

function rawMetaLen(rawMeta: unknown): number {
  if (rawMeta == null) return 0
  if (typeof rawMeta === 'string') return rawMeta.length
  return JSON.stringify(rawMeta).length
}

function parsePayloadView(json: string | null): PayloadView | null {
  if (!json?.trim()) return null
  try {
    const env = JSON.parse(json) as {
      model?: {
        variant?: string
        viewProduct?: PayloadView
      }
    }
    return env.model?.viewProduct ?? null
  } catch {
    return null
  }
}

async function main() {
  const bookable = bookableMinDateYmdForPayload()
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      ...(SLUG_FILTER ? { slug: SLUG_FILTER } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      originSource: true,
      productType: true,
      listingKind: true,
      schedule: true,
      rawMeta: true,
      publicDetailPayloadJson: true,
      publicDetailPayloadBuiltAt: true,
    },
    orderBy: { publicDetailPayloadBuiltAt: 'desc' },
  })

  const corrupt: CorruptRow[] = []
  const sampleRebuildIds: string[] = []

  for (const row of rows) {
    const payload = row.publicDetailPayloadJson
    const payloadBytes = payload?.length ?? 0
    const view = parsePayloadView(payload)
    const dbSchedLen = payloadViewScheduleLen(row.schedule)
    const { corrupt: bad, kind } = assessPayloadCorruption(row.title ?? '', dbSchedLen, view, payloadBytes)
    if (!bad || !kind) continue

    if (sampleRebuildIds.length < 12) sampleRebuildIds.push(row.id)

    corrupt.push({
      id: row.id,
      slug: row.slug,
      originSource: row.originSource,
      productType: row.productType,
      listingKind: row.listingKind,
      dbTitle: (row.title ?? '').slice(0, 80),
      dbScheduleLen: dbSchedLen,
      dbRawMetaLen: rawMetaLen(row.rawMeta),
      payloadBytes,
      payloadBuiltAt: row.publicDetailPayloadBuiltAt?.toISOString() ?? null,
      payloadDtoHit: productDetailPayloadDtoHit(payload),
      payloadTitle: (view?.title ?? '').slice(0, 80),
      payloadScheduleLen: Array.isArray(view?.schedule) ? view!.schedule!.length : view?.schedule == null ? 0 : null,
      payloadVariant: (() => {
        try {
          return JSON.parse(payload ?? '{}')?.model?.variant ?? null
        } catch {
          return null
        }
      })(),
      liveRebuildBytes: null,
      liveRebuildTitle: null,
      liveRebuildScheduleLen: null,
      corruptKind: kind,
    })
  }

  for (const id of sampleRebuildIds) {
    const full = await prisma.product.findFirst({
      where: { id },
      select: buildProductDetailPageSelect(new Date()),
    })
    if (!full) continue
    const liveJson = await buildProductPublicDetailPayload(full as never, null)
    const entry = corrupt.find((c) => c.id === id)
    if (!entry || !liveJson) continue
    try {
      const live = JSON.parse(liveJson) as { model?: { viewProduct?: PayloadView } }
      const vp = live.model?.viewProduct
      entry.liveRebuildBytes = liveJson.length
      entry.liveRebuildTitle = (vp?.title ?? '').slice(0, 80)
      entry.liveRebuildScheduleLen = Array.isArray(vp?.schedule) ? vp.schedule.length : vp?.schedule == null ? 0 : null
    } catch {
      /* ignore */
    }
  }

  const summary = {
    bookableMinDateYmd: bookable,
    scanned: rows.length,
    corruptCount: corrupt.length,
    byOrigin: Object.fromEntries(
      [...new Set(corrupt.map((c) => c.originSource ?? 'null'))].map((k) => [
        k,
        corrupt.filter((c) => (c.originSource ?? 'null') === k).length,
      ]),
    ),
    byListingKind: Object.fromEntries(
      [...new Set(corrupt.map((c) => c.listingKind ?? 'null'))].map((k) => [
        k,
        corrupt.filter((c) => (c.listingKind ?? 'null') === k).length,
      ]),
    ),
    payloadBytesRange:
      corrupt.length > 0
        ? { min: Math.min(...corrupt.map((c) => c.payloadBytes)), max: Math.max(...corrupt.map((c) => c.payloadBytes)) }
        : null,
  }

  if (REBUILD_CORRUPT && corrupt.length > 0) {
    const { rebuildProductPublicDetailPayload } = await import('../lib/product-public-detail/persist-payload')
    let ok = 0
    let fail = 0
    for (const c of corrupt) {
      try {
        const saved = await rebuildProductPublicDetailPayload(c.id)
        if (saved) {
          ok += 1
          console.log(`[rebuild-corrupt] ok ${c.slug ?? c.id}`)
        } else {
          fail += 1
          console.warn(`[rebuild-corrupt] skip ${c.slug ?? c.id}`)
        }
      } catch (e) {
        fail += 1
        console.error(`[rebuild-corrupt] fail ${c.slug ?? c.id}`, e)
      }
    }
    console.log(`[rebuild-corrupt] done ok=${ok} fail=${fail}`)
    console.log('[rebuild-corrupt] deploy 후 product-detail tag revalidate 또는 1h cache TTL 경과 시 공개 반영')
    return
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ summary, corrupt }, null, 2))
    return
  }

  console.log('=== Corrupt publicDetailPayloadJson audit ===')
  console.log(JSON.stringify(summary, null, 2))
  console.log('')
  for (const c of corrupt) {
    console.log(
      [
        c.slug ?? c.id,
        c.corruptKind,
        `payload=${c.payloadBytes}B`,
        `dbTitle="${c.dbTitle}"`,
        `payloadTitle="${c.payloadTitle}"`,
        `dbSched=${c.dbScheduleLen}`,
        `payloadSched=${c.payloadScheduleLen}`,
        `built=${c.payloadBuiltAt ?? 'null'}`,
        c.liveRebuildBytes != null ? `liveRebuild=${c.liveRebuildBytes}B title="${c.liveRebuildTitle}"` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
