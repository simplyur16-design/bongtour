'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useMemo, useState } from 'react'

export type HomeMobileHubSeasonBodyProps = {
  title: string
  excerpt: string
  bodyFull: string
  imageUrl: string | null
  ctaHref: string
  ctaLabel: string
}

function SeasonCtaLink({ href, label }: { href: string; label: string }) {
  const cls =
    'mt-4 inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800'
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={cls} rel="noopener noreferrer">
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  )
}

export default function HomeMobileHubSeasonBody({
  title,
  excerpt,
  bodyFull,
  imageUrl,
  ctaHref,
  ctaLabel,
}: HomeMobileHubSeasonBodyProps) {
  const [expanded, setExpanded] = useState(false)
  const img = imageUrl
  const isRemoteImg = Boolean(img && /^https?:\/\//i.test(img))
  const imageUnoptimized = isRemoteImg || Boolean(img?.startsWith('/'))

  const needsMore = useMemo(() => {
    const full = bodyFull.replace(/\s+/g, ' ').trim()
    if (!full) return false
    if (excerpt.endsWith('…')) return true
    return full.length > excerpt.replace(/…$/, '').trim().length + 2
  }, [bodyFull, excerpt])

  return (
    <section aria-label="시즌 추천" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">시즌 추천</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80">
        <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-teal-100/90 via-slate-100 to-slate-200/90">
          {img ? (
            isRemoteImg ? (
              // 빌드 시점 remotePatterns 누락해도 공개 URL이 뜨도록 원격은 <img> 고정
              <img
                src={img}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <Image
                src={img}
                alt={title}
                fill
                className="object-cover"
                sizes="100vw"
                unoptimized={imageUnoptimized}
                priority={false}
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-600/25 via-slate-200/60 to-slate-300/50">
              <span className="text-sm font-semibold text-slate-700/90">Bong투어 시즌 픽</span>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 bg-white px-4 py-4">
          <h3 className="text-base font-bold leading-snug text-bt-title">{title}</h3>
          {expanded ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{bodyFull}</p>
          ) : (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{excerpt}</p>
          )}
          {needsMore ? (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? '접기' : '더보기'}
            </button>
          ) : null}
          <SeasonCtaLink href={ctaHref} label={ctaLabel} />
        </div>
      </div>
    </section>
  )
}
