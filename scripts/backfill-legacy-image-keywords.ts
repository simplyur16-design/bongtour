/**
 * 레거시 Product.schedule 이미지 필드 삼단·보조어 정규화 백필.
 *
 * ItineraryDay 모델에는 imageKeyword 컬럼이 없음 — SSOT는 Product.schedule JSON.
 *
 * 실행:
 *   npx tsx scripts/backfill-legacy-image-keywords.ts           # dry-run
 *   npx tsx scripts/backfill-legacy-image-keywords.ts --apply    # UPDATE (별도 승인)
 */
import './load-env'
import { prisma } from '../lib/prisma'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'
import {
  needsScheduleImageFieldBackfill,
  SCHEDULE_IMAGE_GUARD_FIELD_NAMES,
  type ScheduleImageGuardFieldName,
} from '../lib/image-keyword-verify-guards'
import {
  assertCleanPlaceKeyword,
  normalizeToPlaceName,
} from '../lib/pexels-place-name-keyword'
import type { CanonicalOverseasSupplierKey } from '../lib/overseas-supplier-canonical-keys'

const SUPPLIERS: CanonicalOverseasSupplierKey[] = [
  'hanatour',
  'modetour',
  'ybtour',
  'kyowontour',
  'lottetour',
  'verygoodtour',
]

const isApply = process.argv.includes('--apply')

const FIELDS = [...SCHEDULE_IMAGE_GUARD_FIELD_NAMES] as const

type ScheduleRow = Record<string, unknown> & {
  day?: number
  imageKeyword?: string
  imagePlaceName?: string
  imageRehostSearchLabel?: string
}

type ChangeReason = 'normalize' | 'sync'

type RowChange = {
  productId: string
  originCode: string
  supplier: CanonicalOverseasSupplierKey | 'etc'
  day: number
  field: ScheduleImageGuardFieldName
  before: string
  after: string
  reason: ChangeReason
}

function resolveSupplierKey(
  brandKey: string | null | undefined,
  originSource: string | null | undefined,
): CanonicalOverseasSupplierKey | 'etc' {
  const fromBrand = (brandKey ?? '').trim().toLowerCase()
  if (SUPPLIERS.includes(fromBrand as CanonicalOverseasSupplierKey)) {
    return fromBrand as CanonicalOverseasSupplierKey
  }
  const norm = normalizeSupplierOrigin(originSource)
  return SUPPLIERS.includes(norm as CanonicalOverseasSupplierKey) ? (norm as CanonicalOverseasSupplierKey) : 'etc'
}

function cleanKeyword(raw: string): string {
  return normalizeToPlaceName(raw)
}

function verifyPassesGuard(keyword: string): boolean {
  try {
    assertCleanPlaceKeyword(keyword)
    return true
  } catch {
    return false
  }
}

function parseSchedule(scheduleJson: string | null): ScheduleRow[] {
  if (!scheduleJson?.trim()) return []
  try {
    const parsed = JSON.parse(scheduleJson) as unknown
    return Array.isArray(parsed) ? (parsed as ScheduleRow[]) : []
  } catch {
    return []
  }
}

function processDayRow(
  row: ScheduleRow,
  productId: string,
  originCode: string,
  supplier: CanonicalOverseasSupplierKey | 'etc',
): { row: ScheduleRow; changes: RowChange[]; guardFail: number } {
  const day = Number(row.day)
  if (!Number.isFinite(day) || day < 1) {
    return { row, changes: [], guardFail: 0 }
  }

  const mut: ScheduleRow = { ...row }
  const changes: RowChange[] = []
  let guardFail = 0

  for (const field of FIELDS) {
    const before = String(mut[field] ?? '').trim()
    if (!before || !needsScheduleImageFieldBackfill(before)) continue

    const after = cleanKeyword(before)
    if (after === before) continue

    if (!verifyPassesGuard(after)) {
      const ssotFallback = String(mut.imageKeyword ?? '').trim()
      if (ssotFallback && verifyPassesGuard(ssotFallback) && ssotFallback !== before) {
        mut[field] = ssotFallback
        changes.push({
          productId,
          originCode,
          supplier,
          day,
          field,
          before,
          after: ssotFallback,
          reason: 'sync',
        })
        continue
      }
      guardFail += 1
      console.warn(
        `[guard-fail] product=${productId} day=${day} field=${field} after=${JSON.stringify(after)}`,
      )
      continue
    }

    mut[field] = after
    changes.push({
      productId,
      originCode,
      supplier,
      day,
      field,
      before,
      after,
      reason: 'normalize',
    })
  }

  const ssot = String(mut.imageKeyword ?? '').trim()
  if (ssot) {
    for (const field of ['imagePlaceName', 'imageRehostSearchLabel'] as const) {
      const cur = String(mut[field] ?? '').trim()
      if (cur && cur !== ssot) {
        changes.push({
          productId,
          originCode,
          supplier,
          day,
          field,
          before: cur,
          after: ssot,
          reason: 'sync',
        })
        mut[field] = ssot
      }
    }
  }

  return { row: mut, changes, guardFail }
}

async function main() {
  console.log('=== Legacy schedule image fields Backfill ===')
  console.log('Mode:', isApply ? 'apply' : 'dry-run')
  console.log('Fields:', FIELDS.join(', '))
  console.log('Target: Product.schedule JSON (ItineraryDay has no imageKeyword column)\n')

  const products = await prisma.product.findMany({
    where: {
      schedule: { not: null },
      NOT: { schedule: '' },
    },
    select: {
      id: true,
      originCode: true,
      originSource: true,
      schedule: true,
      brand: { select: { brandKey: true } },
    },
  })

  const allChanges: RowChange[] = []
  const productsToUpdate: Array<{ id: string; schedule: string; changeCount: number }> = []
  let guardFail = 0

  for (const p of products) {
    const rows = parseSchedule(p.schedule)
    const supplier = resolveSupplierKey(p.brand?.brandKey, p.originSource)
    const dayChanges: RowChange[] = []
    let nextRows = rows

    for (let i = 0; i < rows.length; i++) {
      const { row, changes, guardFail: gf } = processDayRow(rows[i]!, p.id, p.originCode, supplier)
      guardFail += gf
      if (changes.length > 0) {
        nextRows = [...nextRows]
        nextRows[i] = row
        dayChanges.push(...changes)
      }
    }

    if (dayChanges.length > 0) {
      allChanges.push(...dayChanges)
      productsToUpdate.push({
        id: p.id,
        schedule: JSON.stringify(nextRows),
        changeCount: dayChanges.length,
      })
    }
  }

  const normalizeCount = allChanges.filter((c) => c.reason === 'normalize').length
  const syncCount = allChanges.filter((c) => c.reason === 'sync').length

  console.log(
    `Found: ${allChanges.length} field change(s) (${normalizeCount} normalize, ${syncCount} sync) across ${productsToUpdate.length} product(s)\n`,
  )

  const sample = allChanges.slice(0, 12)
  if (sample.length > 0) {
    console.log('Sample changes (first 12):')
    for (const c of sample) {
      console.log(`  [${c.productId}] day ${c.day} ${c.field} (${c.supplier}, ${c.reason})`)
      console.log(`    before: ${JSON.stringify(c.before)}`)
      console.log(`    after:  ${JSON.stringify(c.after)}`)
    }
    console.log('')
  }

  const bySupplier = new Map<string, number>()
  for (const s of [...SUPPLIERS, 'etc' as const]) bySupplier.set(s, 0)
  for (const c of allChanges) {
    bySupplier.set(c.supplier, (bySupplier.get(c.supplier) ?? 0) + 1)
  }

  const byField = new Map<string, number>()
  for (const f of FIELDS) byField.set(f, 0)
  for (const c of allChanges) {
    byField.set(c.field, (byField.get(c.field) ?? 0) + 1)
  }

  console.log('By supplier (change count):')
  for (const s of [...SUPPLIERS, 'etc' as const]) {
    console.log(`  ${s.padEnd(14)} ${bySupplier.get(s) ?? 0}`)
  }
  console.log('')
  console.log('By field:')
  for (const f of FIELDS) {
    console.log(`  ${f.padEnd(24)} ${byField.get(f) ?? 0}`)
  }
  console.log('')

  if (guardFail > 0) {
    console.warn(`Guard verification failures (skipped): ${guardFail}`)
  }

  if (!isApply) {
    console.log('Dry-run mode. Run with --apply to execute UPDATE (별도 승인 필요).')
    await prisma.$disconnect()
    return
  }

  console.log('Applying changes...')
  let updatedProducts = 0
  for (const u of productsToUpdate) {
    await prisma.product.update({
      where: { id: u.id },
      data: { schedule: u.schedule },
    })
    updatedProducts += 1
  }
  console.log(`Updated ${updatedProducts} product(s), ${allChanges.length} field change(s).`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
