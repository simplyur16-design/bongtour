import type { Metadata } from 'next'
import Header from '@/app/components/Header'
import HomeMobileHub from '@/app/components/home/HomeMobileHub'
import HomeTrustSection from '@/app/components/home/HomeTrustSection'
import CustomerReviewsSection from '@/app/components/home/CustomerReviewsSection'
import MobileDestinationSearch from '@/app/components/home/MobileDestinationSearch'
import SiteJsonLd from '@/app/components/seo/SiteJsonLd'
import { HOME_PAGE_DESCRIPTION, HOME_PAGE_TITLE } from '@/lib/home-page-metadata'
import { ogImagesForMetadata } from '@/lib/og-images-db'
import { getSeasonalDefaultOgImagePath } from '@/lib/og-image-seasonal'
import { SITE_NAME } from '@/lib/site-metadata'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 모바일 홈 — URL은 middleware rewrite로 `/` 유지. request headers 미사용 ISR. */
export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  let images: Awaited<ReturnType<typeof ogImagesForMetadata>> = [
    { url: getSeasonalDefaultOgImagePath(), width: 1200, height: 630, alt: SITE_NAME },
  ]
  try {
    images = await ogImagesForMetadata('default', SITE_NAME)
  } catch (e) {
    console.error('[home-mobile] generateMetadata og image failed', e)
  }
  return {
    title: { absolute: HOME_PAGE_TITLE },
    description: HOME_PAGE_DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      url: '/',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      images: images.map((i) => i.url),
    },
    robots: { index: false, follow: true },
  }
}

// REGRESSION-FREEZE[home-single-device-ssr]: mobile tree at /m — manifest
export default async function HomeMobile() {
  return (
    <div className="flex min-h-screen flex-col bg-bt-page">
      <SiteJsonLd />
      <Header hideMobileNav />
      <main className="flex-1">
        <section
          className="relative overflow-x-hidden bg-gradient-to-b from-white via-bt-bg-lavender-soft to-bt-bg-lavender/80"
          aria-label="Bong투어 메인 소개 및 서비스 허브"
        >
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_60%_at_15%_-10%,rgba(143,122,200,0.11),transparent_50%)]"
            aria-hidden
          />
          <div className={SITE_CONTENT_CLASS}>
            <MobileDestinationSearch />
          </div>
          <HomeMobileHub />
          <HomeTrustSection />
          <CustomerReviewsSection />
        </section>
      </main>
    </div>
  )
}
