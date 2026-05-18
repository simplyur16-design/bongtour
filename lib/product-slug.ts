import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

export type ProductSlugCategory = 'pkg' | 'fit' | 'fim'

const SLUG_CATEGORY_VALUES: ProductSlugCategory[] = ['pkg', 'fit', 'fim']

const SUPPLIER_TO_SLUG: Record<string, string> = {
  modetour: 'mt',
  hanatour: 'hn',
  ybtour: 'yb',
  verygoodtour: 'vg',
  lottetour: 'lt',
  kyowontour: 'ky',
}

const SLUG_PATTERN = /^(pkg|fit|fim)-(mt|hn|yb|vg|lt|ky)-(\d{4})$/

export type ProductSlugInput = {
  listingKind?: string | null
  productType?: string | null
  originSource?: string | null
}

type DbClient = Prisma.TransactionClient | typeof prisma

export function inferProductSlugCategory(input: ProductSlugInput): ProductSlugCategory {
  const listingKind = (input.listingKind ?? '').trim()
  const productType = (input.productType ?? '').trim().toLowerCase()
  if (listingKind === 'private_trip' || productType === 'private' || productType === 'semi') {
    return 'fim'
  }
  if (listingKind === 'air_hotel_free' || productType === 'airtel') {
    return 'fit'
  }
  return 'pkg'
}

export function supplierSlugCodeFromOrigin(originSource: string | null | undefined): string {
  const key = normalizeSupplierOrigin(originSource)
  return SUPPLIER_TO_SLUG[key] ?? 'xx'
}

export function buildProductSlugPrefix(category: ProductSlugCategory, supplierCode: string): string {
  return `${category}-${supplierCode}-`
}

function formatSlugSeq(seq: number): string {
  return String(seq).padStart(4, '0')
}

export function parseProductSlugParts(slug: string): {
  category: ProductSlugCategory
  supplier: string
  seq: number
} | null {
  const m = SLUG_PATTERN.exec(slug.trim())
  if (!m) return null
  const category = m[1] as ProductSlugCategory
  if (!SLUG_CATEGORY_VALUES.includes(category)) return null
  return { category, supplier: m[2]!, seq: Number(m[3]) }
}

export async function getMaxSlugSeqForPrefix(
  db: DbClient,
  prefix: string
): Promise<number> {
  const rows = await db.product.findMany({
    where: { slug: { startsWith: prefix } },
    select: { slug: true },
  })
  let max = 0
  for (const row of rows) {
    const slug = row.slug?.trim()
    if (!slug) continue
    const parts = parseProductSlugParts(slug)
    if (parts && slug.startsWith(prefix)) {
      max = Math.max(max, parts.seq)
    }
  }
  return max
}

export async function generateProductSlug(
  product: ProductSlugInput,
  db: DbClient = prisma
): Promise<string> {
  const category = inferProductSlugCategory(product)
  const supplierCode = supplierSlugCodeFromOrigin(product.originSource)
  const prefix = buildProductSlugPrefix(category, supplierCode)
  const maxSeq = await getMaxSlugSeqForPrefix(db, prefix)
  return `${prefix}${formatSlugSeq(maxSeq + 1)}`
}

const SLUG_RETRY_MAX = 3

/**
 * 신규·기존 상품에 slug가 없을 때만 발급. 동일 트랜잭션 내 호출 권장.
 */
export async function ensureProductSlug(
  db: DbClient,
  productId: string,
  product: ProductSlugInput & { slug?: string | null }
): Promise<string | null> {
  if (product.slug?.trim()) return product.slug.trim()

  for (let attempt = 1; attempt <= SLUG_RETRY_MAX; attempt++) {
    const candidate = await generateProductSlug(product, db)
    try {
      await db.product.update({
        where: { id: productId },
        data: { slug: candidate },
      })
      return candidate
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : ''
      if (code === 'P2002' && attempt < SLUG_RETRY_MAX) continue
      throw e
    }
  }
  return null
}
