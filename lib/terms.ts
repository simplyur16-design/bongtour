import { prisma } from './prisma'
import type { Brand } from '@prisma/client'

export type BrandTerms = {
  defaultTerms: string | null
  cancelFeeTerms: string | null
}

/**
 * 브랜드별 약관 조회. 상세페이지 하단에 해당 브랜드 약관 자동 렌더링용.
 */
export async function getTermsByBrandKey(
  brandKey: string | null | undefined
): Promise<BrandTerms> {
  if (!brandKey) return { defaultTerms: null, cancelFeeTerms: null }
  const brand = await prisma.brand.findUnique({
    where: { brandKey },
    select: { defaultTerms: true, cancelFeeTerms: true },
  })
  return {
    defaultTerms: brand?.defaultTerms ?? null,
    cancelFeeTerms: brand?.cancelFeeTerms ?? null,
  }
}

/**
 * 브랜드 정보 조회 (로고·면피·공식 URL·상품 URL 템플릿). 상품 페이지 브랜드 인장·카톡 본사 링크용.
 */
export async function getBrandByKey(
  brandKey: string | null | undefined
): Promise<Brand | null> {
  if (!brandKey) return null
  return prisma.brand.findUnique({ where: { brandKey } })
}

/** 본사 상품 상세 URL 생성. productUrlTemplate에 {code}, {group} 치환 */
export function buildProductUrl(
  productUrlTemplate: string | null | undefined,
  productCode: string,
  groupNumber: string
): string | null {
  if (!productUrlTemplate?.trim()) return null
  return productUrlTemplate
    .replace(/\{code\}/gi, encodeURIComponent(productCode))
    .replace(/\{group\}/gi, encodeURIComponent(groupNumber))
}
