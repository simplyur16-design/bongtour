/**
 * registered 상품 — 오염 primaryDestination/destination + HTML 엔티티 제목 + 커버 이미지 공백 heal.
 *
 * railway run --service bongtour -- npx tsx scripts/data/heal-registered-polluted-dest-covers.ts
 * railway run --service bongtour -- npx tsx scripts/data/heal-registered-polluted-dest-covers.ts --apply
 *
 * REGRESSION-FREEZE[register-destination-reject-ilju]: prod dest heal — manifest
 */
import '../load-env-for-scripts'
import { writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import {
  collapseAdjacentDuplicateTitlePhrases,
  decodePublicHtmlEntities,
} from '../../lib/decode-public-html-entities'
import {
  isPollutedPublicProductTitle,
  isUmbrellaMegaRegionPlaceLabel,
} from '../../lib/bongtour-product-display-title-ssot'
import { isRegisterDestinationScheduleActivityToken } from '../../lib/register-destination-schedule-activity-noise'
import { finalizeRegisterDestinationFields } from '../../lib/register-destination-finalize'
import { normalizeSupplierRegisterListingTitle } from '../../lib/supplier-product-title-display'
import { getScheduleFromProduct } from '../../lib/schedule-from-product'
import { getFinalCoverImageUrl } from '../../lib/final-image-selection'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()

const DEST_NOISE_SQL = [
  '공장',
  '가든',
  '사이클링',
  '식비',
  '덴마구',
  '실속',
  '금까',
  '주조',
  '스위트피아',
  '해안선',
  '현지투어',
  '&harr',
  '&rarr',
  'The Rocks',
  '중국권',
]

function destLooksPolluted(s: string | null | undefined): boolean {
  const t = String(s || '').trim()
  if (!t) return false
  if (isUmbrellaMegaRegionPlaceLabel(t)) return true
  if (isPollutedPublicProductTitle(t)) return true
  if (isRegisterDestinationScheduleActivityToken(t)) return true
  if (/([가-힣A-Za-z0-9]{2,})(?:\s+\1)/u.test(t)) return true
  if (/&(?:harr|rarr|larr|hearts|amp);?/i.test(t)) return true
  if (/공장|가든|사이클링|식비|덴마구|실속|금까|주조|스위트피아|해안선/i.test(t)) return true
  return false
}

function titleNeedsScrub(title: string): boolean {
  const raw = String(title || '')
  if (/&(?:harr|rarr|larr|hearts);?/i.test(raw)) return true
  if (/([가-힣A-Za-z0-9]{2,})(?:\s+\1)/u.test(raw)) return true
  if (isPollutedPublicProductTitle(raw)) return true
  return false
}

async function main() {
  // Prisma contains 누락 방지 — SQL로 후보 id 먼저 수집
  const idRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Product"
     WHERE "registrationStatus" = 'registered'
       AND (
         COALESCE("primaryDestination",'') ~ '(공장|가든|사이클링|식비|덴마구|실속|금까|주조|스위트피아|해안선|&harr|&rarr|The Rocks|중국권|류게츠|덴마구)'
         OR COALESCE(destination,'') ~ '(공장|가든|사이클링|식비|덴마구|실속|금까|주조|&harr|자유\\s*식비)'
         OR COALESCE("destinationRaw",'') ~ '(공장|가든|사이클링|식비|실속|금까|주조|&harr)'
         OR title ~ '(&harr|&rarr|주조공장|자유\\s*식비|실속\\s+실속|홍콩실속\\s+홍콩실속)'
         OR COALESCE("primaryRegion",'') ~ '중국권'
         OR (
           ("bgImageUrl" IS NULL OR btrim("bgImageUrl") = '')
           AND schedule IS NOT NULL
           AND schedule ILIKE '%"imageUrl"%'
         )
       )
     LIMIT 8000`,
  )
  const ids = idRows.map((r) => r.id)
  const candidates =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            originCode: true,
            title: true,
            duration: true,
            primaryDestination: true,
            destination: true,
            destinationRaw: true,
            primaryRegion: true,
            countryKey: true,
            bgImageUrl: true,
            schedule: true,
          },
        })

  type Plan = {
    id: string
    originCode: string
    reason: string[]
    before: Record<string, unknown>
    after: Record<string, unknown>
  }
  const plans: Plan[] = []
  let coverOnly = 0
  let destHeal = 0
  let titleHeal = 0

  for (const p of candidates) {
    const reason: string[] = []
    const data: {
      title?: string
      primaryDestination?: string | null
      destination?: string | null
      destinationRaw?: string | null
      primaryRegion?: string | null
      bgImageUrl?: string | null
    } = {}

    if (p.primaryRegion && isUmbrellaMegaRegionPlaceLabel(p.primaryRegion)) {
      data.primaryRegion = null
      reason.push('umbrella_region')
    }

    const destPolluted =
      destLooksPolluted(p.primaryDestination) ||
      destLooksPolluted(p.destination) ||
      destLooksPolluted(p.destinationRaw)

    if (destPolluted) {
      const fin = finalizeRegisterDestinationFields({
        title: p.title,
        destination: p.destination,
        destinationRaw: p.destinationRaw,
        primaryDestination: p.primaryDestination,
        countryKey: p.countryKey,
      })
      if (fin.primaryDestination !== p.primaryDestination) {
        data.primaryDestination = fin.primaryDestination
        reason.push('primaryDestination')
      }
      if (fin.destination !== (p.destination ?? '')) {
        data.destination = fin.destination || null
        reason.push('destination')
      }
      if (fin.destinationRaw !== p.destinationRaw) {
        data.destinationRaw = fin.destinationRaw
        reason.push('destinationRaw')
      }
      destHeal++
    }

    // Plan B Product.title 은 short 카드명으로 절대 덮어쓰지 않음 — 엔티티·중복 어절만 정리
    if (titleNeedsScrub(p.title)) {
      const decoded = collapseAdjacentDuplicateTitlePhrases(decodePublicHtmlEntities(p.title))
      const planB = normalizeSupplierRegisterListingTitle(decoded)
      const next = (planB || decoded).slice(0, 90)
      // short「X N박 M일」로 치환 금지
      if (next && next !== p.title && !/^\S+\s+\d+박\s*\d+일$/.test(next.trim())) {
        data.title = next
        reason.push('title')
        titleHeal++
      }
    }

    const bg = (p.bgImageUrl ?? '').trim()
    if (!bg) {
      const days = getScheduleFromProduct({ schedule: p.schedule, title: p.title })
      const cover = getFinalCoverImageUrl({ bgImageUrl: null, scheduleDays: days })
      if (cover) {
        data.bgImageUrl = cover
        reason.push('cover_from_schedule')
        coverOnly++
      }
    }

    if (reason.length === 0) continue
    plans.push({
      id: p.id,
      originCode: p.originCode,
      reason,
      before: {
        title: p.title,
        primaryDestination: p.primaryDestination,
        destination: p.destination,
        primaryRegion: p.primaryRegion,
        bgImageUrl: p.bgImageUrl,
      },
      after: data,
    })
  }

  const outPath = 'scripts/data/_heal-registered-polluted-dest-covers.json'
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        apply: APPLY,
        scanned: candidates.length,
        plans: plans.length,
        destHeal,
        titleHeal,
        coverFromSchedule: coverOnly,
        sample: plans.slice(0, 40),
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(
    JSON.stringify({
      apply: APPLY,
      scanned: candidates.length,
      plans: plans.length,
      destHeal,
      titleHeal,
      coverFromSchedule: coverOnly,
      out: outPath,
    }),
  )

  if (!APPLY) {
    console.log('dry-run — re-run with --apply to write')
    return
  }

  let updated = 0
  for (const plan of plans) {
    await prisma.product.update({
      where: { id: plan.id },
      data: plan.after as Parameters<typeof prisma.product.update>[0]['data'],
    })
    updated++
    if (updated % 50 === 0) console.log(`updated=${updated}/${plans.length}`)
  }
  console.log(`updated=${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
