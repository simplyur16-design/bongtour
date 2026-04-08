/**
 * 등록된 모두투어 상품 originCode=JCE604ZEUB 가 있으면 표 슬롯·첫 출발 행을 로그한다.
 *   npx tsx scripts/audit-modetour-jce604-pricing.ts
 */
import { prisma } from '../lib/prisma'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'
import { parseProductRawMetaPublic } from '../lib/public-product-extras'

const ORIGIN_CODE = 'JCE604ZEUB'

async function main() {
  const p = await prisma.product.findFirst({
    where: {
      originCode: ORIGIN_CODE,
      registrationStatus: 'registered',
    },
    select: {
      id: true,
      originSource: true,
      brandId: true,
      rawMeta: true,
    },
  })
  if (!p) {
    console.log('[audit-modetour-jce604] no registered product for', ORIGIN_CODE)
    return
  }
  const brand = p.brandId
    ? await prisma.brand.findUnique({ where: { id: p.brandId }, select: { brandKey: true } })
    : null
  const deps = await prisma.productDeparture.findMany({
    where: { productId: p.id },
    orderBy: { departureDate: 'asc' },
    take: 1,
  })
  const supplier = normalizeSupplierOrigin(p.originSource ?? '')
  const parsedMeta = parseProductRawMetaPublic(p.rawMeta ?? null)
  const pt = parsedMeta?.structuredSignals?.productPriceTable
  const dep = deps[0]
  console.log('[audit-modetour-jce604]', {
    productId: p.id,
    supplierNormalized: supplier,
    brandKey: brand?.brandKey ?? null,
    structuredProductPriceTable: pt
      ? {
          adultPrice: pt.adultPrice ?? null,
          childExtraBedPrice: pt.childExtraBedPrice ?? null,
          childNoBedPrice: pt.childNoBedPrice ?? null,
          infantPrice: pt.infantPrice ?? null,
        }
      : null,
    firstDeparture: dep
      ? {
          date: dep.departureDate.toISOString().slice(0, 10),
          adultPrice: dep.adultPrice,
          childBedPrice: dep.childBedPrice,
          childNoBedPrice: dep.childNoBedPrice,
          infantPrice: dep.infantPrice,
        }
      : null,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
