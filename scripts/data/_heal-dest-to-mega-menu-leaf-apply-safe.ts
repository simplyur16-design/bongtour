/**
 * alignDestinationToMegaMenuLeaf 결과를 prod에 적용.
 * 등록(registered) + 등록대기(pending) 해외 상품 전수.
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
  isSportsThemeMegaMenuLeaf,
} from '@/lib/align-destination-to-mega-menu-leaf'
import { isRegisterDestinationPollutionLabel } from '@/lib/register-destination-finalize'

const apply = process.argv.includes('--apply')
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || process.env.DIRECT_URL,
})

async function main() {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: { in: ['registered', 'pending'] },
      travelScope: 'overseas',
    },
    select: {
      id: true,
      slug: true,
      title: true,
      registrationStatus: true,
      primaryDestination: true,
      destination: true,
      destinationRaw: true,
      cityKey: true,
      countryKey: true,
    },
  })

  const changes: Array<{
    slug: string | null
    status: string | null
    before: string
    after: string
    reason: string
  }> = []
  const stillBad: Array<{
    slug: string | null
    status: string | null
    dest: string
    kind: string
  }> = []
  const byStatus = { registered: { total: 0, change: 0, stillBad: 0 }, pending: { total: 0, change: 0, stillBad: 0 } }

  for (const p of rows) {
    const st = (p.registrationStatus === 'pending' ? 'pending' : 'registered') as 'pending' | 'registered'
    byStatus[st].total += 1
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
        stillBad.push({ slug: p.slug, status: st, dest: before, kind: k })
        byStatus[st].stillBad += 1
      }
      continue
    }
    const afterKind = classifyMegaMenuDestinationLabel(target)
    if (afterKind !== 'city' && afterKind !== 'country') continue
    // 테마여행 leaf는 geo dest로 쓰지 않음
    if (isSportsThemeMegaMenuLeaf(target)) continue

    changes.push({ slug: p.slug, status: st, before, after: target, reason })
    byStatus[st].change += 1
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
    byStatus,
    changeCount: changes.length,
    stillBadCount: stillBad.length,
    changes,
    stillBad,
  }
  const outPath = path.join(__dirname, '_heal-dest-mega-leaf-safe.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log(
    JSON.stringify(
      {
        apply,
        total: rows.length,
        byStatus,
        changeCount: changes.length,
        stillBadCount: stillBad.length,
        changes: changes.map(
          (c) => `${c.status}|${c.before}→${c.after} | ${c.slug} | ${c.reason}`,
        ),
        stillBad,
        outPath,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
