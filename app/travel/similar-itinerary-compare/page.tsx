import type { Metadata } from 'next'
import Link from 'next/link'
import {
  formatTriStateFact,
  loadSimilarItineraryCompare,
} from '@/lib/dev-similar-itinerary-compare'
import {
  parseSimilarItineraryCompareKind,
  SIMILAR_ITINERARY_COMPARE_PATH,
} from '@/lib/similar-itinerary-compare-href'
import { formatCompareWeekLabel } from '@/lib/similar-itinerary-compare-week'
import './compare.css'

export const metadata: Metadata = {
  title: '비슷한 일정 비교 · 공급사별 사실',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    place?: string
    duration?: string
    kind?: string
    week?: string
  }>
}

function FactCell({ value }: { value: string }) {
  const unknown = value === '정보 없음'
  const none = value === '없음'
  return (
    <span
      className={
        unknown ? 'sic-fact sic-fact--unknown' : none ? 'sic-fact sic-fact--no' : 'sic-fact sic-fact--yes'
      }
    >
      {value}
    </span>
  )
}

export default async function SimilarItineraryComparePage({ searchParams }: PageProps) {
  // REGRESSION-FREEZE[similar-itinerary-compare-entry]: public travel path — 사실표만·등록대기/목업 프리셋 없음 — manifest
  const sp = (await searchParams) ?? {}
  const place = String(sp.place || '').trim()
  const duration = String(sp.duration || '').trim()
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: kind=package|fit — manifest
  const kind = parseSimilarItineraryCompareKind(sp.kind)
  // REGRESSION-FREEZE[similar-itinerary-compare-week]: 같은 출발 주간 — week=YYYY-MM-DD, 기본 가까운 주 — manifest
  const week = String(sp.week || '').trim()
  const bundle = await loadSimilarItineraryCompare({ place, duration, kind, week, applyWeekFilter: true })
  const selectedWeek = bundle.selectedWeekStartYmd
  const weekHref = (ws: string) =>
    `${SIMILAR_ITINERARY_COMPARE_PATH}?${new URLSearchParams({ place, duration, kind, week: ws }).toString()}`
  const hasQuery = Boolean(place && duration)
  const isFitKind = kind === 'fit'
  const backHref = isFitKind ? '/travel/air-hotel' : '/travel/overseas'
  const backLabel = isFitKind ? '← 자유여행' : '← 해외여행'
  const kindLabel = isFitKind ? '자유여행' : '해외 패키지'

  return (
    <div className="sic-root">
      <header className="sic-top">
        <Link href={backHref} className="sic-back">
          {backLabel}
        </Link>
      </header>

      <div className="sic-head">
        <p className="sic-eyebrow">비슷한 일정 · {kindLabel}</p>
        <h1>
          {hasQuery ? (
            <>
              {bundle.placeLabel}{' '}
              <span className="sic-head-duration">{bundle.durationLabel}</span>
            </>
          ) : (
            '공급사별 사실 비교'
          )}
        </h1>
        <p className="sic-sub">{bundle.disclaimer}</p>
      </div>

      {!hasQuery ? (
        <p className="sic-empty">
          상품 상세의 「같은 일정, 공급사별 사실 비교」로 들어와 주세요.
          <span className="sic-empty-path"> ({SIMILAR_ITINERARY_COMPARE_PATH}?place=…&amp;duration=…&amp;kind=package|fit)</span>
        </p>
      ) : bundle.rows.length === 0 && bundle.weekOptions.length === 0 ? (
        <p className="sic-empty">이 목적지·박일의 {kindLabel} 후보가 없습니다.</p>
      ) : (
        <>
        {bundle.weekOptions.length > 0 ? (
          <nav className="sic-weeks" aria-label="출발 주간 선택">
            <p className="sic-weeks-label">출발 주간</p>
            <div className="sic-weeks-list">
              {bundle.weekOptions.map((o) => (
                <Link
                  key={o.weekStartYmd}
                  href={weekHref(o.weekStartYmd)}
                  scroll={false}
                  aria-current={o.weekStartYmd === selectedWeek ? 'true' : undefined}
                  className={o.weekStartYmd === selectedWeek ? 'sic-week sic-week--on' : 'sic-week'}
                >
                  <span className="sic-week-range">{formatCompareWeekLabel(o.weekStartYmd)}</span>
                  <span className="sic-week-count">공급사 {o.supplierCount}곳</span>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        <div className="sic-table-wrap">
          <table className="sic-table">
            <caption className="sic-caption">
              {kindLabel} 후보 {bundle.rows.length}건
              {selectedWeek ? ` · ${formatCompareWeekLabel(selectedWeek)} 출발 기준` : ''}
              {bundle.rowsWithoutWeekDepartureCount > 0
                ? ` · 이 주 출발이 없는 후보 ${bundle.rowsWithoutWeekDepartureCount}건 제외`
                : ''}
              {' · 추천/우위 표시 없음'}
            </caption>
            <thead>
              <tr>
                <th scope="col">공급사</th>
                <th scope="col">상품</th>
                <th scope="col">박일</th>
                <th scope="col">이 주 출발가(성인)</th>
                <th scope="col">출발일</th>
                <th scope="col">가격대</th>
                <th scope="col">항공사</th>
                <th scope="col">쇼핑</th>
                <th scope="col">옵션</th>
                <th scope="col">호텔(성급)</th>
                <th scope="col">식사(조·중·석)</th>
              </tr>
            </thead>
            <tbody>
              {bundle.rows.map((r) => (
                <tr key={r.id}>
                  <td className="sic-supplier">{r.supplierLabel}</td>
                  <td className="sic-title">
                    <Link href={r.href}>{r.title}</Link>
                  </td>
                  <td>{r.duration}</td>
                  <td className="sic-price sic-week-price">{r.weekPriceLabel}</td>
                  <td className="sic-week-date">{r.weekDepartureLabel}</td>
                  <td className="sic-price">{r.priceLabel}</td>
                  <td className="sic-airline">
                    {r.airlineLabel === '정보 없음' ? (
                      <FactCell value={r.airlineLabel} />
                    ) : (
                      r.airlineLabel
                    )}
                  </td>
                  <td>
                    <FactCell value={formatTriStateFact(r.shopping)} />
                  </td>
                  <td>
                    <FactCell value={formatTriStateFact(r.optional)} />
                  </td>
                  <td className="sic-hotel">{r.hotelLabel}</td>
                  <td className="sic-meal">{r.mealLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sic-week-note">
          이 주 출발가: 고른 주(월~일) 출발일 중 성인 1인 요금이 낮은 출발 1건의 등록 요금이에요. 예약 가능한 출발만 보며, 실제 요금은
          상품 상세의 출발일 달력에서 다시 확인해 주세요.
        </p>
        </>
      )}
    </div>
  )
}
