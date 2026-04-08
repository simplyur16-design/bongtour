'use client'

import type { DomesticRegionGroupNode } from '@/lib/domestic-location-tree'
import { DOMESTIC_NAV_PILLARS } from '@/lib/domestic-landing-nav-data'
import type { DomesticRefineState } from '@/lib/domestic-landing-refine'

const schedulePillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === 'schedule')
const themePillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === 'theme')
const audiencePillar = DOMESTIC_NAV_PILLARS.find((p) => p.id === 'audience')

type Props = {
  tree: DomesticRegionGroupNode[]
  refine: DomesticRefineState
  setRefine: (patch: Partial<DomesticRefineState>) => void
  /** 상단 메뉴로 들어온 권역 — 좌측 「지역」에 반영 */
  entryRegionGroupKey: string | null
  onPickRegionGroup: (groupKey: string | '') => void
  sidebarScheduleKey: string
  setSidebarScheduleKey: (key: string) => void
  sidebarThemeKey: string
  setSidebarThemeKey: (key: string) => void
  sidebarAudienceKey: string
  setSidebarAudienceKey: (key: string) => void
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-bt-border bg-white px-2 py-1.5 text-xs text-bt-ink focus:border-bt-ui-accent focus:outline-none focus:ring-1 focus:ring-bt-ui-accent/30'

export default function DomesticRefineSidebar({
  tree,
  refine,
  setRefine,
  entryRegionGroupKey,
  onPickRegionGroup,
  sidebarScheduleKey,
  setSidebarScheduleKey,
  sidebarThemeKey,
  setSidebarThemeKey,
  sidebarAudienceKey,
  setSidebarAudienceKey,
}: Props) {
  const regionValue = refine.regionGroupKey ?? entryRegionGroupKey ?? ''

  return (
    <aside
      className="bt-card-strong bg-white/95 p-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      aria-label="결과 좁히기"
    >
      <p className="bt-section-kicker">정교한 좁히기</p>

      <div className="mt-4 space-y-4">
        <label className="block text-[11px] font-medium text-bt-ink">
          지역 (권역)
          <select
            className={fieldClass}
            value={regionValue}
            onChange={(e) => {
              const v = e.target.value
              onPickRegionGroup(v as string | '')
              setRefine({ regionGroupKey: v || null })
            }}
          >
            <option value="">전체</option>
            {tree.map((g) => (
              <option key={g.groupKey} value={g.groupKey}>
                {g.groupLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          일정
          <select
            className={fieldClass}
            value={sidebarScheduleKey}
            onChange={(e) => setSidebarScheduleKey(e.target.value)}
          >
            <option value="">추가 조건 없음</option>
            {schedulePillar?.termSecond?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          테마
          <select
            className={fieldClass}
            value={sidebarThemeKey}
            onChange={(e) => setSidebarThemeKey(e.target.value)}
          >
            <option value="">추가 조건 없음</option>
            {themePillar?.termSecond?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          대상
          <select
            className={fieldClass}
            value={sidebarAudienceKey}
            onChange={(e) => setSidebarAudienceKey(e.target.value)}
          >
            <option value="">추가 조건 없음</option>
            {audiencePillar?.termSecond?.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          출발기간 (시작)
          <input
            type="date"
            className={fieldClass}
            value={refine.departFrom}
            onChange={(e) => setRefine({ departFrom: e.target.value })}
          />
        </label>
        <label className="block text-[11px] font-medium text-bt-ink">
          출발기간 (끝)
          <input
            type="date"
            className={fieldClass}
            value={refine.departTo}
            onChange={(e) => setRefine({ departTo: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] font-medium text-bt-ink">
            가격 하한(원)
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              className={fieldClass}
              value={refine.priceMin}
              onChange={(e) => setRefine({ priceMin: e.target.value })}
            />
          </label>
          <label className="block text-[11px] font-medium text-bt-ink">
            가격 상한(원)
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              className={fieldClass}
              value={refine.priceMax}
              onChange={(e) => setRefine({ priceMax: e.target.value })}
            />
          </label>
        </div>

        <label className="block text-[11px] font-medium text-bt-ink">
          출발확정 여부
          <select
            className={fieldClass}
            value={refine.departConfirmed}
            onChange={(e) => setRefine({ departConfirmed: e.target.value as DomesticRefineState['departConfirmed'] })}
          >
            <option value="all">전체</option>
            <option value="yes">출발일 있음</option>
            <option value="no">출발일 미정</option>
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          교통수단(키워드)
          <select
            className={fieldClass}
            value={refine.transport}
            onChange={(e) => setRefine({ transport: e.target.value as DomesticRefineState['transport'] })}
          >
            <option value="all">전체</option>
            <option value="bus">버스</option>
            <option value="train">기차·KTX</option>
            <option value="ship">배·유람</option>
            <option value="car">자가·렌터</option>
            <option value="other">위 외</option>
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          상품유형
          <select
            className={fieldClass}
            value={refine.productType}
            onChange={(e) => setRefine({ productType: e.target.value as DomesticRefineState['productType'] })}
          >
            <option value="all">전체</option>
            <option value="package">패키지 성격</option>
            <option value="custom">단체·맞춤 성격</option>
          </select>
        </label>

        <label className="block text-[11px] font-medium text-bt-ink">
          상품 키워드
          <input
            type="search"
            placeholder="상품명·지역 단어"
            className={fieldClass}
            value={refine.narrowText}
            onChange={(e) => setRefine({ narrowText: e.target.value })}
          />
        </label>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-lg border border-bt-border py-2 text-xs font-medium text-bt-muted hover:bg-bt-surface"
        onClick={() => {
          setRefine({
            narrowText: '',
            priceMin: '',
            priceMax: '',
            departFrom: '',
            departTo: '',
            transport: 'all',
            departConfirmed: 'all',
            productType: 'all',
            regionGroupKey: null,
          })
          onPickRegionGroup('')
          setSidebarScheduleKey('')
          setSidebarThemeKey('')
          setSidebarAudienceKey('')
        }}
      >
        좌측 필터만 초기화
      </button>
    </aside>
  )
}
