import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/build-time-db', () => ({
  shouldSkipDbAtBuild: () => false,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyCurationContent: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getPublishedOverseasMonthlyCurationsForMonth } from '@/lib/home-season-pick'

// REGRESSION-FREEZE[season-curation-keep-orphan-product-cards]: keep scrubbed cards — manifest

describe('getPublishedOverseasMonthlyCurationsForMonth', () => {
  beforeEach(() => {
    vi.mocked(prisma.monthlyCurationContent.findMany).mockReset()
    vi.mocked(prisma.product.findMany).mockReset()
  })

  it('keeps published cards whose linked product is auto_unpublished (scrubs product CTA)', async () => {
    vi.mocked(prisma.monthlyCurationContent.findMany).mockResolvedValue([
      {
        id: 'c1',
        monthKey: '2026-09',
        title: '죽은 상품 연결 카드',
        subtitle: '가을 단풍이 물드는 캐나다의 길을 걷습니다.',
        bodyKr: '본문입니다. 충분히 긴 본문으로 요약을 만듭니다.',
        ctaLabel: '보기',
        linkedProductId: 'dead-product',
        linkedHref: '/products/dead-product',
        imageUrl: 'https://example.com/a.jpg',
        countryCode: 'ca',
        showEventTagsOnPublic: false,
        curationEvents: [],
      },
      {
        id: 'c2',
        monthKey: '2026-09',
        title: '정상 상품 카드',
        subtitle: '남반구의 봄이 건네는 첫인사를 듣습니다.',
        bodyKr: '본문입니다. 충분히 긴 본문으로 요약을 만듭니다.',
        ctaLabel: '보기',
        linkedProductId: 'ok-product',
        linkedHref: '/products/ok-product',
        imageUrl: 'https://example.com/b.jpg',
        countryCode: 'au',
        showEventTagsOnPublic: false,
        curationEvents: [],
      },
    ] as never)

    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: 'ok-product' },
    ] as never)

    const out = await getPublishedOverseasMonthlyCurationsForMonth('2026-09')
    expect(out).toHaveLength(2)
    const dead = out.find((x) => x.id === 'c1')
    const ok = out.find((x) => x.id === 'c2')
    expect(dead?.ctaHref).toBe('/travel/overseas')
    expect(ok?.ctaHref).toBe('/products/ok-product')
  })
})
