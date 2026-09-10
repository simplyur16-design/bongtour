/**
 * 등록대기 전 상품 1건씩 전수 검수(+셀프힐).
 * Usage:
 *   npx tsx scripts/audit-pending-one-by-one-full.ts
 *   npx tsx scripts/audit-pending-one-by-one-full.ts --apply
 *   npx tsx scripts/audit-pending-one-by-one-full.ts --apply --heal-all
 */
import Module from 'node:module'
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE } from '../lib/register-pre-photo-pending-queue-query'
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhotoForStoredProduct,
} from '../lib/register-pre-photo-verify'
import { isRegisterPrePhotoPendingQueueReady } from '../lib/register-pre-photo-pending-queue'
import {
  productCountryScheduleMismatchIssues,
  strongOtherCountryKeysFromHay,
} from '../lib/register-pre-photo-product-country-schedule-guard'
import { pendingNeedsCountryScheduleGeoHeal } from '../lib/register-pre-photo-country-schedule-self-heal'

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

const ROOT = process.cwd()
for (const f of ['.env.local', '.env']) {
  const p = path.join(ROOT, f)
  if (existsSync(p)) config({ path: p, override: f === '.env.local' })
}

const OUT_DIR = path.join(ROOT, 'scripts/data')
const OUT = path.join(OUT_DIR, '_tmp_pending_one_by_one_full.json')

type RowOut = {
  id: string
  src: string | null
  ck: string | null
  st: string | null
  title: string
  dest: string
  liveOk: boolean
  issues: string[]
  countryMismatch: string[]
  needsGeoHeal: boolean
  hintKeys: string[]
  dayTitles: string
  heal?: unknown
  after?: { ck: string | null; st: string | null; liveOk: boolean; issues: string[] }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const healAll = process.argv.includes('--heal-all')
  const prisma = new PrismaClient()
  const healMod = apply ? await import('../lib/register-pending-pre-photo-self-heal') : null

  try {
    const rows = await prisma.product.findMany({
      where: {
        OR: [
          REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
          {
            registrationStatus: 'pre_photo_blocked',
            rejectReason: { startsWith: 'product_country_schedule_mismatch' },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        originSource: true,
        countryKey: true,
        destination: true,
        schedule: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        registrationStatus: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const report: RowOut[] = []
    let liveBefore = 0
    let failBefore = 0
    let healed = 0
    let stillFail = 0

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      const schedRows = scheduleRowsForPrePhotoVerify(r.schedule)
      const v = verifyRegisterPrePhotoForStoredProduct(r)
      const liveOk = isRegisterPrePhotoPendingQueueReady(v)
      if (liveOk) liveBefore += 1
      else failBefore += 1

      const countryMismatch = productCountryScheduleMismatchIssues({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: schedRows,
      })
      const needsGeoHeal = pendingNeedsCountryScheduleGeoHeal({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: schedRows,
      })
      const hay = [
        String(r.title ?? ''),
        String(r.destination ?? ''),
        ...schedRows.map((d) => `${d.title ?? ''} ${d.routeText ?? ''} ${d.description ?? ''}`),
      ].join('\n')
      const hintKeys = strongOtherCountryKeysFromHay(hay, r.countryKey)

      const item: RowOut = {
        id: r.id,
        src: r.originSource,
        ck: r.countryKey,
        st: r.registrationStatus,
        title: String(r.title ?? '').slice(0, 90),
        dest: String(r.destination ?? '').slice(0, 40),
        liveOk,
        issues: v.issues.slice(0, 12),
        countryMismatch,
        needsGeoHeal,
        hintKeys,
        dayTitles: schedRows
          .map((d) => `D${d.day}:${String(d.title ?? '').slice(0, 18)}`)
          .join('|')
          .slice(0, 220),
      }

      const shouldHeal = apply && healMod && (healAll || !liveOk || needsGeoHeal || countryMismatch.length > 0)
      if (shouldHeal) {
        const result = await healMod.healPendingRegisterPrePhoto({
          productId: r.id,
          limit: 1,
          dryRun: false,
          probeImageUrls: false,
        })
        item.heal = {
          healed: result.healed,
          verified: result.verified,
          verifyFailed: result.verifyFailed,
          blocked: result.blocked,
          promoted: result.promoted,
          notes: result.notesSample.slice(0, 3),
        }
        healed += 1
        const after = await prisma.product.findUnique({
          where: { id: r.id },
          select: {
            id: true,
            title: true,
            originSource: true,
            countryKey: true,
            destination: true,
            schedule: true,
            listingKind: true,
            productType: true,
            sportsThemeTag: true,
            registrationStatus: true,
          },
        })
        if (after) {
          const v2 = verifyRegisterPrePhotoForStoredProduct(after)
          const ok2 = isRegisterPrePhotoPendingQueueReady(v2)
          item.after = {
            ck: after.countryKey,
            st: after.registrationStatus,
            liveOk: ok2,
            issues: v2.issues.slice(0, 12),
          }
          if (!ok2) stillFail += 1
        }
      } else if (!liveOk) {
        stillFail += 1
      }

      report.push(item)
      if ((i + 1) % 20 === 0 || i === rows.length - 1) {
        console.log(`[full] ${i + 1}/${rows.length} liveOk=${liveBefore} fail=${failBefore} healed=${healed}`)
      }
    }

    mkdirSync(OUT_DIR, { recursive: true })
    const summary = {
      scanned: rows.length,
      liveBefore,
      failBefore,
      apply,
      healAll,
      healed,
      stillFailAfterHeal: stillFail,
      failIds: report.filter((x) => !(x.after?.liveOk ?? x.liveOk)).map((x) => x.id),
      needsGeoHealIds: report.filter((x) => x.needsGeoHeal).map((x) => x.id),
      byCountryLive: report
        .filter((x) => x.after?.liveOk ?? x.liveOk)
        .reduce<Record<string, number>>((acc, x) => {
          const k = String(x.after?.ck ?? x.ck ?? '(null)')
          acc[k] = (acc[k] || 0) + 1
          return acc
        }, {}),
      issueCounts: report
        .filter((x) => !(x.after?.liveOk ?? x.liveOk))
        .flatMap((x) => x.after?.issues ?? x.issues)
        .reduce<Record<string, number>>((acc, issue) => {
          const k = issue.replace(/day\d+_/, 'dayN_')
          acc[k] = (acc[k] || 0) + 1
          return acc
        }, {}),
    }
    writeFileSync(OUT, JSON.stringify({ summary, rows: report }, null, 2), 'utf8')
    console.log(JSON.stringify(summary, null, 2))
    console.log(`[full] wrote ${OUT}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
