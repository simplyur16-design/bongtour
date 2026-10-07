/**
 * 등록대기 imageKeyword 품질 리포트 (읽기 전용).
 *   npx tsx scripts/ops-report-pending-image-keyword-quality.ts
 */
import Module from 'node:module'
import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { Client } from 'pg'
import {
  allowRouteRevisitBareVisitCitySoftDup,
} from '../lib/register-schedule-trip-image-keyword-dedupe'
import { normScheduleImageKeywordKey } from '../lib/register-schedule-llm-image-keyword-fallback'
import { isBareCityOrCountryKeyword, isLikelyTourismLandmarkKeyword } from '../lib/pexels-place-name-keyword'
import { resolveScheduleKeywordSlotKind } from '../lib/schedule-image-keyword-adjacent-poi'

register(pathToFileURL(join(process.cwd(), 'scripts/stub-server-only.mjs')).href)
const load = (Module as any)._load
;(Module as any)._load = function (r: unknown, p: unknown, m: unknown) {
  if (r === 'server-only') return {}
  return load.call(this, r, p, m)
}
if (existsSync('.env.local')) loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true })

type DayRow = {
  day: number
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

function parseDays(raw: string): DayRow[] {
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function hardRepeats(days: DayRow[]): string[] {
  const maxDay = Math.max(0, ...days.map((d) => Number(d.day) || 0))
  const used = new Map<string, number>()
  const hard: string[] = []
  for (const d of days) {
    const day = Number(d.day) || 0
    for (const slot of [d.imageKeyword, d.imageKeyword2]) {
      const kw = String(slot || '').trim()
      if (!kw) continue
      const key = normScheduleImageKeywordKey(kw) || kw.toLowerCase()
      const prev = used.get(key)
      if (prev != null && prev !== day) {
        const bare = isBareCityOrCountryKeyword(kw)
        const edgeOnly =
          bare && (prev === 1 || prev === maxDay) && (day === 1 || day === maxDay)
        const softVisitBare = bare && allowRouteRevisitBareVisitCitySoftDup(kw)
        if (!edgeOnly && !softVisitBare && !hard.includes(kw)) hard.push(kw)
      } else {
        used.set(key, day)
      }
    }
  }
  return hard
}

function analyze(days: DayRow[]) {
  const active = days.filter((d) => Number(d.day) > 0)
  const maxDay = Math.max(0, ...active.map((d) => Number(d.day) || 0))
  const activeDays = active.length
  let emptyMiddle = 0
  let middleTotal = 0
  let bareMiddle = 0
  let landmarkMiddle = 0
  let kw2Filled = 0
  let koreanKw = 0
  let softBareDup = 0
  const usedBare = new Map<string, number>()

  for (const d of active) {
    const day = Number(d.day) || 0
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, activeDays)
    const kw = String(d.imageKeyword ?? '').trim()
    const kw2 = String(d.imageKeyword2 ?? '').trim()
    if (/[\uAC00-\uD7AF]/.test(kw) || /[\uAC00-\uD7AF]/.test(kw2)) koreanKw += 1
    if (kw2) kw2Filled += 1
    if (slot === 'middle') {
      middleTotal += 1
      if (!kw) emptyMiddle += 1
      else if (isBareCityOrCountryKeyword(kw)) {
        bareMiddle += 1
        const nk = normScheduleImageKeywordKey(kw)
        if (nk) {
          const prev = usedBare.get(nk)
          if (prev != null && allowRouteRevisitBareVisitCitySoftDup(kw)) softBareDup += 1
          else usedBare.set(nk, day)
        }
      } else if (isLikelyTourismLandmarkKeyword(kw)) landmarkMiddle += 1
    }
  }
  return {
    days: activeDays,
    hard: hardRepeats(days),
    emptyMiddle,
    middleTotal,
    bareMiddle,
    landmarkMiddle,
    kw2Filled,
    koreanKw,
    softBareDup,
  }
}

async function main() {
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!raw) throw new Error('no db')
  const url = raw.replace(/[?&]sslmode=[^&]*/gi, '').replace(/\?&/, '?').replace(/[?&]$/, '')
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const { rows } = await c.query<{
      id: string
      s: string
      code: string
      title: string
      schedule: string
    }>(
      `SELECT id::text, "originSource" AS s, "originCode" AS code, title, schedule
         FROM "Product"
        WHERE COALESCE("registrationStatus",'pending') = 'pending'
          AND schedule IS NOT NULL AND schedule <> '' AND schedule <> '[]'
        ORDER BY "updatedAt" DESC`,
    )

    const bySupplier = new Map<string, number>()
    let hardProducts = 0
    let emptyMiddleProducts = 0
    let koreanProducts = 0
    let landmarkOkProducts = 0
    const hardSamples: Array<{ code: string; s: string; hard: string[]; title: string }> = []
    const emptySamples: Array<{ code: string; s: string; empty: number; middle: number; title: string }> = []
    const sampleGood: Array<{ code: string; s: string; title: string; kws: string[] }> = []

    for (const row of rows) {
      bySupplier.set(row.s, (bySupplier.get(row.s) ?? 0) + 1)
      const days = parseDays(row.schedule)
      const a = analyze(days)
      if (a.hard.length) {
        hardProducts += 1
        if (hardSamples.length < 15) {
          hardSamples.push({
            code: row.code,
            s: row.s,
            hard: a.hard,
            title: row.title.slice(0, 50),
          })
        }
      }
      if (a.emptyMiddle > 0) {
        emptyMiddleProducts += 1
        if (emptySamples.length < 12) {
          emptySamples.push({
            code: row.code,
            s: row.s,
            empty: a.emptyMiddle,
            middle: a.middleTotal,
            title: row.title.slice(0, 50),
          })
        }
      }
      if (a.koreanKw > 0) koreanProducts += 1
      if (
        !a.hard.length &&
        a.emptyMiddle === 0 &&
        a.middleTotal > 0 &&
        a.landmarkMiddle >= Math.ceil(a.middleTotal * 0.5)
      ) {
        landmarkOkProducts += 1
        if (sampleGood.length < 8) {
          sampleGood.push({
            code: row.code,
            s: row.s,
            title: row.title.slice(0, 45),
            kws: days
              .filter((d) => Number(d.day) > 0)
              .slice(0, 8)
              .map((d) => String(d.imageKeyword ?? '').trim() || '∅'),
          })
        }
      }
    }

    // 2EZZ8308 spotlight
    const myk = rows.find((r) => r.code === '2EZZ8308')
    let mykonos: unknown = null
    if (myk) {
      const days = parseDays(myk.schedule)
      mykonos = {
        code: '2EZZ8308',
        hard: hardRepeats(days),
        days: days
          .filter((d) => Number(d.day) > 0)
          .map((d) => ({
            d: d.day,
            kw: d.imageKeyword ?? '',
            k2: d.imageKeyword2 ?? null,
          })),
      }
    }

    console.log(
      JSON.stringify(
        {
          pendingWithSchedule: rows.length,
          bySupplier: Object.fromEntries([...bySupplier.entries()].sort((a, b) => b[1] - a[1])),
          quality: {
            hardRepeatProducts: hardProducts,
            emptyMiddleProducts,
            koreanKwProducts: koreanProducts,
            landmarkHeavyOkProducts: landmarkOkProducts,
            hardRepeatRate: `${hardProducts}/${rows.length}`,
            emptyMiddleRate: `${emptyMiddleProducts}/${rows.length}`,
          },
          spotlight_2EZZ8308: mykonos,
          hardSamples,
          emptyMiddleSamples: emptySamples,
          goodSamples: sampleGood,
        },
        null,
        2,
      ),
    )
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
