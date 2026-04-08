'use client'

import { useCallback, useId, useState } from 'react'
import type { OverseasLandingSearchState } from '@/lib/overseas-landing-search'
import { getPublicBookableMinYmd } from '@/lib/public-bookable-date'
import {
  TRAVEL_LANDING_SUPPLIER_CHIPS,
  type TravelLandingSupplierPickId,
} from '@/lib/travel-landing-supplier-chips'

type Props = {
  value: OverseasLandingSearchState
  onChange: (next: OverseasLandingSearchState) => void
  onReset: () => void
  /** `collapsed`: 키워드 한 줄 + 상세 조건 접기 (메가메뉴 중심 페이지용) */
  variant?: 'full' | 'collapsed'
}

function patch<K extends keyof OverseasLandingSearchState>(
  prev: OverseasLandingSearchState,
  key: K,
  v: OverseasLandingSearchState[K]
): OverseasLandingSearchState {
  return { ...prev, [key]: v }
}

export default function OverseasSearchPanel({
  value,
  onChange,
  onReset,
  variant = 'full',
}: Props) {
  const baseId = useId()
  const publicMinYmd = getPublicBookableMinYmd()
  const [moreOpen, setMoreOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(variant === 'full')

  const set = useCallback(
    (key: keyof OverseasLandingSearchState, v: OverseasLandingSearchState[typeof key]) => {
      onChange(patch(value, key, v as never))
    },
    [onChange, value]
  )

  const dirty =
    value.q.trim() !== '' ||
    value.departDate !== '' ||
    value.departFrom.trim() !== '' ||
    value.travelType !== 'all' ||
    (value.supplierPick != null && value.supplierPick !== 'all') ||
    value.priceMin.trim() !== '' ||
    value.priceMax.trim() !== '' ||
    value.sort !== 'default'

  const formInner = (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${baseId}-q`} className="text-[11px] font-semibold text-bt-ink">
            어디로, 무엇을
          </label>
          <input
            id={`${baseId}-q`}
            type="search"
            enterKeyHint="search"
            placeholder="나라·도시·상품명 (예: 다낭, 도쿄)"
            value={value.q}
            onChange={(e) => set('q', e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-bt-border bg-bt-page px-3 py-2.5 text-sm text-bt-ink outline-none ring-bt-ui-accent/30 placeholder:text-bt-subtle focus:border-bt-ui-accent focus:ring-2"
          />
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-2 lg:gap-4">
          <div>
            <label htmlFor={`${baseId}-date`} className="text-[11px] font-semibold text-bt-ink">
              출발일
            </label>
            <input
              id={`${baseId}-date`}
              type="date"
              value={value.departDate}
              min={publicMinYmd}
              onChange={(e) => set('departDate', e.target.value >= publicMinYmd ? e.target.value : '')}
              className="mt-1.5 w-full rounded-xl border border-bt-border bg-bt-page px-3 py-2.5 text-sm text-bt-ink outline-none focus:border-bt-ui-accent focus:ring-2 focus:ring-bt-ui-accent/25"
            />
          </div>
          <div>
            <label htmlFor={`${baseId}-from`} className="text-[11px] font-semibold text-bt-ink">
              출발지
            </label>
            <input
              id={`${baseId}-from`}
              type="text"
              placeholder="예: 인천 · 김포"
              value={value.departFrom}
              onChange={(e) => set('departFrom', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-bt-border bg-bt-page px-3 py-2.5 text-sm text-bt-ink outline-none placeholder:text-bt-subtle focus:border-bt-ui-accent focus:ring-2 focus:ring-bt-ui-accent/25"
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-bt-ink">여행 유형</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="여행 유형">
          {(
            [
              { id: 'all' as const, label: '전체' },
              { id: 'package' as const, label: '패키지' },
              { id: 'free' as const, label: '자유·에어텔' },
            ] as const
          ).map((t) => {
            const on = value.travelType === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set('travelType', t.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? 'border-bt-accent bg-bt-accent-subtle text-bt-ink shadow-sm'
                    : 'border-bt-border bg-bt-surface text-bt-muted hover:border-bt-accent/35'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="text-xs font-semibold text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
        >
          {moreOpen ? '추가 조건 접기' : '가격·공급사·정렬 등 추가 조건'}
        </button>
        {moreOpen ? (
          <div className="mt-3 grid gap-4 border-t border-bt-border/70 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor={`${baseId}-supplier`} className="text-[11px] font-semibold text-bt-ink">
                공급사
              </label>
              <select
                id={`${baseId}-supplier`}
                value={value.supplierPick ?? 'all'}
                onChange={(e) => {
                  const v = e.target.value
                  set('supplierPick', v === 'all' ? null : (v as TravelLandingSupplierPickId))
                }}
                className="mt-1.5 w-full rounded-xl border border-bt-border bg-white px-3 py-2 text-sm text-bt-ink"
              >
                {TRAVEL_LANDING_SUPPLIER_CHIPS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-bt-subtle">상단 「공급사별」 진입과 함께 쓸 수 있습니다.</p>
            </div>
            <div>
              <label htmlFor={`${baseId}-sort`} className="text-[11px] font-semibold text-bt-ink">
                정렬
              </label>
              <select
                id={`${baseId}-sort`}
                value={value.sort}
                onChange={(e) => set('sort', e.target.value as OverseasLandingSearchState['sort'])}
                className="mt-1.5 w-full rounded-xl border border-bt-border bg-white px-3 py-2 text-sm text-bt-ink"
              >
                <option value="default">추천(등록 순)</option>
                <option value="price_asc">가격 낮은 순</option>
                <option value="price_desc">가격 높은 순</option>
                <option value="date_asc">출발일 빠른 순</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${baseId}-pmin`} className="text-[11px] font-semibold text-bt-ink">
                최저가(원)
              </label>
              <input
                id={`${baseId}-pmin`}
                inputMode="numeric"
                placeholder="예: 800000"
                value={value.priceMin}
                onChange={(e) => set('priceMin', e.target.value.replace(/[^\d]/g, ''))}
                className="mt-1.5 w-full rounded-xl border border-bt-border bg-bt-page px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-pmax`} className="text-[11px] font-semibold text-bt-ink">
                최고가(원)
              </label>
              <input
                id={`${baseId}-pmax`}
                inputMode="numeric"
                placeholder="예: 2500000"
                value={value.priceMax}
                onChange={(e) => set('priceMax', e.target.value.replace(/[^\d]/g, ''))}
                className="mt-1.5 w-full rounded-xl border border-bt-border bg-bt-page px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[11px] font-semibold text-bt-ink">세부 옵션 (데이터 연동 예정)</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    { id: 'dep-ok', label: '출발확정만' },
                    { id: 'dur', label: '일정 길이' },
                    { id: 'air', label: '항공사' },
                    { id: 'shop', label: '쇼핑 유무' },
                    { id: 'opt', label: '현지옵션 유무' },
                  ] as const
                ).map((x) => (
                  <div key={x.id}>
                    <label className="text-[10px] font-medium text-bt-subtle">{x.label}</label>
                    <select disabled className="mt-1 w-full cursor-not-allowed rounded-xl border border-bt-border/80 bg-bt-surface px-3 py-2 text-sm text-bt-subtle">
                      <option>준비 중</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )

  if (variant === 'collapsed') {
    return (
      <section
        id="travel-os-search"
        className="scroll-mt-24 border-b border-bt-border bg-gradient-to-b from-bt-surface/90 to-white px-4 py-4 sm:px-6"
        aria-labelledby={`${baseId}-heading`}
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${baseId}-heading`} className="text-sm font-semibold text-bt-ink">
              상세 조건
            </h2>
            {dirty ? (
              <button
                type="button"
                onClick={() => onReset()}
                className="rounded-lg border border-bt-border bg-white px-2.5 py-1.5 text-[11px] font-medium text-bt-muted hover:border-bt-accent/40"
              >
                조건 초기화
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-bt-subtle">
            지역은 위 메가메뉴로 고르고, 여기서는 키워드·일정·가격만 좁혀도 됩니다.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${baseId}-q-collapsed`} className="sr-only">
                키워드 검색
              </label>
              <input
                id={`${baseId}-q-collapsed`}
                type="search"
                enterKeyHint="search"
                placeholder="상품명·키워드 (선택)"
                value={value.q}
                onChange={(e) => set('q', e.target.value)}
                className="w-full rounded-xl border border-bt-border bg-white px-3 py-2.5 text-sm text-bt-ink outline-none focus:border-bt-ui-accent focus:ring-2 focus:ring-bt-ui-accent/25"
              />
            </div>
            <button
              type="button"
              onClick={() => setDetailOpen((o) => !o)}
              className="shrink-0 rounded-xl border border-bt-border bg-white px-4 py-2.5 text-sm font-semibold text-bt-ink hover:border-bt-accent/50"
              aria-expanded={detailOpen}
            >
              {detailOpen ? '상세 조건 접기' : '출발일·유형·가격 펼치기'}
            </button>
          </div>

          {detailOpen ? (
            <div className="mt-4 rounded-2xl border border-bt-border/80 bg-white p-4 shadow-sm sm:p-5">{formInner}</div>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section
      id="travel-os-search"
      className="scroll-mt-24 border-b border-bt-border bg-gradient-to-b from-bt-surface to-white px-4 py-8 sm:px-6"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-muted">Search</p>
            <h2 id={`${baseId}-heading`} className="mt-1 text-xl font-semibold tracking-tight text-bt-ink sm:text-2xl">
              조건 검색
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-bt-subtle sm:text-sm">
              목적지는 상단 지역 메뉴를 우선 사용하고, 여기서는 키워드·일정·가격으로 보조합니다.
            </p>
          </div>
          {dirty ? (
            <button
              type="button"
              onClick={() => onReset()}
              className="shrink-0 rounded-lg border border-bt-border bg-white px-3 py-2 text-xs font-medium text-bt-muted transition hover:border-bt-accent/40 hover:text-bt-ink"
            >
              검색·필터 초기화
            </button>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-bt-border/80 bg-white p-4 shadow-sm sm:p-5">{formInner}</div>
      </div>
    </section>
  )
}
