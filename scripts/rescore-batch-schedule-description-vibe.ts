/**
 * 배치 JSON(routeText)만으로 일정설명 region vibe 재점수 — 라이브 재수집 없이 개선폭 추정.
 * npx tsx scripts/rescore-batch-schedule-description-vibe.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  composeRegisterScheduleRegionVibeDescription,
  isRegisterScheduleGenericTourismDescription,
} from '@/lib/register-schedule-region-vibe'

type Day = {
  day?: number
  routeText?: string
  descriptionPreview?: string
}

type Item = {
  label?: string
  supplier?: string
  schedule?: Day[]
}

const batchPath =
  process.argv[2] ||
  path.join(process.cwd(), 'scripts/data/operator-url-batch-2026-07-17-full80-final-r3.json')

const items = JSON.parse(fs.readFileSync(batchPath, 'utf8')) as Item[]

let days = 0
let oldGeneric = 0
let newGeneric = 0
let rescued = 0
const bySupplier: Record<string, { days: number; oldG: number; newG: number }> = {}

for (const item of items) {
  const supplier = String(item.supplier ?? 'unknown')
  const sched = item.schedule ?? []
  const maxDay = sched.reduce((m, d) => Math.max(m, Number(d.day) || 0), 0)
  if (!bySupplier[supplier]) bySupplier[supplier] = { days: 0, oldG: 0, newG: 0 }
  for (const d of sched) {
    const day = Number(d.day) || 0
    if (day <= 1 || (maxDay >= 2 && day >= maxDay)) continue
    const route = String(d.routeText ?? '').trim()
    if (!route) continue
    const preview = String(d.descriptionPreview ?? '')
    const places = route.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean)
    const regional = composeRegisterScheduleRegionVibeDescription({
      day,
      maxDay,
      routePlaces: places,
      joinedBlob: route,
    })
    const wasGeneric = isRegisterScheduleGenericTourismDescription(preview)
    const stillGeneric = regional
      ? isRegisterScheduleGenericTourismDescription(regional)
      : wasGeneric
    days++
    bySupplier[supplier]!.days++
    if (wasGeneric) {
      oldGeneric++
      bySupplier[supplier]!.oldG++
    }
    if (stillGeneric) {
      newGeneric++
      bySupplier[supplier]!.newG++
    } else if (wasGeneric) {
      rescued++
    }
  }
}

console.log(
  JSON.stringify(
    {
      batch: path.basename(batchPath),
      middleDays: days,
      oldGeneric,
      newGenericIfRegionApplied: newGeneric,
      rescuedFromGeneric: rescued,
      oldRate: days ? Number((oldGeneric / days).toFixed(3)) : 0,
      newRate: days ? Number((newGeneric / days).toFixed(3)) : 0,
      bySupplier,
    },
    null,
    2,
  ),
)
