/**
 * 공급사별 최근 등록 상품 schedule 이미지 필드 보조어 오염 검사.
 *
 * 실행:
 *   npx tsx scripts/verify-image-keywords-by-supplier.ts              # strict (legacy 포함 시 FAIL)
 *   npx tsx scripts/verify-image-keywords-by-supplier.ts --legacy-tolerant  # CI: 신규만 FAIL
 *   npx tsx scripts/verify-image-keywords-by-supplier.ts --fields=imageKeyword,imagePlaceName
 *
 * 통과: landmark/night/skyline/street-level/exterior/view/aerial 포함 0건 (모드별 기준 상이)
 */
import './load-env'
import { prisma } from '../lib/prisma'
import {
  BANNED_KEYWORD_PATTERNS,
  findImageKeywordBannedHits,
  parseScheduleImageFields,
  SCHEDULE_IMAGE_GUARD_FIELD_NAMES,
  type ScheduleImageGuardFieldName,
} from '../lib/image-keyword-verify-guards'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'
import type { CanonicalOverseasSupplierKey } from '../lib/overseas-supplier-canonical-keys'

/** 이번 PR(삼단 영구 차단) 머지 시점 — 이후 등록 상품만 strict violation */
const STRICT_AFTER = new Date('2026-05-18T00:00:00Z')

const isLegacyTolerant = process.argv.includes('--legacy-tolerant')

const SUPPLIERS: CanonicalOverseasSupplierKey[] = [
  'hanatour',
  'modetour',
  'ybtour',
  'kyowontour',
  'lottetour',
  'verygoodtour',
]

const SAMPLE_PER_SUPPLIER = 5
/** brand 미연결 상품 포함 — originSource 정규화로 공급사 분류 */
const FETCH_POOL = 250

const DEFAULT_FIELDS: ScheduleImageGuardFieldName[] = [...SCHEDULE_IMAGE_GUARD_FIELD_NAMES]

function parseFieldsArg(): ScheduleImageGuardFieldName[] {
  const arg = process.argv.find((a) => a.startsWith('--fields='))
  if (!arg) return DEFAULT_FIELDS
  const names = arg
    .slice('--fields='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const valid = names.filter((n): n is ScheduleImageGuardFieldName =>
    (SCHEDULE_IMAGE_GUARD_FIELD_NAMES as readonly string[]).includes(n),
  )
  if (valid.length === 0) {
    console.warn('Unknown --fields; using all:', DEFAULT_FIELDS.join(', '))
    return DEFAULT_FIELDS
  }
  return valid
}

const fieldsToCheck = parseFieldsArg()

function resolveSupplierKey(
  brandKey: string | null | undefined,
  originSource: string | null | undefined,
): CanonicalOverseasSupplierKey | null {
  const fromBrand = (brandKey ?? '').trim().toLowerCase()
  if (SUPPLIERS.includes(fromBrand as CanonicalOverseasSupplierKey)) {
    return fromBrand as CanonicalOverseasSupplierKey
  }
  const norm = normalizeSupplierOrigin(originSource)
  return SUPPLIERS.includes(norm as CanonicalOverseasSupplierKey) ? (norm as CanonicalOverseasSupplierKey) : null
}

function isStrictProduct(createdAt: Date): boolean {
  return createdAt.getTime() >= STRICT_AFTER.getTime()
}

function fieldValue(
  row: ReturnType<typeof parseScheduleImageFields>[number],
  field: ScheduleImageGuardFieldName,
): string {
  return row[field]
}

type ViolationKind = 'strict' | 'legacy'

type Violation = {
  kind: ViolationKind
  supplier: string
  productId: string
  originCode: string
  productCreatedAt: string
  day: number
  field: ScheduleImageGuardFieldName
  value: string
  banned: string[]
}

async function main() {
  const strictViolations: Violation[] = []
  const legacyViolations: Violation[] = []
  let totalValues = 0

  console.log('=== verify-image-keywords-by-supplier ===\n')
  console.log('mode:', isLegacyTolerant ? 'legacy-tolerant (CI)' : 'strict (all violations fail)')
  console.log('STRICT_AFTER (UTC):', STRICT_AFTER.toISOString())
  console.log('fields:', fieldsToCheck.join(', '))
  console.log('금지 패턴 수:', BANNED_KEYWORD_PATTERNS.length, '(BANNED_KEYWORD_PATTERNS)')
  console.log(`공급사당 최근 상품 ${SAMPLE_PER_SUPPLIER}건\n`)

  const pool = await prisma.product.findMany({
    where: {
      schedule: { not: null },
      NOT: { schedule: '' },
    },
    orderBy: { createdAt: 'desc' },
    take: FETCH_POOL,
    select: {
      id: true,
      originCode: true,
      originSource: true,
      title: true,
      schedule: true,
      createdAt: true,
      brand: { select: { brandKey: true } },
    },
  })

  const bySupplier = new Map<CanonicalOverseasSupplierKey, typeof pool>()
  for (const key of SUPPLIERS) bySupplier.set(key, [])
  for (const p of pool) {
    const key = resolveSupplierKey(p.brand?.brandKey, p.originSource)
    if (!key) continue
    const list = bySupplier.get(key)!
    if (list.length < SAMPLE_PER_SUPPLIER) list.push(p)
  }

  for (const supplier of SUPPLIERS) {
    const products = bySupplier.get(supplier) ?? []

    console.log(`--- ${supplier} (${products.length} products) ---`)
    if (products.length === 0) {
      console.log('  (최근 상품 없음 — 스킵)\n')
      continue
    }

    for (const p of products) {
      const rows = parseScheduleImageFields(p.schedule)
      const title = (p.title ?? '').slice(0, 50)
      const strictProduct = isStrictProduct(p.createdAt)
      const ageLabel = strictProduct ? 'strict' : 'legacy'
      console.log(`  ${p.id} | ${p.originCode} | ${ageLabel} | ${title}`)
      if (rows.length === 0) {
        console.log('    (일정 이미지 필드 없음)')
        continue
      }
      let productHasValues = false
      for (const row of rows) {
        for (const field of fieldsToCheck) {
          const value = fieldValue(row, field)
          if (!value) continue
          productHasValues = true
          totalValues += 1
          const banned = findImageKeywordBannedHits(value)
          const label = value || '(empty)'
          if (banned.length > 0) {
            const kind: ViolationKind = strictProduct ? 'strict' : 'legacy'
            const tag = kind === 'strict' ? 'STRICT FAIL' : 'LEGACY FAIL'
            console.log(
              `    Day ${row.day} [${field}]: ${tag} ${JSON.stringify(label)} → [${banned.join(', ')}]`,
            )
            const v: Violation = {
              kind,
              supplier,
              productId: p.id,
              originCode: p.originCode,
              productCreatedAt: p.createdAt.toISOString(),
              day: row.day,
              field,
              value,
              banned,
            }
            if (kind === 'strict') strictViolations.push(v)
            else legacyViolations.push(v)
          } else {
            console.log(`    Day ${row.day} [${field}]: OK ${JSON.stringify(label)}`)
          }
        }
      }
      if (!productHasValues) {
        console.log('    (검사 대상 필드 값 없음)')
      }
    }
    console.log('')
  }

  await prisma.$disconnect()

  const countBySupplier = (list: Violation[]) => {
    const m = new Map<string, { strict: number; legacy: number }>()
    for (const s of SUPPLIERS) m.set(s, { strict: 0, legacy: 0 })
    for (const v of list) {
      const cur = m.get(v.supplier) ?? { strict: 0, legacy: 0 }
      if (v.kind === 'strict') cur.strict += 1
      else cur.legacy += 1
      m.set(v.supplier, cur)
    }
    return m
  }

  const strictBySupplier = countBySupplier(strictViolations)
  const legacyBySupplier = countBySupplier(legacyViolations)

  console.log('=== Image Keyword Violations ===')
  console.log(`Strict violations (신규 데이터, createdAt >= ${STRICT_AFTER.toISOString()}): ${strictViolations.length}건`)
  console.log(`Legacy violations (기존 데이터): ${legacyViolations.length}건`)
  console.log('')
  console.log('Violations by supplier:')
  for (const s of SUPPLIERS) {
    const st = strictBySupplier.get(s)?.strict ?? 0
    const lg = legacyBySupplier.get(s)?.legacy ?? 0
    console.log(`  ${s.padEnd(14)} strict=${st}  legacy=${lg}`)
  }
  console.log('')
  console.log('--- summary ---')
  console.log(`scanned field values: ${totalValues}`)
  console.log(`strict violations: ${strictViolations.length}`)
  console.log(`legacy violations: ${legacyViolations.length}`)

  if (totalValues === 0) {
    console.error('\nFAILED: 검사한 필드 값이 없습니다 (DB 비어 있거나 일정 없음).')
    process.exit(2)
  }

  if (isLegacyTolerant) {
    if (strictViolations.length > 0) {
      console.error('\nFAILED: 신규(strict) 이미지 필드에 보조어가 있습니다.')
      process.exit(1)
    }
    if (legacyViolations.length > 0) {
      console.log(`\nPASSED (legacy-tolerant): legacy ${legacyViolations.length}건은 허용, strict 0건`)
    } else {
      console.log('\nPASSED (legacy-tolerant): strict·legacy 위반 0건')
    }
    return
  }

  const totalViolations = strictViolations.length + legacyViolations.length
  if (totalViolations > 0) {
    console.error('\nFAILED: 보조어 포함 schedule 이미지 필드가 있습니다 (strict + legacy).')
    process.exit(1)
  }
  console.log('\nPASSED: 보조어 포함 schedule 이미지 필드 0건')
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
