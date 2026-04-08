import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '여행 상품 목록',
  description: '등록된 여행 상품을 조건에 맞게 찾아보세요. 상세에서 일정·안내를 확인할 수 있습니다.',
  alternates: { canonical: '/products' },
  openGraph: {
    title: `여행 상품 목록 | ${SITE_NAME}`,
    description: '등록된 여행 상품을 조건에 맞게 찾아보세요.',
    url: '/products',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function ProductsBrowsePage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">불러오는 중…</p>}>
          <ProductsBrowseClient />
        </Suspense>
      </main>
    </div>
  )
}
