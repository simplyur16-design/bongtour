'use client'

import Link from 'next/link'
import Header from '@/app/components/Header'
import BusInquiryForm from '@/components/inquiry/BusInquiryForm'
import InstitutionInquiryForm from '@/components/inquiry/InstitutionInquiryForm'
import TrainingInquiryForm from '@/components/inquiry/TrainingInquiryForm'
import TravelInquiryForm from '@/components/inquiry/TravelInquiryForm'
import { buildInquiryHref, INQUIRY_KINDS, type InquiryKind, type InquiryPageQuery } from '@/lib/inquiry-page'

const KIND_LABEL: Record<InquiryKind, string> = {
  travel: '여행 상담',
  institution: '기관 섭외',
  training: '국외 연수',
  bus: '버스 견적',
}

type Props = {
  kind: InquiryKind
  initialQuery: InquiryPageQuery
}

export default function InquiryPageClient({ kind, initialQuery }: Props) {
  return (
    <div className="min-h-screen bg-base-muted">
      <Header />
      <main>
        <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
          <p className="text-xs text-slate-500">
            <Link href="/" className="font-medium text-slate-600 underline-offset-2 hover:underline">
              홈
            </Link>
            <span aria-hidden className="mx-1.5 text-slate-300">
              /
            </span>
            문의 접수
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            문의 유형을 선택해 주세요. 유형에 따라 필요한 정보와 담당 흐름이 달라질 수 있습니다.
          </p>
          <nav aria-label="문의 유형 선택" className="mt-4 flex flex-wrap gap-2">
            {INQUIRY_KINDS.map((k) => {
              const active = k === kind
              return (
                <Link
                  key={k}
                  href={buildInquiryHref(k, initialQuery)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {KIND_LABEL[k]}
                </Link>
              )
            })}
          </nav>
          <p className="mt-2 text-xs text-slate-600">
            현재 선택: <span className="font-semibold text-slate-800">{KIND_LABEL[kind]}</span>
          </p>
        </div>

        {kind === 'travel' && <TravelInquiryForm initialQuery={initialQuery} />}
        {kind === 'institution' && <InstitutionInquiryForm initialQuery={initialQuery} />}
        {kind === 'training' && <TrainingInquiryForm initialQuery={initialQuery} />}
        {kind === 'bus' && <BusInquiryForm initialQuery={initialQuery} />}
      </main>
    </div>
  )
}
