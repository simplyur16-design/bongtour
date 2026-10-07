/**
 * 등록대기(또는 --registered) 전수: imageKeyword 재적용+trip dedupe+heal 후 DB 저장.
 * 같은제목 pending 중복은 keeper 1건만 남기고 나머지 rejected.
 *
 *   npx tsx scripts/ops-heal-all-pending-register-quality.ts
 *   npx tsx scripts/ops-heal-all-pending-register-quality.ts --dry-run
 *   npx tsx scripts/ops-heal-all-pending-register-quality.ts --registered
 *   npx tsx scripts/ops-heal-all-pending-register-quality.ts --registered --dry-run
 */
import Module from 'node:module'
import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { Client } from 'pg'
import { normalizeRegisterIngestSameTitleKey } from '../lib/register-product-duplicate-guard'
import { applyRegisterScheduleImageKeywordsBySupplier } from '../lib/register-schedule-image-keywords-apply'
import {
  enforceRegisterScheduleTripUniqueImageKeywords,
  allowRouteRevisitBareVisitCitySoftDup,
} from '../lib/register-schedule-trip-image-keyword-dedupe'
import { healRegisterPrePhotoSchedule } from '../lib/register-pre-photo-self-heal'
import { normScheduleImageKeywordKey } from '../lib/register-schedule-llm-image-keyword-fallback'
import { isBareCityOrCountryKeyword } from '../lib/pexels-place-name-keyword'
import { resolveScheduleKeywordSlotKind } from '../lib/schedule-image-keyword-adjacent-poi'

register(pathToFileURL(join(process.cwd(), 'scripts/stub-server-only.mjs')).href)
const load = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === 'server-only') return {}
  return load.call(this, request, parent, isMain)
}

if (existsSync('.env.local')) loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true })

type DayRow = {
  day: number
  title?: string | null
  description?: string | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
  [k: string]: unknown
}

function countHardKwRepeats(days: DayRow[]): string[] {
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

function countEmptyMiddle(days: DayRow[]): number {
  const active = days.filter((d) => Number(d.day) > 0)
  const maxDay = Math.max(0, ...active.map((d) => Number(d.day) || 0))
  let n = 0
  for (const d of active) {
    const day = Number(d.day) || 0
    const slot = resolveScheduleKeywordSlotKind(day, maxDay, active.length)
    if (slot === 'middle' && !String(d.imageKeyword ?? '').trim()) n += 1
  }
  return n
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const registeredMode = process.argv.includes('--registered')
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!raw) throw new Error('no db')
  const url = raw.replace(/[?&]sslmode=[^&]*/gi, '').replace(/\?&/, '?').replace(/[?&]$/, '')
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const summary = {
    mode: registeredMode ? 'registered' : 'pending',
    loaded: 0,
    healed: 0,
    healFailed: 0,
    hardBefore: 0,
    hardAfter: 0,
    emptyMiddleBefore: 0,
    emptyMiddleAfter: 0,
    productsWithEmptyBefore: 0,
    productsWithEmptyAfter: 0,
    stillHard: [] as Array<{ code: string; repeated: string[] }>,
    sameTitleRejected: 0,
    sameTitleGroups: 0,
  }

  try {
    const pending = await c.query<{
      id: string
      origin_source: string
      origin_code: string
      title: string
      destination: string | null
      schedule: string
      created_at: Date
    }>(
      registeredMode
        ? `SELECT id::text AS id, "originSource" AS origin_source, "originCode" AS origin_code,
                  title, destination, schedule, "createdAt" AS created_at
             FROM "Product"
            WHERE COALESCE("registrationStatus",'pending') = 'registered'
              AND schedule IS NOT NULL AND schedule <> '' AND schedule <> '[]'
            ORDER BY "updatedAt" DESC`
        : `SELECT id::text AS id, "originSource" AS origin_source, "originCode" AS origin_code,
                  title, destination, schedule, "createdAt" AS created_at
             FROM "Product"
            WHERE COALESCE("registrationStatus",'pending') = 'pending'
              AND schedule IS NOT NULL AND schedule <> '' AND schedule <> '[]'
            ORDER BY "updatedAt" DESC`,
    )
    summary.loaded = pending.rowCount ?? 0
    console.log(`mode=${summary.mode} loaded=${summary.loaded} dryRun=${dryRun}`)

    for (let i = 0; i < pending.rows.length; i++) {
      const row = pending.rows[i]!
      if (i % 10 === 0) console.log(`progress ${i}/${pending.rows.length}`)
      let days: DayRow[]
      try {
        const parsed = JSON.parse(row.schedule)
        days = Array.isArray(parsed) ? parsed : []
      } catch {
        summary.healFailed += 1
        continue
      }
      if (!days.length) continue

      const before = countHardKwRepeats(days)
      const emptyBefore = countEmptyMiddle(days)
      if (before.length) summary.hardBefore += 1
      if (emptyBefore > 0) {
        summary.emptyMiddleBefore += emptyBefore
        summary.productsWithEmptyBefore += 1
      }

      try {
        const cleared = days.map((d) => ({ ...d, imageKeyword: '', imageKeyword2: null }))
        const applied = applyRegisterScheduleImageKeywordsBySupplier(cleared as any, {
          supplierKey: row.origin_source,
          productDestination: row.destination,
          productTitle: row.title,
        }) as DayRow[]
        const enforced = enforceRegisterScheduleTripUniqueImageKeywords(applied as any) as DayRow[]
        const healed = healRegisterPrePhotoSchedule(enforced as any, {
          supplierKey: row.origin_source,
          productDestination: row.destination,
          productTitle: row.title,
          lane: 'package',
        })
        const nextDays = enforceRegisterScheduleTripUniqueImageKeywords(healed.rows as any) as DayRow[]
        const byDay = new Map(nextDays.map((d) => [Number(d.day), d]))
        const merged = days.map((d) => {
          const h = byDay.get(Number(d.day))
          if (!h) return d
          return {
            ...d,
            imageKeyword: h.imageKeyword ?? '',
            imageKeyword2: h.imageKeyword2 ?? null,
            routeText: h.routeText ?? d.routeText,
            title: h.title ?? d.title,
            description: h.description ?? d.description,
          }
        })
        const after = countHardKwRepeats(merged)
        const emptyAfter = countEmptyMiddle(merged)
        if (after.length) {
          summary.hardAfter += 1
          summary.stillHard.push({ code: row.origin_code, repeated: after })
        }
        if (emptyAfter > 0) {
          summary.emptyMiddleAfter += emptyAfter
          summary.productsWithEmptyAfter += 1
        }
        if (!dryRun) {
          await c.query(`UPDATE "Product" SET schedule = $1::text, "updatedAt" = now() WHERE id = $2`, [
            JSON.stringify(merged),
            row.id,
          ])
        }
        summary.healed += 1
        if (before.length || after.length || emptyBefore !== emptyAfter) {
          console.log(
            JSON.stringify({
              code: row.origin_code,
              supplier: row.origin_source,
              before,
              after,
              emptyBefore,
              emptyAfter,
              title: row.title.slice(0, 60),
            }),
          )
        }
      } catch (e) {
        summary.healFailed += 1
        console.error('heal_fail', row.origin_code, e instanceof Error ? e.message : e)
      }
    }

    if (!registeredMode) {
      const allPending = await c.query<{
        id: string
        s: string
        c: string
        title: string
        ca: Date
      }>(
        `SELECT id::text AS id, "originSource" AS s, "originCode" AS c, title, "createdAt" AS ca
           FROM "Product"
          WHERE COALESCE("registrationStatus",'pending') = 'pending'
            AND COALESCE(title,'') <> ''`,
      )
      const byKey = new Map<string, typeof allPending.rows>()
      for (const r of allPending.rows) {
        const tk = normalizeRegisterIngestSameTitleKey(r.title)
        if (!tk) continue
        const k = `${r.s}||${tk}`
        const list = byKey.get(k) ?? []
        list.push(r)
        byKey.set(k, list)
      }
      for (const [, rows] of byKey) {
        if (rows.length < 2) continue
        summary.sameTitleGroups += 1
        const sorted = [...rows].sort((a, b) => b.ca.getTime() - a.ca.getTime())
        const drop = sorted.slice(1)
        for (const d of drop) {
          if (!dryRun) {
            await c.query(
              `UPDATE "Product"
                  SET "registrationStatus" = 'rejected',
                      "rejectReason" = $1,
                      "rejectedAt" = now(),
                      "updatedAt" = now()
                WHERE id = $2
                  AND COALESCE("registrationStatus",'pending') = 'pending'`,
              [`same_title_dedupe_keep_${sorted[0]!.c}`.slice(0, 200), d.id],
            )
          }
          summary.sameTitleRejected += 1
          console.log(
            JSON.stringify({
              action: 'reject_same_title',
              keep: sorted[0]!.c,
              reject: d.c,
              title: d.title.slice(0, 70),
            }),
          )
        }
      }
    }

    console.log(
      'SUMMARY',
      JSON.stringify({ ...summary, dryRun, stillHard: summary.stillHard.slice(0, 40) }, null, 2),
    )
  } finally {
    await c.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
