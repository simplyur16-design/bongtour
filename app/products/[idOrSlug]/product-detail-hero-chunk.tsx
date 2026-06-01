import { headers } from 'next/headers'
import { connection } from 'next/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { loadProductDetailHeroCached } from '@/lib/product-detail-page-cache'
import { resolveProductPageAccess } from '@/lib/resolve-product-page-access'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'
import { formatKRW } from '@/lib/price-utils'
import Header from '@/app/components/Header'
import SafeImage from '@/app/components/SafeImage'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { ProductDetailHeroReadySignal } from '@/components/products/product-detail-transition-context'

/** Suspense 1단 — 서버 히어로(제목·이미지·가격) 먼저 스트리밍 */
export async function ProductDetailHeroChunk({ idOrSlug }: { idOrSlug: string }) {
  const { resolved, allowAdminDraft } = await resolveProductPageAccess(idOrSlug)
  if (allowAdminDraft) await connection()

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/products/${resolved.slug}`)
  }
  if (resolved.kind === 'not_found') {
    notFound()
  }

  const hero = await loadProductDetailHeroCached(resolved.productId, allowAdminDraft)
  if (!hero) {
    notFound()
  }

  const isMobile = isMobileUserAgent((await headers()).get('user-agent'))
  const imageUrl = hero.bgImageUrl?.trim() ?? ''
  const optimizable = Boolean(imageUrl) && isSrcOptimizableByNextImage(imageUrl)
  const dest = (hero.primaryDestination ?? hero.destination ?? '').trim()
  const priceLabel = hero.priceFrom != null && hero.priceFrom > 0 ? formatKRW(hero.priceFrom) : null

  const body = (
    <div className={isMobile ? 'px-4 py-4 space-y-4' : `${SITE_CONTENT_CLASS} py-6 space-y-4`}>
      <p className="text-[11px] font-medium text-slate-500">
        {formatOriginSourceForDisplay(hero.originSource ?? '')}
      </p>
      <h1 className={isMobile ? 'text-xl font-bold text-slate-900' : 'text-2xl font-bold text-slate-900'}>
        {hero.title ?? ''}
      </h1>
      {dest ? <p className="text-sm text-slate-600">{dest}</p> : null}
      {hero.publicImageHeroSeoLine?.trim() ? (
        <p className="text-xs text-slate-500">{hero.publicImageHeroSeoLine.trim()}</p>
      ) : null}
      <div
        className={
          isMobile
            ? 'relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100'
            : 'relative aspect-[16/9] w-full max-h-[420px] overflow-hidden rounded-xl bg-slate-100'
        }
      >
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes={isMobile ? '100vw' : '(max-width: 1024px) 80vw, 960px'}
            priority
            quality={60}
            {...(optimizable ? {} : { unoptimized: true })}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        {priceLabel ? <span className="text-lg font-bold text-slate-900">{priceLabel}</span> : null}
        {hero.duration?.trim() ? <span className="text-sm text-slate-500">{hero.duration.trim()}</span> : null}
      </div>
    </div>
  )

  return (
    <>
      <ProductDetailHeroReadySignal />
      {isMobile ? (
        <>
          <Header />
          {body}
        </>
      ) : (
        <>
          <Header />
          {body}
        </>
      )}
    </>
  )
}
