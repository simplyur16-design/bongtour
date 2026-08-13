/**
 * 등록 상품 Product.schedule[].imageSeoTitleKr — 한글 짧은 명소 제목 SSOT.
 * 사진풀 DAYN·허브공항·영문 키워드가 공개 캡션으로 쓰이던 오염을 제거한다.
 *
 *   npx tsx scripts/backfill-schedule-image-seo-titles.ts
 *   npx tsx scripts/backfill-schedule-image-seo-titles.ts --apply
 *   npx tsx scripts/backfill-schedule-image-seo-titles.ts --apply --limit=20
 *
 * REGRESSION-FREEZE[schedule-image-seo-title-ssot]
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
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

function parseSchedule(raw: string | null | undefined): ScheduleRow[] {
  if (!raw?.trim()) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as ScheduleRow[]) : []
  } catch {
    return []
  }
}

function readFlag(name: string): boolean {
  return process.argv.includes(name)
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function main() {
  const apply = readFlag('--apply')
  const limitRaw = readArg('--limit')
  const limit = limitRaw && /^\d+$/.test(limitRaw) ? Number(limitRaw) : null
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      destination: true,
      primaryDestination: true,
      destinationRaw: true,
      schedule: true,
    },
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  })

  let scanned = 0
  let dirty = 0
  let rewrittenDays = 0
  let clearedAttraction = 0
  let laosDay = 0
  let airportKwCaption = 0

  for (const p of products) {
    scanned++
    const rows = parseSchedule(p.schedule)
    if (rows.length === 0) continue
    const maxDay = Math.max(...rows.map((r) => Number(r.day) || 0), 1)
    const dest =
      p.primaryDestination?.trim() || p.destinationRaw?.trim() || p.destination?.trim() || null
    let productChanged = false
    const nextRows = rows.map((r) => ({ ...r }))

    for (const row of nextRows) {
      const day = Math.max(1, Math.floor(Number(row.day) || 0))
      if (day <= 0) continue
      const routeText =
        typeof row.routeText === 'string' && row.routeText.trim()
          ? row.routeText
          : typeof row.city === 'string'
            ? row.city
            : typeof row.title === 'string'
              ? row.title
              : null
      const storedSeo = typeof row.imageSeoTitleKr === 'string' ? row.imageSeoTitleKr : null
      const storedAttr = typeof row.imageAttractionName === 'string' ? row.imageAttractionName : null
      if (/라오스.*DAY\s*\d+/i.test(String(storedAttr ?? ''))) laosDay++
      if (/Incheon|ICN|Gimpo|Daegu|부산공항/i.test(String(row.imageKeyword ?? ''))) airportKwCaption++

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
        clearedAttraction++
        dayChanged = true
      }
      const manual = typeof row.imageDisplayNameManual === 'string' ? row.imageDisplayNameManual : null
      if (manual && isPollutedScheduleImageSeoTitle(manual)) {
        delete row.imageDisplayNameManual
        dayChanged = true
      }
      if (dayChanged) {
        rewrittenDays++
        productChanged = true
      }
    }

    if (!productChanged) continue
    dirty++
    if (!apply) continue
    await prisma.product.update({
      where: { id: p.id },
      data: { schedule: JSON.stringify(nextRows) },
    })
  }

  console.log(
    JSON.stringify(
      {
        apply,
        scanned,
        dirtyProducts: dirty,
        rewrittenDays,
        clearedAttraction,
        laosDayBefore: laosDay,
        airportKwDays: airportKwCaption,
      },
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
