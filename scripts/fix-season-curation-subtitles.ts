/**
 * 시즌 큐레이션 부제목 나열형 교정.
 * npx tsx scripts/fix-season-curation-subtitles.ts
 * npx tsx scripts/fix-season-curation-subtitles.ts --apply
 */
import './load-env-for-scripts'

import { prisma } from '@/lib/prisma'
import {
  buildSeasonCurationSublineFallback,
  firstSentenceFromText,
  isValidSeasonCurationSubtitle,
} from '@/lib/season-curation-subline'
import { resolveSeasonCurationSubline } from '@/lib/season-curation-subline'
import { seasonHeroTargetMonthsForBase, seasonHeroBaseMonthFromCycleStart } from '@/lib/season-hero-target-months'

const apply = process.argv.includes('--apply')

function fixMonthlySubtitle(row: {
  monthKey: string | null
  title: string
  subtitle: string | null
  bodyKr: string | null
  countryCode: string | null
}): string | null {
  const current = (row.subtitle ?? '').trim()
  if (isValidSeasonCurationSubtitle(current)) return null

  const fromBody = firstSentenceFromText(row.bodyKr ?? '', 72)
  if (isValidSeasonCurationSubtitle(fromBody)) return fromBody

  const m = parseInt((row.monthKey ?? '').split('-')[1] ?? '0', 10)
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  const place = (row.countryCode ?? '').trim() || row.title.split(/[,，]/)[0]?.trim() || '여행지'
  return buildSeasonCurationSublineFallback(m, place)
}

async function main() {
  const monthly = await prisma.monthlyCurationContent.findMany({
    where: { pageScope: 'overseas' },
    select: { id: true, monthKey: true, title: true, subtitle: true, bodyKr: true, countryCode: true },
  })

  let monthlyFixed = 0
  for (const row of monthly) {
    const next = fixMonthlySubtitle(row)
    if (!next || next === (row.subtitle ?? '').trim()) continue
    console.log(`[monthly] ${row.monthKey} ${row.title.slice(0, 40)}`)
    console.log(`  before: ${row.subtitle}`)
    console.log(`  after:  ${next}`)
    if (apply) {
      await prisma.monthlyCurationContent.update({ where: { id: row.id }, data: { subtitle: next } })
    }
    monthlyFixed++
  }

  const cycles = await prisma.seasonalDestinationCuration.findMany({
    orderBy: { cycleStartDate: 'desc' },
    take: 3,
    select: { id: true, cycleStartDate: true, cityKeys: true, geminiResponse: true },
  })

  let cycleFixed = 0
  for (const cycle of cycles) {
    const resp = cycle.geminiResponse as { reasoning?: Record<string, string> } | null
    const reasoning = resp?.reasoning
    if (!reasoning || !cycle.cityKeys.length) continue

    const baseMonth = seasonHeroBaseMonthFromCycleStart(cycle.cycleStartDate, 6)
    const months = seasonHeroTargetMonthsForBase(baseMonth)
    const cities = await prisma.city.findMany({
      where: { cityKey: { in: [...cycle.cityKeys] } },
      include: { country: true },
    })
    const meta = new Map(cities.map((c) => [c.cityKey, c]))

    const nextReasoning = { ...reasoning }
    let changed = false
    for (let i = 0; i < cycle.cityKeys.length; i++) {
      const ck = cycle.cityKeys[i]!
      const current = (reasoning[ck] ?? '').trim()
      if (isValidSeasonCurationSubtitle(current)) continue

      const c = meta.get(ck)
      const fixed = resolveSeasonCurationSubline({
        targetMonth1To12: months[i] ?? months[0]!,
        geminiLine: reasoning[ck],
        cityLabel: c?.koreanLabel ?? ck,
        countryLabel: c?.country?.koreanLabel ?? null,
      })
      if (fixed !== current) {
        nextReasoning[ck] = fixed
        changed = true
        console.log(`[cycle] ${ck}`)
        console.log(`  before: ${reasoning[ck]}`)
        console.log(`  after:  ${fixed}`)
      }
    }
    if (changed && apply) {
      await prisma.seasonalDestinationCuration.update({
        where: { id: cycle.id },
        data: {
          geminiResponse: { ...(resp as object), reasoning: nextReasoning },
        },
      })
      cycleFixed++
    } else if (changed) {
      cycleFixed++
    }
  }

  console.log(`\nmonthlyFixed=${monthlyFixed} cycleFixed=${cycleFixed} apply=${apply}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
