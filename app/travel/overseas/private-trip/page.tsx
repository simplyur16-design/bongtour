import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import PrivateTripHero from '@/app/travel/overseas/private-trip/_components/PrivateTripHero'
import PrivateTripLanding from '@/app/travel/overseas/private-trip/_components/PrivateTripLanding'
import { loadGroupMeetingReviewsFromCsv } from '@/lib/group-meeting-reviews-csv'
import {
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
  selectPrivateTripHeroEditorialRow,
} from '@/lib/overseas-editorial-prioritize'
import { SITE_NAME, absoluteUrl } from '@/lib/site-metadata'

const INQUIRY_SOURCE = '/travel/overseas/private-trip'

const defaultMetadata: Metadata = {
  title: '우리여행',
  description:
    '등록된 여행상품을 바탕으로 우리 일행만의 맞춤여행 상담. 가족여행·동호회 여행·소규모 모임. 검증된 여행상품으로 우리견적과 일정 방향을 함께 정리합니다.',
  alternates: { canonical: '/travel/overseas/private-trip' },
  openGraph: {
    title: `우리여행 | ${SITE_NAME}`,
    description:
      '인원과 일정에 맞춘 맞춤여행 상담. 모임 총무 부담을 덜고 동호회·해외탐방 일정도 함께 검토합니다.',
    url: absoluteUrl('/travel/overseas/private-trip'),
    type: 'website',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const editorialAll = await fetchPublishedOverseasEditorials()
    const prioritized = prioritizeEditorialsByRegionAndCountry(editorialAll, null, null)
    const row = selectPrivateTripHeroEditorialRow(prioritized) ?? prioritized[0]
    if (!row) return defaultMetadata
    const titleBase = row.title?.trim() || row.seoTitle?.trim() || '우리여행'
    const desc =
      row.seoDescription?.trim() ||
      defaultMetadata.description ||
      '맞춤여행·우리견적 상담을 안내합니다.'
    return {
      ...defaultMetadata,
      title: titleBase,
      description: desc,
      openGraph: {
        title: `${titleBase} | 우리여행 · ${SITE_NAME}`,
        description: desc,
        url: absoluteUrl('/travel/overseas/private-trip'),
        type: 'website',
      },
    }
  } catch {
    return defaultMetadata
  }
}

export const dynamic = 'force-dynamic'

export default async function PrivateTripPage() {
  const groupMeetingReviews = await loadGroupMeetingReviewsFromCsv()
  const inquiryHref = `/inquiry?type=travel&source=${encodeURIComponent(INQUIRY_SOURCE)}`

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <PrivateTripHero inquiryHref={inquiryHref} />
        <PrivateTripLanding inquiryHref={inquiryHref} groupMeetingReviews={groupMeetingReviews} />
      </main>
    </div>
  )
}
