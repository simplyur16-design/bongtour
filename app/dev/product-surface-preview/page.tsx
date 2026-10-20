import type { Metadata } from 'next'
import { MapPin } from 'lucide-react'
import { assertDevDesignPreviewAllowed } from '@/lib/dev-design-preview-guard'
import {
  DEV_PRODUCT_SURFACE_DEFAULT_SLUG,
  loadDevProductSurfaceLiveMock,
} from '@/lib/dev-product-surface-live-mock'
import { getHotelMealLabels } from '@/lib/hotel-meal-display'
import ScheduleDayHotelMealCard from '@/app/components/detail/ScheduleDayHotelMealCard'
import ProductSurfaceBenefitRow from './ProductSurfaceBenefitRow'
import './product-surface-preview.css'

export const metadata: Metadata = {
  title: 'Product surface v1 · live registered product',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{ id?: string; slug?: string; gemini?: string }>
}

export default async function ProductSurfacePreviewPage({ searchParams }: PageProps) {
  assertDevDesignPreviewAllowed()

  const sp = (await searchParams) ?? {}
  const idOrSlug = (sp.id || sp.slug || '').trim() || undefined
  const callGemini = sp.gemini === '1'

  const mock = await loadDevProductSurfaceLiveMock({
    idOrSlug,
    callGemini,
    skipMapImage: true,
  })
  const mealLabels = getHotelMealLabels('overseas')

  if (!mock) {
    return (
      <div className="ps-root">
        <header className="ps-top">
          <a href="/dev/ocean-warm-home">← 홈 목업</a>
          <span className="ps-draft">draft-local</span>
        </header>
        <div className="ps-head">
          <h1>등록 상품을 찾지 못했습니다</h1>
          <p className="ps-sub">
            예: <code>?slug={DEV_PRODUCT_SURFACE_DEFAULT_SLUG}</code>
          </p>
        </div>
      </div>
    )
  }

  const priceText = mock.priceLabel

  return (
    <div className="ps-root">
      <header className="ps-top">
        <a href="/dev/ocean-warm-home">← 홈 목업</a>
        <span className="ps-draft">
          live · {mock.supplierLabelKo} · {mock.mapSource}
          {mock.mapModel ? ` · ${mock.mapModel}` : ''}
        </span>
      </header>

      <div className="ps-hero-gallery" aria-hidden>
        <div className="ps-hero-main" />
        <div className="ps-thumbs">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="ps-head">
        <p className="ps-supplier-badge">{mock.supplierLabelKo}</p>
        <h1>{mock.heroShortTitle ?? mock.originalTitle.slice(0, 40)}</h1>
        {mock.heroSubtitle ? <p className="ps-sub">{mock.heroSubtitle}</p> : null}
        <p className="ps-code">
          {mock.slug || mock.productId} ·{' '}
          <a href={mock.publicPath} style={{ color: 'inherit' }}>
            공개 상세
          </a>
        </p>

        <div className="ps-chips" aria-label="상태·혜택">
          {mock.chips.map((c) => (
            <span key={c} className={/도시|박|일/.test(c) ? 'ps-chip-brand' : 'ps-chip-sand'}>
              {c}
            </span>
          ))}
        </div>

        {mock.benefitIcons.length > 0 ? <ProductSurfaceBenefitRow icons={mock.benefitIcons} /> : null}

        <div className="ps-price-card">
          <div>
            <span className="ps-price-label">성인 1인</span>
            <strong className="ps-price">{priceText}</strong>
          </div>
          <span className="ps-linkish">출발일·요금 보기</span>
        </div>
      </div>

      <div className="ps-tab-system">
        <input type="radio" name="ps-tab" id="ps-tab-info" className="ps-tab-input" defaultChecked />
        <input type="radio" name="ps-tab" id="ps-tab-schedule" className="ps-tab-input" />
        <input type="radio" name="ps-tab" id="ps-tab-map" className="ps-tab-input" />
        <input type="radio" name="ps-tab" id="ps-tab-notice" className="ps-tab-input" />

        <div className="ps-tabs" role="presentation" aria-label="상품 상세 구역">
          <label htmlFor="ps-tab-info" className="ps-tab">
            상품정보
          </label>
          <label htmlFor="ps-tab-schedule" className="ps-tab">
            일정
          </label>
          {mock.showMapTab ? (
            <label htmlFor="ps-tab-map" className="ps-tab">
              동선지도
            </label>
          ) : null}
          <label htmlFor="ps-tab-notice" className="ps-tab">
            유의사항
          </label>
        </div>

        <div className="ps-panels">
          <div className="ps-panel ps-panel-info">
            {mock.usp.length > 0 ? (
              <section className="ps-block ps-usp">
                <h2 className="sr-only">상품 포인트</h2>
                <ol>
                  {mock.usp.map((u, i) => (
                    <li key={`${u.strong}-${i}`}>
                      <span className="ps-num">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{u.strong}</strong>
                        <p>{u.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {mock.included.length > 0 ? (
              <section className="ps-block">
                <h2>포함</h2>
                <ul>
                  {mock.included.map((line) => (
                    <li key={line.slice(0, 40)}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {mock.excluded.length > 0 ? (
              <section className="ps-block">
                <h2>불포함</h2>
                <ul>
                  {mock.excluded.map((line) => (
                    <li key={line.slice(0, 40)}>{line}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <details className="ps-fold" open>
              <summary>공급사 상품명 (SEO·검색용 원문)</summary>
              <p className="ps-orig">{mock.originalTitle}</p>
            </details>
          </div>

          <div className="ps-panel ps-panel-schedule">
            <ol className="ps-days">
              {mock.schedule.map((d) => (
                <li key={d.day}>
                  <strong>
                    {d.day}일차 · {d.title}
                  </strong>
                  <p className="ps-day-route">
                    <span className="ps-ico-well" aria-hidden>
                      <MapPin className="ps-ico" strokeWidth={2.25} />
                    </span>
                    <span>{d.routeText}</span>
                  </p>
                  {d.description ? <p className="ps-day-body">{d.description}</p> : null}
                  <ScheduleDayHotelMealCard
                    hotelLine={d.hotelLine}
                    mealLines={d.mealLines}
                    labels={mealLabels}
                    className="ps-day-hotel-meal"
                  />
                </li>
              ))}
            </ol>
          </div>

          {mock.showMapTab ? (
            <div className="ps-panel ps-panel-map">
              <div className="ps-map">
                {mock.mapImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- registered route map URL
                  <img
                    className="ps-map-gemini-img"
                    src={mock.mapImageUrl}
                    alt={mock.mapDraft.routeSummary || '동선지도'}
                  />
                ) : (
                  <div className="ps-map-loading">
                    <p>
                      {mock.mapPersistStatus === 'generating'
                        ? '등록 시 지도 생성 중…'
                        : mock.mapPersistStatus === 'failed'
                          ? '등록 시 지도 생성 실패'
                          : '등록 시 저장된 동선지도 없음'}
                    </p>
                    <p className="ps-map-note">
                      조회에서 새로 그리지 않습니다. 등록 confirm 시 저장됩니다.
                      {mock.mapImageFailReason ? ` (${mock.mapImageFailReason})` : ''}
                    </p>
                  </div>
                )}
                {(() => {
                  const cities = mock.mapDraft.nodes
                    .slice()
                    .sort((a, b) => a.order - b.order)
                  const mid = Math.ceil(cities.length / 2)
                  const row1 = cities.slice(0, mid)
                  const row2 = cities.slice(mid)
                  const line = (rows: typeof cities) =>
                    rows.map((n) => `${n.order}. ${n.city}`).join(' → ')
                  return cities.length > 0 ? (
                    <div className="ps-map-story ps-map-story-2line">
                      <p>{line(row1)}</p>
                      {row2.length > 0 ? <p>{line(row2)}</p> : null}
                    </div>
                  ) : null
                })()}
              </div>
              <p className="ps-map-note">
                교통: {mock.mapSource} · 지도: 등록시 저장
                {mock.mapFailReason ? ` · ${mock.mapFailReason}` : ''}
              </p>
            </div>
          ) : null}

          <div className="ps-panel ps-panel-notice">
            <section className="ps-block">
              <h2>유의사항</h2>
              <p>여권·비자·현지 규정은 출국 전 공식 안내를 확인하세요.</p>
            </section>
          </div>
        </div>
      </div>

      <div className="ps-sticky" role="group" aria-label="예약 행동">
        <div className="ps-sticky-price">
          <span>성인 1인</span>
          <strong>{priceText}</strong>
        </div>
        <span className="ps-btn-ghost">상담</span>
        <span className="ps-btn-primary">예약</span>
      </div>
    </div>
  )
}
