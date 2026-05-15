'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type CityHit = { cityKey: string; koreanLabel: string; countryLabel: string }
type CountryHit = { countryKey: string; koreanLabel: string }

/**
 * 모바일 메인 — 헤더 가로 메뉴(PR #25) 대신 도시·국가 빠른 이동.
 * 목적지 쿼리 필터는 PR-D4; 현재는 `/travel/overseas` 로만 전달.
 */
export default function MobileDestinationSearch() {
  const [query, setQuery] = useState('')
  const [cities, setCities] = useState<CityHit[]>([])
  const [countries, setCountries] = useState<CountryHit[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCities([])
      setCountries([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/public/destination-search?q=${encodeURIComponent(q.trim())}`)
      const j = (await res.json()) as {
        cities?: CityHit[]
        countries?: CountryHit[]
        error?: string
      }
      if (!res.ok) {
        setCities([])
        setCountries([])
        return
      }
      setCities(Array.isArray(j.cities) ? j.cities : [])
      setCountries(Array.isArray(j.countries) ? j.countries : [])
    } catch {
      setCities([])
      setCountries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) {
      setCities([])
      setCountries([])
      setLoading(false)
      return
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(q)
    }, 240)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el || !open) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const hasResults = cities.length > 0 || countries.length > 0
  const showPanel = open && query.trim().length > 0

  return (
    <section aria-label="해외 목적지 검색" className="relative pb-2 pt-1">
      <div ref={rootRef} className="relative">
        <label htmlFor="mobile-destination-search" className="sr-only">
          도시 또는 국가 이름 검색
        </label>
        <input
          id="mobile-destination-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="도시·국가 검색 (예: 오사카, 다낭, 스위스)"
          className="w-full rounded-xl border border-bt-border-soft bg-white px-3.5 py-2.5 text-sm text-bt-text-navy shadow-sm ring-1 ring-bt-border-soft/30 placeholder:text-bt-text-muted-lavender focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
        />
        {showPanel ? (
          <div
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[min(22rem,55vh)] overflow-y-auto rounded-xl border border-bt-border-soft bg-white py-1 shadow-lg ring-1 ring-black/5"
            role="listbox"
            aria-label="검색 결과"
          >
            {loading && !hasResults ? (
              <p className="px-3 py-2.5 text-center text-xs text-bt-text-muted-lavender">검색 중…</p>
            ) : !hasResults ? (
              <p className="px-3 py-2.5 text-center text-xs text-bt-text-muted-lavender">
                일치하는 도시·국가가 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-bt-border-soft/60">
                {cities.map((c) => (
                  <li key={`c-${c.cityKey}`} role="option">
                    <Link
                      href={`/travel/overseas?destination=${encodeURIComponent(c.cityKey)}`}
                      className="block px-3 py-2.5 text-left text-sm text-bt-text-navy hover:bg-teal-50 active:bg-teal-100"
                      onClick={() => {
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <span className="font-medium">{c.koreanLabel}</span>
                      <span className="mt-0.5 block text-xs text-bt-text-muted-lavender">도시 · {c.countryLabel}</span>
                    </Link>
                  </li>
                ))}
                {countries.map((c) => (
                  <li key={`n-${c.countryKey}`} role="option">
                    <Link
                      href={`/travel/overseas?country=${encodeURIComponent(c.countryKey)}`}
                      className="block px-3 py-2.5 text-left text-sm text-bt-text-navy hover:bg-teal-50 active:bg-teal-100"
                      onClick={() => {
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <span className="font-medium">{c.koreanLabel}</span>
                      <span className="mt-0.5 block text-xs text-bt-text-muted-lavender">국가</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
      <p className="mt-1.5 text-center text-[11px] leading-snug text-bt-text-muted-lavender">
        선택 시 해외 상품 허브로 이동합니다. 상세 필터는 이후 업데이트에서 연결됩니다.
      </p>
    </section>
  )
}
