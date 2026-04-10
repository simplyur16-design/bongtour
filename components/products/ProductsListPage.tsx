'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { BrowseSort } from '@/lib/products-browse-filter'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

type BrowseItem = {
  id: string
  title: string
  originSource: string
  primaryDestination: string | null
  duration: string | null
  bgImageUrl: string | null
  coverImageUrl?: string | null
  coverImageDisplayName?: string | null
  effectivePricePerPersonKrw: number | null
  earliestDeparture: string | null
}

type ApiOk = {
  ok: true
  total: number
  page: number
  limit: number
  items: BrowseItem[]
  destinationTerms: string[]
  suggestedBudgetMax: number | null
}

export default function ProductsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<ApiOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const budget = searchParams.get('budgetPerPerson')
  const sort: BrowseSort =
    (searchParams.get('sort') as BrowseSort) || (budget ? 'budget_fit' : 'popular')

  const qs = searchParams.toString()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const p = new URLSearchParams(qs)
        if (budget && !p.get('sort')) p.set('sort', 'budget_fit')
        const res = await fetch(`/api/products/browse?${p.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as ApiOk | { ok: false; error?: string }
        if (cancelled) return
        if (!res.ok || !('ok' in json) || json.ok === false) {
          setError(typeof (json as { error?: string }).error === 'string' ? (json as { error: string }).error : '목록을 불러오지 못했습니다.')
          setData(null)
          return
        }
        setData(json)
      } catch {
        if (!cancelled) {
          setError('네트워크 오류가 발생했습니다.')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [qs, budget])

  const setSort = (next: BrowseSort) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('sort', next)
    p.set('page', '1')
    router.push(`/products?${p.toString()}`)
  }

  const formatWon = (n: number | null) => {
    if (n == null) return '문의'
    return `${n.toLocaleString('ko-KR')}원~`
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav className="text-xs text-slate-500">
        <Link href="/" className="font-medium text-slate-600 hover:underline">
          홈
        </Link>
        <span className="mx-1.5 text-slate-300">/</span>
        상품 목록
      </nav>

      <header className="mt-4 border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">여행 상품</h1>
        <p className="mt-2 text-sm text-slate-600">
          {budget ? (
            <>
              인당 예산 <span className="font-semibold text-teal-800">{parseInt(budget, 10).toLocaleString('ko-KR')}원</span> 이하로
              필터된 결과입니다. (등록 상품의 실제 금액 기준)
            </>
          ) : (
            <>선택하신 지역·유형 조건에 맞는 등록 상품입니다.</>
          )}
        </p>
        {data && (
          <p className="mt-2 text-sm font-medium text-slate-800">
            조건에 맞는 상품 {data.total.toLocaleString('ko-KR')}건
          </p>
        )}
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">정렬</span>
        {(
          [
            ['budget_fit', '예산에 가까운 순'],
            ['popular', '인기순'],
            ['price_asc', '낮은 가격순'],
            ['price_desc', '높은 가격순'],
            ['departure_asc', '출발일 빠른 순'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={
              sort === key
                ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-10 text-center text-sm text-slate-500">불러오는 중…</p>}
      {error && (
        <p className="mt-10 text-center text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {!loading && data && data.total === 0 && (
        <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-6 text-sm text-slate-900">
          <p className="font-semibold">조건에 맞는 상품이 없습니다.</p>
          <p className="mt-2 text-slate-700">
            필터를 완화하거나, 단독 맞춤 견적으로 문의해 보세요.
          </p>
          {data.suggestedBudgetMax != null && budget && (
            <p className="mt-3">
              참고: 현재 데이터에서 가장 가까운 상위 가격대는 약{' '}
              <strong>{data.suggestedBudgetMax.toLocaleString('ko-KR')}원</strong>부터 있습니다.
            </p>
          )}
          <Link href="/quote/private" className="mt-4 inline-block font-medium text-teal-800 underline">
            단독 견적 문의하기
          </Link>
        </div>
      )}

      {!loading && data && data.total > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/products/${item.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="relative aspect-[16/10] w-full bg-slate-100">
                  {item.coverImageUrl || item.bgImageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote image hosts */
                    <img
                      src={item.coverImageUrl ?? item.bgImageUrl ?? ''}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">이미지 없음</div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] font-medium text-slate-500">
                    {formatOriginSourceForDisplay(item.originSource)}
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-teal-800">
                    {item.title}
                  </h2>
                  {item.primaryDestination && (
                    <p className="mt-1 text-xs text-slate-600">{item.primaryDestination}</p>
                  )}
                  {item.coverImageDisplayName ? (
                    <p className="mt-1 text-[11px] text-slate-500">{item.coverImageDisplayName}</p>
                  ) : null}
                  <div className="mt-auto pt-3 flex flex-wrap items-end justify-between gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {formatWon(item.effectivePricePerPersonKrw)}
                    </span>
                    {item.duration && <span className="text-xs text-slate-500">{item.duration}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
