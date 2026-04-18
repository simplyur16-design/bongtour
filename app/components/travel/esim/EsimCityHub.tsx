'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useMemo } from 'react'
import type { EsimCityEntry } from '@/lib/travel-esim-city-config'
import { ESIM_CITY_ENTRIES } from '@/lib/travel-esim-city-config'
import { overseasSubNavTabActive, overseasSubNavTabIdle } from '@/components/top-nav/overseas-sub-nav-styles'

type Props = {
  activeSlug: string
  entry: EsimCityEntry
}

export default function EsimCityHub({ activeSlug, entry }: Props) {
  const scriptSrcs = useMemo(() => [...(entry.esimScriptSrcs ?? [])], [entry])

  return (
    <div className="space-y-8">
      <nav aria-label="도시 선택" className="flex flex-wrap gap-2">
        {ESIM_CITY_ENTRIES.map((c) => {
          const active = c.slug === activeSlug
          const tabClass = active ? overseasSubNavTabActive : overseasSubNavTabIdle
          return (
            <Link
              key={c.slug}
              href={`/travel/esim?city=${encodeURIComponent(c.slug)}`}
              className={`${tabClass} !w-auto min-w-0 max-w-none shrink-0 px-3 py-2 text-[13px] sm:text-sm`}
              scroll={false}
              prefetch
            >
              {c.label}
            </Link>
          )
        })}
      </nav>

      <section aria-labelledby="esim-widget-heading" className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
        <h2 id="esim-widget-heading" className="text-lg font-semibold text-slate-900">
          {entry.label} — eSIM
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          업체에서 받은 HTML·iframe을 설정에 붙여넣으면 아래에 표시됩니다.
        </p>
        {scriptSrcs.map((src) => (
          <Script key={src} src={src} strategy="lazyOnload" />
        ))}
        <div
          className="esim-embed-root mt-4 min-h-[8rem] rounded-lg border border-dashed border-slate-200 bg-white p-4 text-left [&_iframe]:max-w-full"
          dangerouslySetInnerHTML={{ __html: entry.esimEmbedHtml }}
        />
      </section>
    </div>
  )
}
