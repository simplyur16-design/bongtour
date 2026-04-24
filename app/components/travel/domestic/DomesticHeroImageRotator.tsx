'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

type BrowseItem = {
  id: string
  title: string
  coverImageUrl: string | null
  bgImageUrl: string | null
  originSource?: string | null
  primaryDestination?: string | null
  duration?: string | null
  bgImageSource?: string | null
  bgImageIsGenerated?: boolean | null
}

const HERO_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22480%22 viewBox=%220 0 1280 480%22%3E%3Crect width=%221280%22 height=%22480%22 fill=%22%23475569%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%2294a3b8%22 font-size=%2230%22%3EDomestic%20Hero%3C/text%3E%3C/svg%3E'

const HERO_MIN_H = 'min-h-[min(38vh,360px)]'

function HeroCopyOverlay({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead: string
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* 왼쪽(카피 영역) 어둡게 → 오른쪽으로 갈수록 투명·밝게 */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 via-[48%] to-transparent to-[88%]"
        aria-hidden
      />
      <div className="relative flex h-full min-h-0 max-w-[min(100%,26rem)] flex-col justify-center px-5 py-8 sm:max-w-[28rem] sm:px-8 sm:py-10 md:max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200/95 sm:text-xs">
          {eyebrow}
        </p>
        <h1 className="bt-wrap mt-2 text-2xl font-black leading-[1.15] tracking-tight text-white drop-shadow-md sm:mt-2.5 sm:text-3xl md:text-4xl">
          {title}
        </h1>
        <p className="bt-wrap mt-2.5 max-w-2xl text-sm leading-relaxed text-white/90 sm:mt-3 sm:text-base">
          {lead}
        </p>
      </div>
    </div>
  )
}

export type DomesticHeroImageRotatorProps = {
  eyebrow: string
  title: string
  lead: string
}

export default function DomesticHeroImageRotator({ eyebrow, title, lead }: DomesticHeroImageRotatorProps) {
  const [items, setItems] = useState<BrowseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/products/browse?scope=domestic&limit=10&sort=popular', {
          cache: 'no-store',
        })
        const data = (await res.json()) as { ok?: boolean; items?: BrowseItem[] }
        if (cancelled || !data?.ok || !Array.isArray(data.items)) {
          setItems([])
          return
        }
        const withCover = data.items.filter((it) => {
          const u = (it.coverImageUrl ?? it.bgImageUrl ?? '').trim()
          return u.length > 0
        })
        setItems(withCover)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const heroItems = useMemo(() => items.slice(0, 10), [items])
  const n = heroItems.length
  const current = n > 0 ? heroItems[idx % n]! : null
  const imgSrc = useMemo(() => {
    if (!current) return null
    const raw = (current.coverImageUrl ?? current.bgImageUrl ?? '').trim()
    return raw || null
  }, [current])

  useEffect(() => {
    if (n <= 1 || reduceMotion) return
    const t = setInterval(() => {
      setIdx((v) => (v + 1) % n)
    }, 5500)
    return () => clearInterval(t)
  }, [n, reduceMotion])

  if (loading) {
    return (
      <div className={`relative mt-8 overflow-hidden rounded-2xl border border-bt-border bg-slate-800 shadow-sm ${HERO_MIN_H}`}>
        <div className={`absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700 to-slate-900`} aria-hidden />
        <HeroCopyOverlay eyebrow={eyebrow} title={title} lead={lead} />
      </div>
    )
  }

  if (!current || !imgSrc) {
    return (
      <div className={`relative mt-8 overflow-hidden rounded-2xl border border-bt-border bg-slate-800 shadow-sm ${HERO_MIN_H}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" aria-hidden />
        <HeroCopyOverlay eyebrow={eyebrow} title={title} lead={lead} />
      </div>
    )
  }

  const displaySrc = broken[current.id] ? HERO_FALLBACK : imgSrc

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-bt-border bg-bt-surface shadow-sm">
      <div className={`relative ${HERO_MIN_H} w-full`}>
        <Link
          href={`/products/${current.id}`}
          className="absolute inset-0 z-0 block"
          aria-label={`${current.title} 상세 보기`}
        >
          <Image
            src={displaySrc}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, min(1152px, 100vw)"
            priority
            decoding="async"
            unoptimized={displaySrc.startsWith('data:')}
            onError={() => setBroken((prev) => ({ ...prev, [current.id]: true }))}
          />
        </Link>
      </div>
      <HeroCopyOverlay eyebrow={eyebrow} title={title} lead={lead} />
      {n > 1 ? (
        <div className="pointer-events-none absolute bottom-3 left-4 z-30 flex items-center gap-1.5 sm:bottom-4">
          {heroItems.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`pointer-events-auto h-1.5 rounded-full transition-all ${
                i === idx % n ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
              }`}
              aria-label={`국내 추천 이미지 ${i + 1}${i === idx % n ? ' (현재)' : ''}`}
              aria-current={i === idx % n ? 'true' : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
