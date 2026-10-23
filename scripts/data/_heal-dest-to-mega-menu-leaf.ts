/**
 * primaryDestination/destination → 메가메뉴 city/country leaf 정합 (그룹명·오염 제거).
 *
 *   railway run --service bongtour -- npx tsx scripts/data/_heal-dest-to-mega-menu-leaf.ts
 *   railway run --service bongtour -- npx tsx scripts/data/_heal-dest-to-mega-menu-leaf.ts --apply
 */
import '../load-env-for-scripts'
import { writeFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import {
  alignDestinationToMegaMenuLeaf,
  classifyMegaMenuDestinationLabel,
} from '@/lib/align-destination-to-mega-menu-leaf'
import { isRegisterDestinationPollutionLabel } from '@/lib/register-destination-finalize'

const apply = process.argv.includes('--apply')
// Local railway run: pooler DATABASE_URL often works when DIRECT 5432 is firewalled.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || process.env.DIRECT_URL,
})

async function main() {
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered', travelScope: 'overseas' },
    select: {
      id: true,
      slug: true,
      title: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      cityKey: true,
      countryKey: true,
    },
  })

  type Change = {
    slug: string | null
    before: string
    after: string
    reason: string
    beforeKind: string
    cityKey: string | null
    countryKey: string | null
  }
  const changes: Change[] = []
  const stillBad: Array<{ slug: string | null; dest: string; kind: string; cityKey: string | null }> = []

  for (const p of rows) {
    const before = String(p.primaryDestination || p.destination || '').trim()
    const beforeKind = classifyMegaMenuDestinationLabel(before)
    const { destination: target, reason } = alignDestinationToMegaMenuLeaf({
      current: before,
      title: p.title,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    })

    if (!target || target === before || reason === 'already_mega_leaf' || reason === 'unchanged') {
      const afterKind = classifyMegaMenuDestinationLabel(before)
      if (afterKind === 'group' || afterKind === 'other' || isRegisterDestinationPollutionLabel(before)) {
        stillBad.push({ slug: p.slug, dest: before, kind: afterKind, cityKey: p.cityKey })
      }
      continue
    }

    changes.push({
      slug: p.slug,
      before,
      after: target,
      reason,
      beforeKind,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    })

    if (apply) {
      const raw = String(p.destinationRaw ?? '').trim()
      const rawKind = classifyMegaMenuDestinationLabel(raw)
      const nextRaw =
        !raw ||
        raw === before ||
        isRegisterDestinationPollutionLabel(raw) ||
        rawKind === 'group' ||
        rawKind === 'other'
          ? target
          : raw
      await prisma.product.update({
        where: { id: p.id },
        data: {
          primaryDestination: target,
          destination: target,
          destinationRaw: nextRaw,
        },
      })
    }
  }

  const out = {
    apply,
    total: rows.length,
    changeCount: changes.length,
    stillBadCount: stillBad.length,
    byReason: changes.reduce(
      (acc, c) => {
        acc[c.reason] = (acc[c.reason] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    ),
    byBeforeKind: changes.reduce(
      (acc, c) => {
        acc[c.beforeKind] = (acc[c.beforeKind] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    ),
    changes,
    stillBad: stillBad.slice(0, 60),
  }

  const outPath = path.join(
    process.cwd(),
    'scripts/data',
    `_heal-dest-mega-leaf-${apply ? 'apply' : 'dry'}.json`,
  )
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(
    JSON.stringify(
      {
        apply,
        total: out.total,
        changeCount: out.changeCount,
        stillBadCount: out.stillBadCount,
        byReason: out.byReason,
        byBeforeKind: out.byBeforeKind,
        outPath,
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
