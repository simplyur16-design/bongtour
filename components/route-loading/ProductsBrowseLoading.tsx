import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

export default function ProductsBrowseLoading() {
  return (
    <RouteLoadingShell>
      <Header />
      <PulseBlock className="h-12 w-full border-b border-bt-border-soft/50" />
      <PulseBlock className="mx-auto h-48 w-full max-w-6xl sm:h-56" />
      <div className={`${SITE_CONTENT_CLASS} py-6`}>
        <div className="mb-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <PulseLine key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="hidden w-64 shrink-0 lg:block space-y-3">
            <PulseBlock className="h-10 w-full" />
            <PulseBlock className="h-32 w-full" />
            <PulseBlock className="h-24 w-full" />
          </aside>
          <div className="min-w-0 flex-1 space-y-4">
            <PulseLine className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <PulseBlock key={i} className="h-64 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </RouteLoadingShell>
  )
}
