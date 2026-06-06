/**
 * DB에 잘못 저장된 모두투어 상품명(일급호텔·준특급 3박5일 등) 교정.
 *
 * npx tsx scripts/fix-modetour-hotel-grade-product-titles.ts
 * npx tsx scripts/fix-modetour-hotel-grade-product-titles.ts --apply
 */
import '../scripts/load-env-for-scripts'
import { prisma } from '../lib/prisma'
import {
  isModetourHotelGradeDurationOnlyTitleText,
  isModetourUnacceptableRegisterListingTitle,
} from '../lib/modetour-departures'
import { rebuildProductPublicDetailPayload } from '../lib/product-public-detail/persist-payload'

const GARBAGE_ORIGINAL_RE = /^여행은\s*모두투어$/i

function pickReplacementTitle(row: {
  title: string
  originalTitle: string | null
  rawTitle: string | null
}): string | null {
  const candidates = [row.rawTitle, row.originalTitle].filter(
    (v): v is string => Boolean(v && v.trim())
  )
  for (const c of candidates) {
    const t = c.trim()
    if (GARBAGE_ORIGINAL_RE.test(t)) continue
    if (!isModetourUnacceptableRegisterListingTitle(t)) return t
  }
  return null
}

function needsTitleFix(title: string): boolean {
  const t = title.trim()
  if (!t || t === '상품명 없음') return true
  if (GARBAGE_ORIGINAL_RE.test(t)) return true
  if (isModetourHotelGradeDurationOnlyTitleText(t)) return true
  return false
}

function needsOriginalTitleFix(originalTitle: string | null): boolean {
  if (!originalTitle?.trim()) return true
  if (GARBAGE_ORIGINAL_RE.test(originalTitle.trim())) return true
  if (isModetourHotelGradeDurationOnlyTitleText(originalTitle)) return true
  return false
}

function buildUpdate(row: {
  title: string
  originalTitle: string | null
  rawTitle: string | null
}): { title?: string; originalTitle?: string } | null {
  const replacement = pickReplacementTitle(row)
  if (!replacement) return null
  const data: { title?: string; originalTitle?: string } = {}
  if (needsTitleFix(row.title)) data.title = replacement
  if (needsOriginalTitleFix(row.originalTitle)) data.originalTitle = replacement
  if (Object.keys(data).length === 0) return null
  return data
}

async function main() {
  const apply = process.argv.includes('--apply')

  const rows = await prisma.product.findMany({
    where: { originSource: 'modetour' },
    select: {
      id: true,
      slug: true,
      title: true,
      originalTitle: true,
      rawTitle: true,
    },
  })

  const targets = rows
    .map((row) => ({ row, data: buildUpdate(row) }))
    .filter((x): x is { row: (typeof rows)[number]; data: NonNullable<ReturnType<typeof buildUpdate>> } =>
      Boolean(x.data)
    )

  console.log(`[fix-modetour-hotel-grade-titles] candidates=${targets.length} apply=${apply}`)

  let updated = 0
  let skipped = 0

  for (const { row, data } of targets) {
    console.log(`[plan] ${row.slug ?? row.id}`)
    console.log(`  before title: ${row.title}`)
    console.log(`  before originalTitle: ${row.originalTitle ?? 'null'}`)
    if (data.title) console.log(`  after title: ${data.title}`)
    if (data.originalTitle) console.log(`  after originalTitle: ${data.originalTitle}`)

    if (!apply) continue

    await prisma.product.update({
      where: { id: row.id },
      data,
    })

    const rebuilt = await rebuildProductPublicDetailPayload(row.id)
    if (!rebuilt) {
      console.warn(`[warn] payload rebuild skipped/failed for ${row.slug ?? row.id}`)
    }
    updated += 1
  }

  if (apply) {
    console.log(`[fix-modetour-hotel-grade-titles] updated=${updated} skipped=${skipped}`)
  } else if (targets.length > 0) {
    console.log('[fix-modetour-hotel-grade-titles] dry-run only — pass --apply to persist')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
