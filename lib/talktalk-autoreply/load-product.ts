/**
 * 톡톡 자동답변용 상품 읽기. 등록·공개 상품의 제목·대표사진·소개 요약만(가격 미포함).
 */
import { prisma } from '@/lib/prisma'
import { publicProductPath } from '@/lib/product-public-path'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import type { AutoReplyProduct } from '@/lib/talktalk-autoreply/reply'

export async function loadAutoReplyProduct(ref: string | null): Promise<AutoReplyProduct | null> {
  const key = String(ref ?? '').trim()
  if (!key) return null
  const product = await prisma.product.findFirst({
    where: {
      AND: [
        { registrationStatus: 'registered' },
        { OR: [{ slug: key }, { id: key }, { originCode: key }, { supplierProductCode: key }] },
        publicProductWhereClause(),
      ],
    },
    select: { id: true, slug: true, title: true, bgImageUrl: true, summary: true },
  })
  if (!product) return null
  return {
    title: product.title,
    href: publicProductPath({ id: product.id, slug: product.slug }),
    imageUrl: product.bgImageUrl && /^https:\/\//i.test(product.bgImageUrl) ? product.bgImageUrl : null,
    summary: product.summary,
  }
}
