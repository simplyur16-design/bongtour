/**
 * 기존 Product.publicImageHeroSeoKeywordsJson backfill (스크래퍼·parseForRegister 미사용).
 *
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --dry-run
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --apply
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --apply --force
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --dry-run --product-id=<cuid>
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --dry-run --origin-source=modetour
 *   npx tsx scripts/backfill-public-image-hero-seo-keywords.mts --apply --limit=200
 */

import { readFileSync } from 'node:fs'

function loadEnvLocal() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq <= 0) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {
    /* no .env.local */
  }
}
loadEnvLocal()

import { PrismaClient } from '../prisma-gen-runtime/index.js'

const prisma = new PrismaClient()
import heroSeoBackfill from '../lib/backfill-product-public-image-hero-seo-keywords'
import type { BackfillHeroSeoAnalysisRow, BackfillHeroSeoProductRow } from '../lib/backfill-product-public-image-hero-seo-keywords'

function parseArgs(argv: string[]) {
  const flags = new Set<string>()
  const kv = new Map<string, string>()
  for (const a of argv) {
    if (a === '--dry-run' || a === '--apply' || a === '--force') {
      flags.add(a.slice(2))
      continue
    }
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) kv.set(m[1]!, m[2]!)
  }
  return { flags, kv }
}

function lacksHeroKeywordsJson(raw: string | null | undefined): boolean {
  const t = (raw ?? '').trim()
  if (!t) return true
  if (t === '[]' || t === 'null') return true
  try {
    const v = JSON.parse(t) as unknown
    if (!Array.isArray(v)) return true
    const strings = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return strings.length === 0
  } catch {
    return true
  }
}

const { flags, kv } = parseArgs(process.argv.slice(2))
const dryRun = flags.has('dry-run')
const apply = flags.has('apply')
const force = flags.has('force')

if (dryRun === apply) {
  console.error(
    JSON.stringify({
      error: 'Specify exactly one of --dry-run or --apply',
    })
  )
  process.exit(1)
}

const productId = kv.get('product-id')?.trim() || null
const originSource = kv.get('origin-source')?.trim() || null
const limitRaw = kv.get('limit')?.trim()
const limit = Math.min(5000, Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 500 : 500))

const rows = await prisma.product.findMany({
  where: {
    registrationStatus: 'registered',
    ...(productId ? { id: productId } : {}),
    ...(originSource ? { originSource } : {}),
  },
  select: {
    id: true,
    originSource: true,
    title: true,
    primaryDestination: true,
    destination: true,
    destinationRaw: true,
    duration: true,
    tripNights: true,
    tripDays: true,
    summary: true,
    benefitSummary: true,
    themeTags: true,
    themeLabelsRaw: true,
    primaryRegion: true,
    includedText: true,
    excludedText: true,
    optionalTourSummaryRaw: true,
    schedule: true,
    rawMeta: true,
    publicImageHeroSeoKeywordsJson: true,
    itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' } },
  },
  take: Math.min(8000, Math.max(limit, limit * 5)),
})

const candidates = rows
  .filter((r) => force || lacksHeroKeywordsJson(r.publicImageHeroSeoKeywordsJson))
  .slice(0, limit)

const out: Array<{
  id: string
  originSource: string
  action: 'would_update' | 'updated' | 'no_keywords'
  keywords: string[] | null
}> = []

for (const p of candidates) {
  const analysisDb = await prisma.registerAdminAnalysis.findFirst({
    where: { productId: p.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      normalizedJson: true,
      parsedJson: true,
      snapshot: { select: { bodyText: true } },
    },
  })

  const analysis: BackfillHeroSeoAnalysisRow | null = analysisDb
    ? {
        normalizedJson: analysisDb.normalizedJson,
        parsedJson: analysisDb.parsedJson,
        snapshot: analysisDb.snapshot,
      }
    : null

  const productRow: BackfillHeroSeoProductRow = {
    id: p.id,
    originSource: p.originSource,
    title: p.title,
    primaryDestination: p.primaryDestination,
    destination: p.destination,
    destinationRaw: p.destinationRaw,
    duration: p.duration,
    tripNights: p.tripNights,
    tripDays: p.tripDays,
    summary: p.summary,
    benefitSummary: p.benefitSummary,
    themeTags: p.themeTags,
    themeLabelsRaw: p.themeLabelsRaw,
    primaryRegion: p.primaryRegion,
    includedText: p.includedText,
    excludedText: p.excludedText,
    optionalTourSummaryRaw: p.optionalTourSummaryRaw,
    schedule: p.schedule,
    rawMeta: p.rawMeta,
    itineraries: p.itineraries?.length ? p.itineraries : undefined,
  }

  const keywords = heroSeoBackfill.computeHeroSeoKeywordsJsonForBackfill(productRow, analysis)
  if (!keywords?.length) {
    out.push({ id: p.id, originSource: p.originSource, action: 'no_keywords', keywords: null })
    continue
  }

  const json = JSON.stringify(keywords)
  const line = heroSeoBackfill.heroSeoLineFromKeywords(keywords)

  if (dryRun) {
    out.push({ id: p.id, originSource: p.originSource, action: 'would_update', keywords })
    continue
  }

  await prisma.product.update({
    where: { id: p.id },
    data: {
      publicImageHeroSeoKeywordsJson: json,
      publicImageHeroSeoLine: line,
    },
  })
  out.push({ id: p.id, originSource: p.originSource, action: 'updated', keywords })
}

console.log(
  JSON.stringify(
    {
      dryRun,
      apply,
      force,
      limit,
      scanned: candidates.length,
      summary: {
        would_update: out.filter((x) => x.action === 'would_update').length,
        updated: out.filter((x) => x.action === 'updated').length,
        no_keywords: out.filter((x) => x.action === 'no_keywords').length,
      },
      rows: out,
    },
    null,
    2
  )
)

await prisma.$disconnect()
