'use client'

import Link from 'next/link'
import Header from '@/app/components/Header'
import BusInquiryForm from '@/components/inquiry/BusInquiryForm'
import InstitutionInquiryForm from '@/components/inquiry/InstitutionInquiryForm'
import TrainingInquiryForm from '@/components/inquiry/TrainingInquiryForm'
import TravelInquiryForm from '@/components/inquiry/TravelInquiryForm'
import { inquiryKindLabel, inquiryShellCopy } from '@/lib/inquiry-form-i18n'
import { buildInquiryHref, INQUIRY_KINDS, type InquiryKind, type InquiryPageQuery } from '@/lib/inquiry-page'

type Props = {
  kind: InquiryKind
  initialQuery: InquiryPageQuery
}

export default function InquiryPageClient({ kind, initialQuery }: Props) {
  const lang = initialQuery.uiLang ?? 'ko'
  const copy = inquiryShellCopy(lang)

  return (
    <div className="min-h-screen bg-base-muted">
      <Header />
      <main lang={lang === 'en' ? 'en' : undefined}>
        <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
          <p className="text-xs text-slate-500">
            <Link href="/" className="font-medium text-slate-600 underline-offset-2 hover:underline">
              {copy.breadcrumbHome}
            </Link>
            <span aria-hidden className="mx-1.5 text-slate-300">
              /
            </span>
            {copy.breadcrumbInquiry}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.typeHelp}</p>
          <nav aria-label={copy.breadcrumbInquiry} className="mt-4 flex flex-wrap gap-2">
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
                  {inquiryKindLabel(k, lang)}
                </Link>
              )
            })}
          </nav>
          <p className="mt-2 text-xs text-slate-600">{copy.currentType(inquiryKindLabel(kind, lang))}</p>
        </div>

        {kind === 'travel' && <TravelInquiryForm initialQuery={initialQuery} />}
        {kind === 'institution' && <InstitutionInquiryForm initialQuery={initialQuery} />}
        {kind === 'training' && <TrainingInquiryForm initialQuery={initialQuery} />}
        {kind === 'bus' && <BusInquiryForm initialQuery={initialQuery} />}
      </main>
    </div>
  )
}
