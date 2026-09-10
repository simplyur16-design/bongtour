/**
 * countryKey≠일정 mismatch 건 — geo 재부여 포함 셀프힐 (격리만 하지 않음).
 * Usage:
 *   npx tsx scripts/heal-pending-country-schedule-mismatch.ts           # dry
 *   npx tsx scripts/heal-pending-country-schedule-mismatch.ts --apply
 *   npx tsx scripts/heal-pending-country-schedule-mismatch.ts --apply --id=cmxxx
 */
import Module from 'node:module'
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'fs'
import path from 'path'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE } from '../lib/register-pre-photo-pending-queue-query'
import { scheduleRowsForPrePhotoVerify, verifyRegisterPrePhotoForStoredProduct } from '../lib/register-pre-photo-verify'
import { productCountryScheduleMismatchIssues, strongOtherCountryKeysFromHay } from '../lib/register-pre-photo-product-country-schedule-guard'

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

async function main() {
  const apply = process.argv.includes('--apply')
  const idArg = process.argv.find((a) => a.startsWith('--id='))?.slice('--id='.length)?.trim()
  const prisma = new PrismaClient()
  const { healPendingRegisterPrePhoto } = await import('../lib/register-pending-pre-photo-self-heal')

  try {
    const rows = await prisma.product.findMany({
      where: idArg
        ? { id: idArg }
        : {
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
        rejectReason: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const targets: typeof rows = []
    for (const r of rows) {
      if (idArg) {
        targets.push(r)
        continue
      }
      const schedRows = scheduleRowsForPrePhotoVerify(r.schedule)
      const mismatch = productCountryScheduleMismatchIssues({
        countryKey: r.countryKey,
        productTitle: r.title,
        productDestination: r.destination,
        rows: schedRows,
      })
      const v = verifyRegisterPrePhotoForStoredProduct(r)
      const blockedMismatch =
        r.registrationStatus === 'pre_photo_blocked' &&
        String(r.rejectReason ?? '').startsWith('product_country_schedule_mismatch')
      const emptyCkWithBody =
        !String(r.countryKey ?? '').trim() &&
        strongOtherCountryKeysFromHay(
          [
            String(r.title ?? ''),
            String(r.destination ?? ''),
            ...schedRows.map((d) => `${d.title ?? ''} ${d.routeText ?? ''} ${d.description ?? ''}`),
          ].join('\n'),
          null,
        ).length > 0
      if (
        mismatch.length > 0 ||
        v.issues.includes('product_country_schedule_mismatch') ||
        blockedMismatch ||
        emptyCkWithBody
      ) {
        targets.push(r)
      }
    }

    console.log(`[heal-country] candidates=${targets.length} apply=${apply}`)
    for (const t of targets) {
      console.log(
        JSON.stringify({
          id: t.id,
          src: t.originSource,
          ck: t.countryKey,
          st: t.registrationStatus,
          title: String(t.title ?? '').slice(0, 70),
        }),
      )
      if (!apply) continue
      const result = await healPendingRegisterPrePhoto({
        productId: t.id,
        limit: 1,
        dryRun: false,
        probeImageUrls: false,
      })
      const after = await prisma.product.findUnique({
        where: { id: t.id },
        select: {
          countryKey: true,
          registrationStatus: true,
          rejectReason: true,
          destination: true,
        },
      })
      const v2 = after
        ? verifyRegisterPrePhotoForStoredProduct({
            ...t,
            countryKey: after.countryKey,
            destination: after.destination,
            registrationStatus: after.registrationStatus,
          })
        : null
      console.log(
        JSON.stringify({
          id: t.id,
          heal: result,
          afterCk: after?.countryKey,
          afterSt: after?.registrationStatus,
          afterReject: after?.rejectReason,
          verifyOk: v2?.ok,
          issues: v2?.issues?.filter((i) => i.includes('country')).slice(0, 5),
        }),
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
