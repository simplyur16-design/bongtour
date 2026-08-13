/**
 * 대표 이미지 SEO(publicImageHeroSeoLine / KeywordsJson) — 상품코드·단체번호·객실 미니바 오염 재작성.
 *
 *   npx tsx scripts/backfill-product-image-hero-seo-ops-pollution.ts
 *   npx tsx scripts/backfill-product-image-hero-seo-ops-pollution.ts --apply
 *
 * REGRESSION-FREEZE[product-image-ops-seo-contamination]
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import { isProductHeroListingSeoContaminated } from '@/lib/product-hero-listing-seo-contamination'
import {
  computeHeroSeoKeywordsJsonForBackfill,
  heroSeoLineFromKeywords,
  type BackfillHeroSeoAnalysisRow,
  type BackfillHeroSeoProductRow,
} from '@/lib/backfill-product-public-image-hero-seo-keywords'
import { buildPublicProductHeroSeoKeywordOverlay } from '@/lib/public-product-hero-seo-keyword'
import {
  isPollutedScheduleImageSeoTitle,
  resolveScheduleImageSeoTitleKr,
} from '@/lib/schedule-image-seo-title-ssot'

type ScheduleRow = {
  day?: number
  title?: string | null
  routeText?: string | null
  city?: string | null
  imageSeoTitleKr?: string | null
  imageAttractionName?: string | null
  imageDisplayNameManual?: string | null
  [k: string]: unknown
}

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function parseSchedule(raw: string | null | undefined): ScheduleRow[] {
  if (!raw?.trim()) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as ScheduleRow[]) : []
  } catch {
    return []
  }
}

function storedHeroPolluted(line: string | null | undefined, json: string | null | undefined): boolean {
  if (line && isProductHeroListingSeoContaminated(line)) return true
  const raw = (json ?? '').trim()
  if (!raw) return false
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return isProductHeroListingSeoContaminated(raw)
    return v.some((x) => typeof x === 'string' && isProductHeroListingSeoContaminated(x))
  } catch {
    return isProductHeroListingSeoContaminated(raw)
  }
}

async function main() {
  const apply = readFlag('--apply')
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
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
      publicImageHeroSeoLine: true,
      publicImageHeroSeoKeywordsJson: true,
      itineraries: { select: { day: true, description: true }, orderBy: { day: 'asc' } },
    },
  })

  let scanned = 0
  let heroDirty = 0
  let heroUpdated = 0
  let schedDirty = 0
  let schedDays = 0

  for (const p of products) {
    scanned++
    const heroNeeds = storedHeroPolluted(p.publicImageHeroSeoLine, p.publicImageHeroSeoKeywordsJson)
    const rows = parseSchedule(p.schedule)
    const maxDay = Math.max(...rows.map((r) => Number(r.day) || 0), 1)
    const dest = p.primaryDestination?.trim() || p.destinationRaw?.trim() || p.destination?.trim() || null
    let nextRows = rows.map((r) => ({ ...r }))
    let schedChanged = false
    for (const row of nextRows) {
      const day = Math.max(1, Math.floor(Number(row.day) || 0))
      if (day <= 0) continue
      const storedSeo = typeof row.imageSeoTitleKr === 'string' ? row.imageSeoTitleKr : null
      const storedAttr = typeof row.imageAttractionName === 'string' ? row.imageAttractionName : null
      const manual = typeof row.imageDisplayNameManual === 'string' ? row.imageDisplayNameManual : null
      const routeText =
        typeof row.routeText === 'string' && row.routeText.trim()
          ? row.routeText
          : typeof row.city === 'string'
            ? row.city
            : typeof row.title === 'string'
              ? row.title
              : null
      const nextSeo = resolveScheduleImageSeoTitleKr({
        stored: storedSeo,
        day,
        maxDay,
        routeText,
        destination: dest,
        productTitle: p.title,
      })
      let dayChanged = false
      if (nextSeo && nextSeo !== String(storedSeo ?? '').trim()) {
        row.imageSeoTitleKr = nextSeo
        dayChanged = true
      }
      if (storedAttr && isPollutedScheduleImageSeoTitle(storedAttr)) {
        delete row.imageAttractionName
        dayChanged = true
      }
      if (manual && isPollutedScheduleImageSeoTitle(manual)) {
        delete row.imageDisplayNameManual
        dayChanged = true
      }
      if (dayChanged) {
        schedDays++
        schedChanged = true
      }
    }
    if (schedChanged) schedDirty++

    let nextLine = p.publicImageHeroSeoLine
    let nextJson = p.publicImageHeroSeoKeywordsJson
    if (heroNeeds) {
      heroDirty++
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
      const keywords = computeHeroSeoKeywordsJsonForBackfill(productRow, analysis)?.filter(
        (k) => !isProductHeroListingSeoContaminated(k),
      )
      if (keywords && keywords.length > 0) {
        nextJson = JSON.stringify(keywords)
        nextLine = heroSeoLineFromKeywords(keywords)
      } else {
        const fallback = buildPublicProductHeroSeoKeywordOverlay({
          title: p.title,
          primaryDestination: p.primaryDestination,
          destination: p.destination ?? p.destinationRaw,
          duration: p.duration,
          originSource: p.originSource,
          seoCaptionFromAsset: null,
        })
        nextLine = fallback
        nextJson = fallback ? JSON.stringify([fallback]) : null
      }
      if (nextLine && isProductHeroListingSeoContaminated(nextLine)) {
        nextLine = p.primaryDestination?.trim() || p.destination?.trim() || null
        nextJson = nextLine ? JSON.stringify([nextLine]) : null
      }
      heroUpdated++
    }

    if (!apply) continue
    if (!heroNeeds && !schedChanged) continue
    await prisma.product.update({
      where: { id: p.id },
      data: {
        ...(heroNeeds
          ? { publicImageHeroSeoLine: nextLine, publicImageHeroSeoKeywordsJson: nextJson }
          : {}),
        ...(schedChanged ? { schedule: JSON.stringify(nextRows) } : {}),
      },
    })
  }

  console.log(
    JSON.stringify(
      { apply, scanned, heroDirty, heroUpdated, schedDirty, schedDays },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
