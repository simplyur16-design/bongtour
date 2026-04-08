import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '@/app/components/Header'
import OverseasHero from '@/app/components/travel/overseas/OverseasHero'
import OverseasInteractiveShell from '@/app/components/travel/overseas/OverseasInteractiveShell'
import OverseasManagedContent from '@/app/components/travel/overseas/OverseasManagedContent'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'
import { monthlyCurationRowToMidPayload } from '@/lib/overseas-cms-public'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  editorialRowToBriefingPayload,
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
} from '@/lib/overseas-editorial-prioritize'
import { prisma } from '@/lib/prisma'
import { SITE_NAME } from '@/lib/site-metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '해외여행 상품',
  description:
    '해외 패키지 상품을 지역·조건에 맞게 찾아보세요. 출발 일정과 안내는 상품별로 확인할 수 있으며, 예약·상담은 문의를 통해 안내됩니다.',
  alternates: { canonical: '/travel/overseas' },
  openGraph: {
    title: `해외여행 | ${SITE_NAME}`,
    description:
      '해외 패키지 상품을 지역·조건에 맞게 찾아보세요. 출발 일정과 안내는 상품별로 확인할 수 있습니다.',
    url: '/travel/overseas',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default async function OverseasTravelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const region = typeof sp.region === 'string' ? sp.region : null
  const country = typeof sp.country === 'string' ? sp.country : null

  let overseasEditorialBriefing: OverseasEditorialBriefingPayload | null = null
  let monthlyCurationMid: MonthlyCurationMidPayload | null = null
  try {
    const editorialAll = await fetchPublishedOverseasEditorials()
    const prioritized = prioritizeEditorialsByRegionAndCountry(editorialAll, region, country)
    overseasEditorialBriefing = editorialRowToBriefingPayload(prioritized[0], 220)
  } catch {
    // 목록은 브리핑 없이 표시
  }
  try {
    const monthKey = getSeoulYearMonthNow()
    const hubGlobal = !region && !country
    let monthlyAll = await prisma.monthlyCurationContent.findMany({
      where: {
        pageScope: 'overseas',
        isPublished: true,
        monthKey,
        ...(hubGlobal ? { regionKey: null, countryCode: null } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      take: 12,
    })
    if (monthlyAll.length === 0 && hubGlobal) {
      monthlyAll = await prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: true, regionKey: null, countryCode: null },
        orderBy: [{ monthKey: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 12,
      })
    }
    const prioritizedMonthly = prioritizeEditorialsByRegionAndCountry(monthlyAll, region, country)
    const top = prioritizedMonthly[0]
    if (top) monthlyCurationMid = monthlyCurationRowToMidPayload(top, 200)
  } catch {
    // 월간 중간 블록 없이 표시
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav />
      <main>
        <OverseasHero />

        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">상품을 불러오는 중…</p>}>
          <ProductsBrowseClient
            basePath="/travel/overseas"
            defaultScope="overseas"
            pageTitle="해외여행 상품"
            overseasEditorialBriefing={overseasEditorialBriefing}
            monthlyCurationMid={monthlyCurationMid}
          />
        </Suspense>

        <OverseasInteractiveShell
          postProductSlot={
            <>
              <OverseasManagedContent
                region={region}
                country={country}
                omitEditorialSection
                omitMonthlyCuration={Boolean(monthlyCurationMid)}
              />
            </>
          }
        />
      </main>
    </div>
  )
}
