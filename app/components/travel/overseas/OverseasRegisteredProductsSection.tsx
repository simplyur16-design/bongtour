import Link from 'next/link'
import { filterProductsForOverseasDestinationTree } from '@/lib/active-overseas-location-tree'
import { groupBrowseScoredProductsByCountry } from '@/lib/overseas-products-by-country'
import { PRODUCT_PRICE_FOR_BROWSE_INCLUDE } from '@/lib/product-price-per-person'
import { scoreAndFilterProducts } from '@/lib/products-browse-filter'
import { prisma } from '@/lib/prisma'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

function formatWon(n: number | null) {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}

export default async function OverseasRegisteredProductsSection() {
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    orderBy: { updatedAt: 'desc' },
    include: PRODUCT_PRICE_FOR_BROWSE_INCLUDE,
  })

  const overseasRows = filterProductsForOverseasDestinationTree(rows)
  const scored = scoreAndFilterProducts(overseasRows, {
    type: null,
    destinationTerms: [],
    budgetPerPersonMax: null,
    sort: 'popular',
  })

  const byCountry = groupBrowseScoredProductsByCountry(scored)
  const total = scored.length

  return (
    <section className="border-b border-bt-border bg-bt-page" aria-labelledby="travel-os-products-heading">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="max-w-2xl">
          <h2 id="travel-os-products-heading" className="text-base font-semibold text-bt-ink">
            등록된 여행상품
          </h2>
          <p className="mt-1 text-sm text-bt-muted">
            총 {total.toLocaleString('ko-KR')}건 · 목적지 트리와 매칭해 나라(권역)별로 묶습니다. 이후 등록되는
            상품도 동일 규칙이 적용됩니다.
          </p>
        </header>

        {total === 0 ? (
          <p className="mt-6 rounded-xl border border-bt-border bg-bt-surface px-4 py-8 text-center text-sm text-bt-muted">
            표시할 등록 상품이 없습니다.
          </p>
        ) : (
          <div className="mt-10 space-y-12">
            {byCountry.map((section) => (
              <div key={section.sectionKey}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-bt-border/80 pb-3">
                  <h3 className="text-lg font-semibold tracking-tight text-bt-ink">{section.headingLabel}</h3>
                  <span className="text-xs text-bt-muted">
                    {section.groupLabel}
                    {section.sectionKey !== '__unclassified' && section.sectionKey.startsWith('group-only::')
                      ? ' · 권역만 매칭'
                      : ''}{' '}
                    · {section.items.length}건
                  </span>
                </div>
                {/* 한 줄에 약 3장 노출, 초과분은 가로 스크롤 */}
                <div className="mt-5 -mx-4 overflow-x-auto overflow-y-visible overscroll-x-contain px-4 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] sm:mx-0 sm:px-0">
                  <ul className="flex snap-x snap-mandatory gap-4 pb-2 pt-0.5">
                  {section.items.map(({ product: item, effectivePricePerPerson }) => (
                    <li
                      key={item.id}
                      className="snap-start shrink-0 w-[min(22rem,calc(100vw-2.75rem))] sm:w-[min(24rem,calc((100vw-3rem)/2))] lg:w-[calc((min(72rem,100vw)-4.5rem)/3)]"
                    >
                      <Link
                        href={`/products/${item.id}`}
                        className="group flex h-full flex-col overflow-hidden rounded-xl border border-bt-border bg-white shadow-sm transition hover:border-bt-accent/40 hover:shadow-md"
                      >
                        <div className="relative aspect-[16/10] w-full bg-bt-surface">
                          {(getFinalCoverImageUrl({ bgImageUrl: item.bgImageUrl, scheduleDays: getScheduleFromProduct(item) }) ?? item.bgImageUrl) ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- registered product cards: remote URLs */
                            <img
                              src={
                                getFinalCoverImageUrl({
                                  bgImageUrl: item.bgImageUrl,
                                  scheduleDays: getScheduleFromProduct(item),
                                }) ?? item.bgImageUrl ?? ''
                              }
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-bt-muted">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <p className="text-[11px] font-medium text-bt-muted">{item.originSource}</p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold text-bt-ink group-hover:text-bt-accent">
                            {item.title}
                          </p>
                          {item.primaryDestination && (
                            <p className="mt-1 text-xs text-bt-muted">{item.primaryDestination}</p>
                          )}
                          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
                            <span className="text-base font-bold text-bt-ink">
                              {formatWon(effectivePricePerPerson)}
                            </span>
                            {item.duration && <span className="text-xs text-bt-muted">{item.duration}</span>}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
