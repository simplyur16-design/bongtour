/**
 * 홈(`/`) 전용 SEO SSOT — `app/page.tsx` · `app/m/page.tsx` 공통.
 * REGRESSION-FREEZE[home-seo-travel-index]: 모바일 홈 noindex 금지·여행 키워드 메타 — manifest
 */
import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site-metadata'

export const HOME_PAGE_TITLE = '해외여행 패키지·자유여행·eSIM | 봉투어'

export const HOME_PAGE_DESCRIPTION =
  '일본·베트남·유럽 해외여행 패키지와 항공+호텔 자유여행, 해외 eSIM을 한곳에서 비교하세요. 출발 일정 확인 후 상담으로 예약합니다.'

export const HOME_PAGE_KEYWORDS = [
  '해외여행',
  '해외여행 패키지',
  '자유여행',
  '항공호텔',
  '해외 eSIM',
  '일본여행',
  '베트남여행',
  '유럽여행',
  '봉투어',
  'Bong투어',
]

export const HOME_PAGE_H1 = '해외여행 패키지 · 자유여행 · 해외 eSIM'

export const HOME_PAGE_ROBOTS: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: { index: true, follow: true },
}

type HomeOgImage = { url: string; width?: number; height?: number; alt?: string }

export function buildHomePageMetadata(images: readonly HomeOgImage[]): Metadata {
  const imageUrls = images.map((i) => i.url)
  return {
    title: { absolute: HOME_PAGE_TITLE },
    description: HOME_PAGE_DESCRIPTION,
    keywords: HOME_PAGE_KEYWORDS,
    robots: HOME_PAGE_ROBOTS,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      url: '/',
      images: [...images],
    },
    twitter: {
      card: 'summary_large_image',
      title: HOME_PAGE_TITLE,
      description: HOME_PAGE_DESCRIPTION,
      images: imageUrls,
    },
  }
}
