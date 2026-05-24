import Header from '@/app/components/Header'
import { PulseBlock, PulseLine, RouteLoadingShell } from '@/components/route-loading/route-loading-primitives'

export default function MyPageLoading() {
  return (
    <RouteLoadingShell>
      <div className="min-h-screen bg-gradient-to-b from-[#EFEDF8]/60 via-white to-[#F5F2EA]">
        <Header />
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-28 pt-6 md:flex-row md:pb-12 md:pt-8">
          <aside className="hidden shrink-0 space-y-2 md:block md:w-56">
            <PulseBlock className="h-10 w-full rounded-xl" />
            {Array.from({ length: 5 }, (_, i) => (
              <PulseLine key={i} className="h-10 w-full rounded-xl" />
            ))}
          </aside>
          <div className="min-w-0 flex-1 space-y-4">
            <PulseLine className="h-8 w-40" />
            <PulseBlock className="h-36 w-full rounded-2xl" />
            <PulseBlock className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </RouteLoadingShell>
  )
}
