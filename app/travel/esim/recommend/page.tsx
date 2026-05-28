import { Suspense } from 'react'
import Header from '@/app/components/Header'
import { getCachedBongsimCountriesList } from '@/lib/bongsim/countries-list-cached'
import { getCachedBongsimCountryHeroesMap } from '@/lib/bongsim/country-heroes-cached'
import RecommendPageClient from './RecommendPageClient'

export const revalidate = 300

export default async function RecommendPage() {
  const [initialCountries, initialHeroMap] = await Promise.all([
    getCachedBongsimCountriesList().catch(() => []),
    getCachedBongsimCountryHeroesMap().catch(() => ({})),
  ])

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-slate-600">
            불러오는 중…
          </main>
        </div>
      }
    >
      <RecommendPageClient
        initialCountries={initialCountries}
        initialHeroMap={initialHeroMap}
      />
    </Suspense>
  )
}
