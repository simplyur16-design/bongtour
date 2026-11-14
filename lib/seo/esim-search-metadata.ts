/**
 * eSIM 페이지 검색용 메타(title·description·og·twitter) SSOT.
 * REGRESSION-FREEZE[seo-search-copy-esim-travel]: 검색 노출 표기 = 'eSIM(여행용)'·'고객센터'.
 * 공급사 이름('유심사'·USIMSA)은 검색용 문구에 넣지 않는다(사장님 2026-11-14 19:50 "검색노출쪽이다. 이것도 정정하라") — manifest
 */
import type { Metadata } from 'next'
import { SITE_NAME } from '@/lib/site-metadata'

/** 검색용 eSIM 상품 표기 */
export const ESIM_SEARCH_LABEL = 'eSIM(여행용)'
/** 문의 창구 표기 */
export const ESIM_SEARCH_CS_LABEL = '고객센터'
/** 제목 꼬리 — `… | Bong투어 eSIM(여행용)` */
export const ESIM_SEARCH_TITLE_SUFFIX = `${SITE_NAME} ${ESIM_SEARCH_LABEL}`
export const ESIM_OG_IMAGE_PATH = '/og/esim.webp'

/** 검색용 문구에 들어가면 안 되는 공급사 표기 */
export const ESIM_SEARCH_FORBIDDEN_BRAND_RE = /유심사|usimsa/i

export function esimSearchTitle(head: string): string {
  return `${head} | ${ESIM_SEARCH_TITLE_SUFFIX}`
}

/** 공급사 표기 제거 — 'eSIM(여행용)'·'고객센터' 로 치환 (DB 상품명 등 동적 문자열 방어) */
export function sanitizeEsimSearchCopy(s: string): string {
  return s
    .replace(/유심사\s*(?:e\s*sim|이심)\s*(?:\(\s*여행용\s*\))?/gi, ESIM_SEARCH_LABEL)
    .replace(/usimsa\s*(?:e\s*sim)\s*(?:\(\s*여행용\s*\))?/gi, ESIM_SEARCH_LABEL)
    .replace(/(?:유심사|usimsa)\s*(?:고객\s*센터|CS|cs)/gi, ESIM_SEARCH_CS_LABEL)
    .replace(/\s*(?:유심사|usimsa)\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function buildEsimSearchMetadata(input: {
  /** 완성된 문서 제목(absolute) */
  title: string
  description: string
  path: string
  ogDescription?: string
  robots?: Metadata['robots']
}): Metadata {
  const title = sanitizeEsimSearchCopy(input.title)
  const description = sanitizeEsimSearchCopy(input.description)
  const ogDescription = sanitizeEsimSearchCopy(input.ogDescription ?? input.description)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: input.path },
    ...(input.robots ? { robots: input.robots } : {}),
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title,
      description: ogDescription,
      url: input.path,
      images: [{ url: ESIM_OG_IMAGE_PATH, alt: `${SITE_NAME} ${ESIM_SEARCH_LABEL}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
      images: [ESIM_OG_IMAGE_PATH],
    },
  }
}
