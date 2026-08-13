/**
 * 등록 상품 Product.schedule[].description + ItineraryDay.summaryTextRaw
 * — 특성 3문장+ SSOT로 재작성 (명소명 금지).
 *
 *   npx tsx scripts/backfill-schedule-description-characteristic.ts
 *   npx tsx scripts/backfill-schedule-description-characteristic.ts --apply
 *   npx tsx scripts/backfill-schedule-description-characteristic.ts --apply --limit=20
 *
 * REGRESSION-FREEZE[register-schedule-description-characteristic-ssot]
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import {
  composeRegisterScheduleCharacteristicDescription,
  countRegisterScheduleDescriptionSentences,
  registerScheduleDescriptionHasAttractionNameLeak,
} from '@/lib/register-schedule-description-characteristic-ssot'
import { composeRegisterScheduleRegionVibeDescription } from '@/lib/register-schedule-region-vibe'

type ScheduleRow = {
  day?: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  city?: string | null
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

function routePlacesOf(row: ScheduleRow, itineraryCity?: string | null, poiNamesRaw?: string | null): string[] {
  const fromRoute = String(row.routeText ?? '')
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromRoute.length > 0) return fromRoute
  const fromCity = String(itineraryCity ?? row.city ?? '')
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromCity.length > 0) return fromCity
  return String(poiNamesRaw ?? '')
    .split(/[,，·/\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
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
      schedule: true,
      itineraryDays: {
        select: { id: true, day: true, city: true, summaryTextRaw: true, poiNamesRaw: true },
        orderBy: { day: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    ...(limit ? { take: limit } : {}),
  })

  let scanned = 0
  let dirty = 0
  let rewrittenDays = 0
  let shortBefore = 0
  let leakBefore = 0
  let genericBefore = 0

  for (const p of products) {
    scanned++
    const rows = parseSchedule(p.schedule)
    if (rows.length === 0 && p.itineraryDays.length === 0) continue
    const maxDay = Math.max(
      ...rows.map((r) => Number(r.day) || 0),
      ...p.itineraryDays.map((d) => d.day),
      1,
    )
    const byDay = new Map(p.itineraryDays.map((d) => [d.day, d]))
    const nextRows = rows.length > 0 ? rows.map((r) => ({ ...r })) : p.itineraryDays.map((d) => ({
      day: d.day,
      description: d.summaryTextRaw,
      routeText: d.city,
    }))

    let productChanged = false
    for (const row of nextRows) {
      const day = Math.max(1, Math.floor(Number(row.day) || 0))
      if (day <= 0) continue
      const iday = byDay.get(day)
      const places = routePlacesOf(row, iday?.city, iday?.poiNamesRaw)
      const blob = [row.routeText, row.title, row.city, iday?.city, iday?.poiNamesRaw, places.join(' - ')]
        .filter(Boolean)
        .join(' ')
      const prev = String(row.description ?? iday?.summaryTextRaw ?? '').trim()
      if (countRegisterScheduleDescriptionSentences(prev) < 3) shortBefore++
      if (/하루 동안 여러 장면이 자연스럽게/.test(prev)) genericBefore++
      if (registerScheduleDescriptionHasAttractionNameLeak(prev, places)) leakBefore++

      const next =
        composeRegisterScheduleRegionVibeDescription({
          day,
          maxDay,
          routePlaces: places,
          joinedBlob: blob || `${day}일차`,
        }) ||
        composeRegisterScheduleCharacteristicDescription({
          day,
          maxDay,
          routePlaces: places,
          joinedBlob: blob || `${day}일차`,
        })

      if (!next || next === prev) continue
      row.description = next
      productChanged = true
      rewrittenDays++
    }

    if (!productChanged) continue
    dirty++
    if (!apply) continue

    const scheduleJson = JSON.stringify(nextRows)
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: p.id },
        data: { schedule: scheduleJson },
      })
      for (const row of nextRows) {
        const day = Math.floor(Number(row.day) || 0)
        if (day <= 0) continue
        const desc = String(row.description ?? '').trim()
        if (!desc) continue
        const existing = byDay.get(day)
        if (existing) {
          await tx.itineraryDay.update({
            where: { id: existing.id },
            data: { summaryTextRaw: desc },
          })
        }
      }
    })
  }

  console.log(
    JSON.stringify(
      {
        apply,
        scanned,
        productsRewritten: dirty,
        daysRewritten: rewrittenDays,
        shortBefore,
        genericBefore,
        leakBefore,
      },
      null,
      2,
    ),
  )
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
