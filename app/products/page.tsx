import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { SITE_NAME } from '@/lib/site-metadata'
import { buildProductsBrowseMetadata } from '@/lib/products-browse-metadata'
import { SUBPAGE_MAIN_CLASS, SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

export const metadata: Metadata = buildProductsBrowseMetadata(SITE_NAME)

export default function ProductsBrowsePage() {
  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <main className={SUBPAGE_MAIN_CLASS}>
        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">불러오는 중…</p>}>
          <ProductsBrowseClient />
        </Suspense>
      </main>
    </div>
  )
}
