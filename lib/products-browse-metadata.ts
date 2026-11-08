import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/site-metadata'

/** 목록 탭 제목은 absolute. layout `%s | 사이트명`과 OG 제목이 겹치지 않게 한다. */
export function buildProductsBrowseMetadata(siteName: string): Metadata {
  const title = `여행 상품 목록 | ${siteName}`
  const description = '등록된 여행 상품을 조건에 맞게 찾아보세요. 상세에서 일정·안내를 확인할 수 있습니다.'
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/products' },
    openGraph: {
      title,
      description,
      url: '/products',
      type: 'website',
      images: [{ url: DEFAULT_OG_IMAGE_PATH, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
  }
}
