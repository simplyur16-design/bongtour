/**
 * alignDestinationToMegaMenuLeaf 결과를 prod에 적용.
 * 하이브리드 오매칭(호놀룰루→LA 등)은 align SSOT가 이미 차단.
 *
 *   railway run --service bongtour -- npx tsx scripts/data/_heal-dest-to-mega-menu-leaf-apply-safe.ts
 *   railway run --service bongtour -- npx tsx scripts/data/_heal-dest-to-mega-menu-leaf-apply-safe.ts --apply
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

  const changes: Array<{
    slug: string | null
    before: string
    after: string
    reason: string
  }> = []
  const stillBad: Array<{ slug: string | null; dest: string; kind: string }> = []

  for (const p of rows) {
    const before = String(p.primaryDestination || p.destination || '').trim()
    const { destination: target, reason } = alignDestinationToMegaMenuLeaf({
      current: before,
      title: p.title,
      cityKey: p.cityKey,
      countryKey: p.countryKey,
    })
    if (!target || target === before) {
      const k = classifyMegaMenuDestinationLabel(before)
      if (k === 'group' || k === 'other' || isRegisterDestinationPollutionLabel(before)) {
        stillBad.push({ slug: p.slug, dest: before, kind: k })
      }
      continue
    }
    const afterKind = classifyMegaMenuDestinationLabel(target)
    if (afterKind !== 'city' && afterKind !== 'country') continue

    changes.push({ slug: p.slug, before, after: target, reason })
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

  const out = { apply, total: rows.length, changeCount: changes.length, stillBadCount: stillBad.length, changes, stillBad }
  const outPath = path.join(__dirname, '_heal-dest-mega-leaf-safe.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify({ apply, total: rows.length, changeCount: changes.length, stillBadCount: stillBad.length, changes: changes.map((c) => `${c.before}→${c.after} | ${c.slug} | ${c.reason}`), stillBad, outPath }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
