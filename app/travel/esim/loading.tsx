import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

export default function Loading() {
  return (
    <RouteLoadingShell>
      <Header />
      <div className={`${SITE_CONTENT_CLASS} py-10 text-center space-y-6`}>
        <PulseLine className="mx-auto h-10 w-72 max-w-full" />
        <PulseLine className="mx-auto h-5 w-96 max-w-full" />
        <PulseBlock className="mx-auto h-12 w-56 rounded-full" />
      </div>
    </RouteLoadingShell>
  )
}
