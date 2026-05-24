import Header from '@/app/components/Header'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

export default function HomePageLoading() {
  return (
    <RouteLoadingShell>
      <Header hideMobileNav />
      <main className="flex-1">
        <section className="bg-gradient-to-b from-white via-bt-bg-lavender-soft to-bt-bg-lavender/80">
          <div className={`${SITE_CONTENT_CLASS} space-y-6 py-8 lg:py-12`}>
            <PulseBlock className="mx-auto h-12 w-full max-w-xl rounded-2xl lg:hidden" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <PulseBlock key={i} className="h-36 w-full rounded-2xl sm:h-40" />
              ))}
            </div>
            <PulseBlock className="hidden h-64 w-full rounded-2xl lg:block" />
            <div className="hidden gap-4 lg:grid lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <PulseBlock key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              <PulseLine className="h-6 w-48" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <PulseBlock key={i} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </RouteLoadingShell>
  )
}
