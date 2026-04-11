import type { Metadata } from 'next'
import InquiryPageClient from '@/components/inquiry/InquiryPageClient'
import {
  normalizeInquiryKind,
  parseInquirySearchParams,
} from '@/lib/inquiry-page'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '여행·단체 문의',
  description:
    '해외·국내 여행, 우리견적, 연수, 버스 등 문의를 접수합니다. 내용 확인 후 순차적으로 연락드립니다.',
  alternates: { canonical: '/inquiry' },
  openGraph: {
    title: `문의 접수 | ${SITE_NAME}`,
    description: '해외·국내 여행 및 단체 관련 문의를 남겨 주세요.',
    url: '/inquiry',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/inquiry?type=travel|institution|training|bus`
 *
 * 단일 페이지 + 쿼리 분기: 라우트·레이아웃·공통 고지를 한곳에서 유지하고,
 * 마케팅/딥링크는 `type`만 바꿔 재사용하기 쉽습니다.
 *
 * Fallback: 허용되지 않은 `type`은 `travel`로 간주합니다.
 */
export default async function InquiryPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const rawType = typeof sp.type === 'string' ? sp.type : undefined
  const kind = normalizeInquiryKind(rawType)
  const initialQuery = parseInquirySearchParams(sp)

  return <InquiryPageClient kind={kind} initialQuery={initialQuery} />
}
