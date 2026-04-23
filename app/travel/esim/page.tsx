import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import EsimCityHub from '@/app/components/travel/esim/EsimCityHub'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { getEsimCityEntryBySlug } from '@/lib/travel-esim-city-config'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { SITE_NAME } from '@/lib/site-metadata'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const images = await ogImagesForMetadata('esim', `E-sim | ${SITE_NAME}`)
  return {
    title: 'E-sim',
    description: '도시별 여행 데이터(eSIM) 안내를 확인할 수 있습니다.',
    alternates: { canonical: '/travel/esim' },
    openGraph: {
      title: `E-sim | ${SITE_NAME}`,
      description: '도시별 eSIM 안내',
      url: '/travel/esim',
      type: 'website',
      images,
    },
  }
}

export default async function EsimPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const cityRaw = sp.city
  const citySlug = typeof cityRaw === 'string' ? cityRaw : undefined
  const entry = getEsimCityEntryBySlug(citySlug)

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">E-sim</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          도시를 고르면 해당 지역용 eSIM 안내(위젯)가 표시됩니다.
        </p>
        <div className="mt-8">
          <EsimCityHub activeSlug={entry.slug} entry={entry} />
        </div>
      </main>
    </div>
  )
}
