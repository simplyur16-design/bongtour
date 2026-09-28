/**
 * Product.brandId 연결 SSOT — Brand 행 upsert + originSource→brandKey 매핑.
 * REGRESSION-FREEZE[product-brand-ensure]: Brand 시드·상품 brandId — manifest
 */
import type { PrismaClient } from '@prisma/client'
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  normalizeBrandKeyToCanonicalSupplierKey,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { getBrandLabel, getBrandLogoPath } from '@/lib/brands'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

const DISPLAY: Record<string, string> = {
  hanatour: '하나투어',
  modetour: '모두투어',
  ybtour: '노랑풍선',
  verygoodtour: '참좋은여행',
  kyowontour: '교원이지',
  lottetour: '롯데관광',
  naeiltour: '내일투어',
  windsor: '윈저여행사',
  other: '기타',
}

export function brandKeysToEnsure(): string[] {
  return [...CANONICAL_OVERSEAS_SUPPLIER_KEYS, 'windsor', 'other']
}

export function resolveBrandKeyForOriginSource(
  originSource: string | null | undefined,
): CanonicalOverseasSupplierKey | 'windsor' | 'other' | null {
  const raw = String(originSource ?? '').trim()
  if (!raw) return null
  const fromLegacy = normalizeBrandKeyToCanonicalSupplierKey(raw)
  if (fromLegacy) return fromLegacy
  const norm = normalizeSupplierOrigin(raw)
  if (norm !== 'etc') return norm
  const lower = raw.toLowerCase()
  if (lower === 'windsor' || raw.includes('윈저')) return 'windsor'
  if (lower === 'other' || raw === '기타' || raw === '직접입력' || raw === '대시보드') return 'other'
  return null
}

export async function ensureBrandRow(
  prisma: PrismaClient,
  brandKey: string,
): Promise<{ id: string; brandKey: string; displayName: string }> {
  const key = brandKey.trim().toLowerCase()
  const displayName = DISPLAY[key] || getBrandLabel(key) || key
  const logoPath = getBrandLogoPath(key)
  const sortOrder =
    key === 'hanatour'
      ? 1
      : key === 'modetour'
        ? 2
        : key === 'ybtour'
          ? 3
          : key === 'verygoodtour'
            ? 4
            : key === 'kyowontour'
              ? 5
              : key === 'lottetour'
                ? 6
                : key === 'naeiltour'
                  ? 7
                  : key === 'windsor'
                    ? 8
                    : 99
  const row = await prisma.brand.upsert({
    where: { brandKey: key },
    create: {
      brandKey: key,
      displayName,
      logoPath,
      sortOrder,
    },
    update: { displayName, sortOrder, ...(logoPath ? { logoPath } : {}) },
    select: { id: true, brandKey: true, displayName: true },
  })
  return row
}

/** brandKey가 있으면 Brand 보장 후 id. 없으면 null. */
export async function ensureBrandIdForKey(
  prisma: PrismaClient,
  brandKey: string | null | undefined,
): Promise<string | null> {
  const key = String(brandKey ?? '').trim().toLowerCase()
  if (!key) return null
  const canonical = normalizeBrandKeyToCanonicalSupplierKey(key) ?? key
  const row = await ensureBrandRow(prisma, canonical)
  return row.id
}
