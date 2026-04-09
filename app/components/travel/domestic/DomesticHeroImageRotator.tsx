'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type BrowseItem = {
  id: string
  title: string
  coverImageUrl: string | null
  bgImageUrl: string | null
}

const HERO_FALLBACK =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22480%22 viewBox=%220 0 1280 480%22%3E%3Crect width=%221280%22 height=%22480%22 fill=%22%23e2e8f0%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%2294a3b8%22 font-size=%2230%22%3EDomestic%20Hero%3C/text%3E%3C/svg%3E'

export default function DomesticHeroImageRotator() {
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
        const res = await fetch('/api/products/browse?scope=domestic&limit=60&sort=popular', {
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
      <div
        className="mt-8 h-[min(32vh,280px)] w-full animate-pulse rounded-2xl border border-bt-border bg-slate-200/50"
        aria-hidden
      />
    )
  }

  if (!current || !imgSrc) {
    return null
  }

  const displaySrc = broken[current.id] ? HERO_FALLBACK : imgSrc

  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl border border-bt-border bg-bt-surface shadow-sm">
      <div className="relative h-[min(32vh,280px)] w-full">
        <Link
          href={`/products/${current.id}`}
          className="group relative block h-full w-full"
          aria-label={`${current.title} 상세 보기`}
        >
          <img
            src={displaySrc}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setBroken((prev) => ({ ...prev, [current.id]: true }))}
          />
          {/* 좌측은 부드럽게(베일+블러), 우측으로 갈수록 원본에 가깝게 */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r from-white/50 via-white/12 to-transparent"
            style={{
              maskImage: 'linear-gradient(90deg, black 0%, black 40%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(90deg, black 0%, black 40%, transparent 100%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-white/10 backdrop-blur-[5px]"
            style={{
              maskImage: 'linear-gradient(90deg, black 0%, transparent 85%)',
              WebkitMaskImage: 'linear-gradient(90deg, black 0%, transparent 85%)',
            }}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent p-3 sm:p-4">
            <p className="line-clamp-2 text-right text-sm font-semibold text-white drop-shadow sm:text-base">
              {current.title}
            </p>
          </div>
        </Link>
      </div>
      {n > 1 ? (
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5">
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
