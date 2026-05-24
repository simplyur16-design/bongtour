import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

export default function BusinessHubLoading() {
  return (
    <RouteLoadingShell>
      <Header />
      <PulseBlock className="h-56 w-full sm:h-72" />
      <div className={`${SITE_CONTENT_CLASS} space-y-8 py-10`}>
        <div className="space-y-3">
          <PulseLine className="h-8 w-64 max-w-full" />
          <PulseLine className="h-5 w-full max-w-2xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <PulseBlock key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
        <PulseBlock className="h-32 w-full rounded-2xl" />
      </div>
    </RouteLoadingShell>
  )
}
