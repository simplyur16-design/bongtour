import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

/** 상품 상세 전환 스켈레톤 — 히어로 + 스티키 견적 카드 레이아웃 근사 */
export default function ProductDetailLoading() {
  return (
    <RouteLoadingShell>
      <div className="hidden md:block">
        <Header />
        <div className={`${SITE_CONTENT_CLASS} py-6`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <PulseLine className="h-4 w-16" />
            <PulseLine className="h-4 w-24" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="space-y-4 min-w-0">
              <PulseLine className="h-8 w-4/5 max-w-xl" />
              <PulseLine className="h-5 w-2/3 max-w-md" />
              <PulseBlock className="aspect-[16/9] w-full max-h-[420px]" />
              <div className="flex gap-2">
                <PulseLine className="h-9 w-24 rounded-full" />
                <PulseLine className="h-9 w-28 rounded-full" />
              </div>
              <PulseBlock className="h-40 w-full" />
              <PulseBlock className="h-56 w-full" />
            </div>
            <aside className="hidden lg:block space-y-3">
              <PulseBlock className="h-[420px] w-full rounded-2xl" />
            </aside>
          </div>
        </div>
      </div>
      <div className="md:hidden">
        <Header />
        <div className="px-4 py-4 space-y-4">
          <PulseLine className="h-7 w-full" />
          <PulseBlock className="aspect-[4/3] w-full" />
          <PulseBlock className="h-48 w-full rounded-2xl" />
          <PulseBlock className="h-32 w-full" />
        </div>
      </div>
    </RouteLoadingShell>
  )
}
