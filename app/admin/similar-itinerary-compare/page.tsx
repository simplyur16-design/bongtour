import type { Metadata } from 'next'
import Link from 'next/link'
import {
  DEV_COMPARE_PRESETS,
  formatTriStateFact,
  loadSimilarItineraryCompare,
} from '@/lib/dev-similar-itinerary-compare'
import { OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'
import { requireAdmin } from '@/lib/require-admin'
import { SIMILAR_ITINERARY_COMPARE_ADMIN_PATH } from '@/lib/similar-itinerary-compare-admin-path'
import {
  buildSimilarItineraryCompareHref,
  SIMILAR_ITINERARY_COMPARE_PATH,
} from '@/lib/similar-itinerary-compare-href'
import { redirect } from 'next/navigation'
import { enqueueCompareClusterGapIngestAction } from '@/app/travel/similar-itinerary-compare/actions'
import '../../travel/similar-itinerary-compare/compare.css'

export const metadata: Metadata = {
  title: '비슷한 일정 비교 · 등록대기 수집',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    place?: string
    duration?: string
    gapCreated?: string
    gapSkipped?: string
    gapFailed?: string
    gapTargeted?: string
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

export default async function AdminSimilarItineraryComparePage({ searchParams }: PageProps) {
  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 등록대기 수집은 admin only — manifest
  const admin = await requireAdmin()
  if (!admin) {
    redirect('/auth/signin?callbackUrl=%2Fadmin%2Fsimilar-itinerary-compare')
  }

  const sp = (await searchParams) ?? {}
  const place = String(sp.place || DEV_COMPARE_PRESETS[0].place).trim()
  const duration = String(sp.duration || DEV_COMPARE_PRESETS[0].duration).trim()
  const bundle = await loadSimilarItineraryCompare({
    place,
    duration,
    allowPresetFallback: true,
  })

  const gapFlash =
    sp.gapCreated != null || sp.gapSkipped != null || sp.gapFailed != null
      ? {
          created: Number(sp.gapCreated ?? 0) || 0,
          skipped: Number(sp.gapSkipped ?? 0) || 0,
          failed: Number(sp.gapFailed ?? 0) || 0,
          targeted: String(sp.gapTargeted ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : null

  return (
    <div className="sic-root">
      <header className="sic-top">
        <Link href="/admin/pending" className="sic-back">
          ← 등록대기
        </Link>
        <span className="sic-draft">관리자 · 등록대기 수집</span>
      </header>

      <div className="sic-head">
        <p className="sic-eyebrow">비교 클러스터 운영</p>
        <h1>
          {bundle.placeLabel}{' '}
          <span className="sic-head-duration">{bundle.durationLabel}</span>
        </h1>
        <p className="sic-sub">
          모자란 공급사만 목록 검색 → 등록대기로 올립니다. 공개 비교표(
          <Link href={`${SIMILAR_ITINERARY_COMPARE_PATH}?place=${encodeURIComponent(bundle.placeLabel)}&duration=${encodeURIComponent(bundle.durationLabel)}`}>
            {SIMILAR_ITINERARY_COMPARE_PATH}
          </Link>
          )에는 승인·등록 후에야 나타납니다.
        </p>
      </div>

      <nav className="sic-presets" aria-label="예시 묶음">
        {DEV_COMPARE_PRESETS.map((p) => {
          const active = p.place === bundle.placeLabel && p.duration === bundle.durationLabel
          const href = `${SIMILAR_ITINERARY_COMPARE_ADMIN_PATH}?place=${encodeURIComponent(p.place)}&duration=${encodeURIComponent(p.duration)}`
          return (
            <Link key={`${p.place}-${p.duration}`} href={href} className={active ? 'sic-chip sic-chip--on' : 'sic-chip'}>
              <span>
                {p.place} {p.duration}
              </span>
              <small>{p.note}</small>
            </Link>
          )
        })}
      </nav>

      {gapFlash ? (
        <p className="sic-gap-flash" role="status">
          등록대기 수집 완료 · 대상 {gapFlash.targeted.length || '—'}곳 · 생성 {gapFlash.created} · 스킵{' '}
          {gapFlash.skipped} · 실패 {gapFlash.failed}
        </p>
      ) : null}

      {bundle.missingSuppliers.length > 0 ? (
        <section className="sic-gap" aria-label="모자란 공급사">
          <div className="sic-gap-head">
            <p className="sic-gap-label">없는 공급사</p>
            <ul className="sic-gap-chips">
              {bundle.missingSuppliers.map((key) => (
                <li key={key} className="sic-gap-chip">
                  {OVERSEAS_SUPPLIER_LABEL[key] ?? key}
                </li>
              ))}
            </ul>
          </div>
          <form action={enqueueCompareClusterGapIngestAction} className="sic-gap-form">
            <input type="hidden" name="place" value={bundle.placeLabel} />
            <input type="hidden" name="duration" value={bundle.durationLabel} />
            <button type="submit" className="sic-gap-btn">
              등록대기 수집
            </button>
            <p className="sic-gap-note">
              목적지 키워드로 목록만 긁어 등록대기로 올립니다. 공개 비교표에는 승인·등록 후에야 나타납니다.
            </p>
          </form>
        </section>
      ) : (
        <p className="sic-gap-flash" role="status">
          canonical 공급사 후보가 모두 있습니다.
        </p>
      )}

      {bundle.rows.length === 0 ? (
        <p className="sic-empty">이 목적지·박일로 등록된 후보가 없습니다.</p>
      ) : (
        <div className="sic-table-wrap">
          <table className="sic-table">
            <caption className="sic-caption">등록 후보 {bundle.rows.length}건 (운영 미리보기)</caption>
            <thead>
              <tr>
                <th scope="col">공급사</th>
                <th scope="col">상품</th>
                <th scope="col">박일</th>
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
                    {r.slug ? <code className="sic-slug">{r.slug}</code> : null}
                  </td>
                  <td>{r.duration}</td>
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
      )}

      <footer className="sic-foot">
        <p>
          공개 링크 ·{' '}
          <code>
            {buildSimilarItineraryCompareHref({
              place: bundle.placeLabel,
              duration: bundle.durationLabel,
            }) ?? SIMILAR_ITINERARY_COMPARE_PATH}
          </code>
        </p>
      </footer>
    </div>
  )
}
