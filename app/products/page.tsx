import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import PublicProductSsrIndex from '@/components/seo/PublicProductSsrIndex'
import { SITE_NAME } from '@/lib/site-metadata'
import { buildProductsBrowseMetadata } from '@/lib/products-browse-metadata'
import { listPublicProductsForSsrIndex } from '@/lib/public-product-ssr-index'
import { SUBPAGE_MAIN_CLASS, SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

export const metadata: Metadata = buildProductsBrowseMetadata(SITE_NAME)

/** 서버 목록(JS 없이 보이는 HTML) — 5분 ISR, 상품 등록·수정·삭제 시 revalidateProductListingCaches 가 /products 무효화 */
export const revalidate = 300

export default async function ProductsBrowsePage() {
  const ssrItems = await listPublicProductsForSsrIndex({ scope: 'all', limit: 48 })
  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={SUBPAGE_MAIN_CLASS}>
        {/* REGRESSION-FREEZE[seo-list-ssr-index]: 클라이언트 목록(useSearchParams) 전 HTML 에 h1+상품 링크 — manifest */}
        <Suspense
          fallback={
            <PublicProductSsrIndex
              heading="여행 상품 목록"
              intro="해외 패키지·자유여행 상품을 조건에 맞게 찾아보세요. 상세에서 일정·출발 정보를 확인할 수 있습니다."
              items={ssrItems}
              label="여행 상품 목록"
            />
          }
        >
          <ProductsBrowseClient />
        </Suspense>
      </main>
    </div>
  )
}
