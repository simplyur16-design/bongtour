/**
 * 문의에 적힌 상품코드로 등록 상품의 1인실 저장값만 읽는다.
 */
import { prisma } from '@/lib/prisma'
import { parseProductRawMetaPublic } from '@/lib/public-product-extras'
import type { StoredSingleRoomAmount } from '@/lib/talktalk-draft/single-room-amount'

export async function loadStoredSingleRoomByProductCode(code: string): Promise<StoredSingleRoomAmount | null> {
  const key = code.trim()
  if (!key) return null
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ originCode: key }, { slug: key }, { id: key }, { supplierProductCode: key }],
    },
    select: { rawMeta: true },
  })
  if (!product) return null
  const signals = parseProductRawMetaPublic(product.rawMeta)?.structuredSignals
  return {
    raw: signals?.singleRoomSurchargeRaw ?? null,
    displayText: signals?.singleRoomSurchargeDisplayText ?? null,
    amount: signals?.singleRoomSurchargeAmount ?? null,
    currency: signals?.singleRoomSurchargeCurrency ?? null,
  }
}
