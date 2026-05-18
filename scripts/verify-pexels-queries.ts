/**
 * 샘플 상품 일정 imageKeyword → Pexels API query 직전 문자열 trace.
 *
 * 실행: npx tsx scripts/verify-pexels-queries.ts
 * 통과: 최종 query에 travel/landscape/photorealistic/landmark/attraction 포함 0건
 *
 * LLM 대표 장소 선정은 배치 비용·비결정성 때문에 제외하고,
 * process-images·pexels-service가 쓰는 결정론 경로만 검사한다.
 */
import './load-env'
import { prisma } from '../lib/prisma'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'
import { buildItineraryDayPhotoCandidates } from '../lib/itinerary-day-photo-candidates'
import { withPexelsRealisticQuery } from '../lib/image-style'
import {
  findBannedTerms,
  parseScheduleImageKeywords,
  PEXELS_QUERY_BANNED_TERMS,
} from '../lib/image-keyword-verify-guards'
import { buildPexelsKeyword } from '../lib/pexels-keyword'
import { normalizeToPlaceName } from '../lib/pexels-place-name-keyword'
import { pickHighestPriorityLandmark } from '../lib/famous-landmarks-priority'
import type { CanonicalOverseasSupplierKey } from '../lib/overseas-supplier-canonical-keys'

const SUPPLIERS: CanonicalOverseasSupplierKey[] = [
  'hanatour',
  'modetour',
  'ybtour',
  'kyowontour',
  'lottetour',
  'verygoodtour',
]

const SAMPLE_PER_SUPPLIER = 3
const MAX_PRODUCTS_TOTAL = 18
const FETCH_POOL = 200

function resolveSupplierKey(
  brandKey: string | null | undefined,
  originSource: string | null | undefined,
): CanonicalOverseasSupplierKey | null {
  const fromBrand = (brandKey ?? '').trim().toLowerCase()
  if (SUPPLIERS.includes(fromBrand as CanonicalOverseasSupplierKey)) {
    return fromBrand as CanonicalOverseasSupplierKey
  }
  const norm = normalizeSupplierOrigin(originSource)
  return SUPPLIERS.includes(norm as CanonicalOverseasSupplierKey) ? (norm as CanonicalOverseasSupplierKey) : null
}

type QueryTrace = {
  supplier: string
  productId: string
  path: string
  day?: number
  raw: string
  finalQuery: string
  banned: string[]
}

function finalizePexelsQuery(keyword: string): string {
  return withPexelsRealisticQuery(keyword).trim()
}

function traceProductQueries(input: {
  supplier: string
  productId: string
  destination: string | null
  primaryDestination: string | null
  title: string | null
  schedule: string | null
}): QueryTrace[] {
  const traces: QueryTrace[] = []
  const dest = (input.destination ?? '').trim() || '미지정'

  const push = (path: string, raw: string, finalQuery: string, day?: number) => {
    const q = finalQuery.trim()
    if (!q) return
    traces.push({
      supplier: input.supplier,
      productId: input.productId,
      path,
      day,
      raw: raw.slice(0, 120),
      finalQuery: q,
      banned: findBannedTerms(q, PEXELS_QUERY_BANNED_TERMS),
    })
  }

  const productKw = buildPexelsKeyword({
    destination: input.destination,
    primaryRegion: null,
    themeTags: null,
    title: input.title,
    scheduleJson: input.schedule,
  })
  push('buildPexelsKeyword(product)', productKw, finalizePexelsQuery(productKw))

  const scheduleRows = parseScheduleImageKeywords(input.schedule)
  const normalizedKws = scheduleRows.map((r) => normalizeToPlaceName(r.imageKeyword)).filter(Boolean)
  const heroPriority = pickHighestPriorityLandmark(normalizedKws, (s) => normalizeToPlaceName(s))
  if (heroPriority?.keyword) {
    push(
      'hero_priority_map(schedule)',
      heroPriority.keyword,
      finalizePexelsQuery(heroPriority.keyword),
    )
  }

  const excludeKeys = new Set<string>()
  for (const row of scheduleRows) {
    const stored = row.imageKeyword
    const place = normalizeToPlaceName(stored)
    if (place) {
      push(`schedule.imageKeyword→normalize(day ${row.day})`, stored, finalizePexelsQuery(place), row.day)
    }

    const candidates = buildItineraryDayPhotoCandidates({
      destination: dest,
      city: input.primaryDestination,
      scheduleTitle: '',
      scheduleDescription: '',
      scheduleImageKeyword: stored,
      excludeKeys,
    })
    const first = candidates[0]
    if (first?.attractionPart) {
      push(
        `itinerary_day_candidates[0](day ${row.day})`,
        `${stored} → ${first.attractionPart}`,
        finalizePexelsQuery(first.attractionPart),
        row.day,
      )
      excludeKeys.add(first.semanticKey)
    }
  }

  return traces
}

async function main() {
  console.log('=== verify-pexels-queries ===\n')
  console.log('금지 query 보조어:', PEXELS_QUERY_BANNED_TERMS.join(', '))
  console.log(`공급사당 최대 ${SAMPLE_PER_SUPPLIER}건, 전체 상한 ${MAX_PRODUCTS_TOTAL}건\n`)

  const allTraces: QueryTrace[] = []
  let productCount = 0

  const pool = await prisma.product.findMany({
    where: {
      schedule: { not: null },
      NOT: { schedule: '' },
    },
    orderBy: { createdAt: 'desc' },
    take: FETCH_POOL,
    select: {
      id: true,
      originCode: true,
      originSource: true,
      title: true,
      destination: true,
      primaryDestination: true,
      schedule: true,
      brand: { select: { brandKey: true } },
    },
  })

  const bySupplier = new Map<CanonicalOverseasSupplierKey, typeof pool>()
  for (const key of SUPPLIERS) bySupplier.set(key, [])
  for (const p of pool) {
    const key = resolveSupplierKey(p.brand?.brandKey, p.originSource)
    if (!key) continue
    const list = bySupplier.get(key)!
    if (list.length < SAMPLE_PER_SUPPLIER) list.push(p)
  }

  for (const supplier of SUPPLIERS) {
    if (productCount >= MAX_PRODUCTS_TOTAL) break
    const products = bySupplier.get(supplier) ?? []

    console.log(`--- ${supplier} (${products.length}) ---`)
    for (const p of products) {
      if (productCount >= MAX_PRODUCTS_TOTAL) break
      productCount += 1
      const traces = traceProductQueries({
        supplier,
        productId: p.id,
        destination: p.destination,
        primaryDestination: p.primaryDestination,
        title: p.title,
        schedule: p.schedule,
      })
      console.log(`  ${p.id} | ${p.originCode} | traces=${traces.length}`)
      for (const t of traces) {
        const status = t.banned.length > 0 ? 'FAIL' : 'OK'
        const dayBit = t.day != null ? ` day=${t.day}` : ''
        console.log(
          `    [${status}] ${t.path}${dayBit}\n      raw: ${JSON.stringify(t.raw)}\n      query: ${JSON.stringify(t.finalQuery)}${t.banned.length ? `\n      banned: ${t.banned.join(', ')}` : ''}`,
        )
      }
      allTraces.push(...traces)
    }
    console.log('')
  }

  await prisma.$disconnect()

  const violations = allTraces.filter((t) => t.banned.length > 0)
  const uniqueQueries = new Set(allTraces.map((t) => t.finalQuery.toLowerCase()))

  console.log('--- summary ---')
  console.log(`products: ${productCount}`)
  console.log(`query traces: ${allTraces.length} (unique queries: ${uniqueQueries.size})`)
  console.log(`violations: ${violations.length}`)

  if (violations.length > 0) {
    console.error('\nFAILED: 금지 보조어가 포함된 Pexels query가 있습니다.')
    process.exit(1)
  }
  if (allTraces.length === 0) {
    console.error('\nFAILED: 검사할 상품/일정이 없습니다.')
    process.exit(1)
  }
  console.log('\nPASSED: 금지 보조어 포함 Pexels query 0건')
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
