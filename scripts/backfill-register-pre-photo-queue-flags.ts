/**
 * pending/pre_photo_blocked Travel Product에 registerPrePhotoQueueReady·registerPhotosReady 백필.
 *   npx tsx scripts/backfill-register-pre-photo-queue-flags.ts
 *   npx tsx scripts/backfill-register-pre-photo-queue-flags.ts --dry-run
 */
import Module from 'node:module'
import { register } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config as loadDotenv } from 'dotenv'
import { Client } from 'pg'
import { computeRegisterPrePhotoQueueFlags } from '../lib/register-pre-photo-queue-flags'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '../lib/register-pre-photo-pending-queue'

register(pathToFileURL(join(process.cwd(), 'scripts/stub-server-only.mjs')).href)
const load = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load
;(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (
  request: unknown,
  parent: unknown,
  isMain: unknown,
) {
  if (request === 'server-only') return {}
  return load.call(this, request, parent, isMain)
}
if (existsSync('.env.local')) loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!raw) throw new Error('no db')
  const url = raw.replace(/[?&]sslmode=[^&]*/gi, '').replace(/\?&/, '?').replace(/[?&]$/, '')
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, keepAlive: true })
  await c.connect()

  // Ensure columns exist (migration may not have run yet on some envs)
  await c.query(`
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registerPrePhotoQueueReady" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registerPhotosReady" BOOLEAN NOT NULL DEFAULT false;
  `)

  const { rows } = await c.query<{
    id: string
    listing_kind: string | null
    product_type: string | null
    sports_theme_tag: string[] | null
    schedule: string | null
    destination: string | null
    title: string | null
    country_key: string | null
    bg_image_url: string | null
    registration_status: string | null
    queue_ready: boolean
    photos_ready: boolean
  }>(
    `SELECT id::text AS id, "listingKind" AS listing_kind, "productType" AS product_type,
            "sportsThemeTag" AS sports_theme_tag, schedule, destination, title, "countryKey" AS country_key,
            "bgImageUrl" AS bg_image_url, "registrationStatus" AS registration_status,
            "registerPrePhotoQueueReady" AS queue_ready, "registerPhotosReady" AS photos_ready
       FROM "Product"
      WHERE COALESCE("registrationStatus",'pending') IN ('pending','', $1)
         OR "registrationStatus" IS NULL`,
    [REGISTER_PRE_PHOTO_BLOCKED_STATUS],
  )

  let changed = 0
  let queueTrue = 0
  for (const row of rows) {
    const flags = computeRegisterPrePhotoQueueFlags({
      listingKind: row.listing_kind,
      productType: row.product_type,
      sportsThemeTag: row.sports_theme_tag,
      schedule: row.schedule,
      destination: row.destination,
      title: row.title,
      countryKey: row.country_key,
      bgImageUrl: row.bg_image_url,
      registrationStatus: row.registration_status,
    })
    if (flags.registerPrePhotoQueueReady) queueTrue += 1
    if (
      Boolean(row.queue_ready) === flags.registerPrePhotoQueueReady &&
      Boolean(row.photos_ready) === flags.registerPhotosReady
    ) {
      continue
    }
    changed += 1
    if (!dryRun) {
      await c.query(
        `UPDATE "Product"
            SET "registerPrePhotoQueueReady" = $2,
                "registerPhotosReady" = $3,
                "updatedAt" = now()
          WHERE id = $1`,
        [row.id, flags.registerPrePhotoQueueReady, flags.registerPhotosReady],
      )
    }
  }

  console.log(
    JSON.stringify({
      dryRun,
      scanned: rows.length,
      changed,
      queueReadyTrue: queueTrue,
    }),
  )
  await c.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
