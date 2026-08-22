import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/app/components/Header'
import InquirySuccessPanel from '@/components/bongtour/InquirySuccessPanel'
import KakaoChannelConsultLink from '@/components/bongtour/KakaoChannelConsultLink'
import { inquiryShellCopy } from '@/lib/inquiry-form-i18n'
import { parseInquiryUiLang } from '@/lib/inquiry-page'
import {
  INQUIRY_THANK_YOU_PATH,
  normalizeInquiryThankYouKind,
} from '@/lib/inquiry-thank-you-path'
import { SITE_NAME } from '@/lib/site-metadata'

export const metadata: Metadata = {
  title: '요청 접수 완료',
  description: '문의·견적 요청이 접수되었습니다. 담당자가 확인 후 안내드립니다.',
  alternates: { canonical: INQUIRY_THANK_YOU_PATH },
  robots: { index: false, follow: false },
  openGraph: {
    title: `요청 접수 완료 | ${SITE_NAME}`,
    description: '문의·견적 요청이 접수되었습니다.',
    url: INQUIRY_THANK_YOU_PATH,
    type: 'website',
  },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(sp: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = sp[key]
  if (typeof v === 'string') return v.trim() || null
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim() || null
  return null
}

/**
 * 문의·견적 접수 성공 후 표시 페이지.
 * Google Ads 리드 전환: https://bongtour.com/inquiry/thank-you
 * REGRESSION-FREEZE[inquiry-thank-you-redirect]: 접수 완료 URL — manifest
 */
export default async function InquiryThankYouPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const kind = normalizeInquiryThankYouKind(firstParam(sp, 'type'))
  const delayed = firstParam(sp, 'delayed') === '1'
  const contact = firstParam(sp, 'contact')
  const fromPrivate = firstParam(sp, 'from') === 'private'
  const lang = parseInquiryUiLang(firstParam(sp, 'lang'))
  const copy = inquiryShellCopy(lang)
  const showOpenKakaoCta = contact === 'kakao' || contact === 'both'
  const kakaoGuide =
    contact === 'kakao'
      ? '문의가 접수되었습니다. 카카오톡 상담을 원하신 경우 아래 버튼을 통해 오픈카카오톡으로도 바로 상담을 이어가실 수 있습니다.'
      : '문의가 접수되었습니다. 선택하신 답변 방법을 기준으로 순차적으로 안내드리겠습니다. 카카오톡 상담을 원하시면 아래 오픈카카오톡을 통해 추가로 상담을 이어가실 수 있습니다.'

  return (
    <div className="min-h-screen bg-base-muted">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <p className="mb-6 text-xs text-slate-500">
          <Link href="/" className="font-medium text-slate-600 underline-offset-2 hover:underline">
            {copy.breadcrumbHome}
          </Link>
          <span aria-hidden className="mx-1.5 text-slate-300">
            /
          </span>
          {copy.thankYouTitle}
        </p>

        <InquirySuccessPanel type={kind ?? undefined} />
        {copy.thankYouLines ? (
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-sm leading-relaxed text-slate-600">
            {copy.thankYouLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {fromPrivate ? (
          <p className="mt-4 text-center text-sm text-slate-700">
            우리견적 문의가 접수되었습니다. 확인 후 순차적으로 안내드리겠습니다.
          </p>
        ) : null}

        {delayed ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-slate-900">문의는 정상 접수되었습니다.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">알림 전송이 지연될 수 있습니다.</p>
          </div>
        ) : null}

        {showOpenKakaoCta ? (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-center">
            <p className="text-xs leading-relaxed text-slate-700">{kakaoGuide}</p>
            <KakaoChannelConsultLink className="mt-3 w-full" />
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">{copy.shortNotice}</p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {copy.home}
          </Link>
          <Link
            href={lang === 'en' ? '/inquiry?type=travel&lang=en' : '/inquiry?type=travel'}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            {copy.anotherInquiry}
          </Link>
        </div>
      </main>
    </div>
  )
}
