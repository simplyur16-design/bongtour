import type { Metadata } from 'next'
import SupportHub from '@/app/components/support/SupportHub'
import { supportFaqItems } from '@/lib/support-content'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '고객지원',
  description:
    '진행 절차, 답변 채널, 전화 상담, 증빙·영수증 안내, 자주 묻는 질문을 한곳에서 확인하실 수 있습니다.',
  alternates: { canonical: '/support' },
  openGraph: {
    title: `고객지원 | ${SITE_NAME}`,
    description:
      '진행 절차, 답변 채널, 전화 상담, 증빙·영수증 안내, 자주 묻는 질문을 한곳에서 확인하실 수 있습니다.',
    url: '/support',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

export default function SupportPage() {
  const faqJsonLd =
    supportFaqItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: supportFaqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : null

  return (
    <>
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
      <SupportHub />
    </>
  )
}
