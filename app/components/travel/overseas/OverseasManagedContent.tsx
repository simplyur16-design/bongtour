import Link from 'next/link'
import Image from 'next/image'
import { formatCmsSourceLine, toSafePublicUrlOrPath } from '@/lib/cms-source-attribution'
import { prisma } from '@/lib/prisma'
import {
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
} from '@/lib/overseas-editorial-prioritize'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'

export default async function OverseasManagedContent({
  region,
  country,
  omitEditorialSection = false,
  omitMonthlyCuration = false,
}: {
  region?: string | null
  country?: string | null
  /** 여행상품 허브에서 중간 브리핑으로 옮긴 경우 하단 에디토리얼 그리드 생략 */
  omitEditorialSection?: boolean
  /** 목록 중간 월간 큐레이션 블록을 쓰는 경우 하단 월간 그리드 생략 */
  omitMonthlyCuration?: boolean
}) {
  const monthKey = getSeoulYearMonthNow()
  let editorialAll: Awaited<ReturnType<typeof prisma.editorialContent.findMany>> = []
  let monthlyAll: Awaited<ReturnType<typeof prisma.monthlyCurationContent.findMany>> = []
  try {
    ;[editorialAll, monthlyAll] = await Promise.all([
      fetchPublishedOverseasEditorials(),
      prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: true, monthKey },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 12,
      }),
    ])
  } catch (e) {
    console.error('[OverseasManagedContent] editorial / monthly curation load failed (page still renders)', e)
  }
  const editorials = prioritizeEditorialsByRegionAndCountry(editorialAll, region, country)
  const monthlies = prioritizeEditorialsByRegionAndCountry(monthlyAll, region, country)

  return (
    <>
      {!omitEditorialSection && editorials.length > 0 && (
        <section
          id="travel-os-editorial"
          className="scroll-mt-24 border-t-2 border-bt-border bg-gradient-to-b from-white to-bt-surface/40 py-14 sm:py-16"
          aria-labelledby="travel-os-editorial-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">목적지 브리핑</p>
            <h2 id="travel-os-editorial-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
              운영 브리핑 카드
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">
              상품 리스트와 별도 축으로 운영되는 브리핑 콘텐츠입니다. 운영자가 관리자 페이지에서 직접 입력/수정합니다.
            </p>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {editorials.map((card) => {
                const editorialSourceLine = formatCmsSourceLine(card.sourceName, card.sourceUrl, card.sourceType)
                return (
                  <li key={card.id} className="flex flex-col rounded-2xl border border-bt-border bg-bt-surface p-5 shadow-sm">
                    {(card.regionKey || card.countryCode) && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-bt-accent">
                        {[card.regionKey, card.countryCode].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <h3 className="mt-2 text-base font-semibold leading-snug text-bt-ink">{card.title}</h3>
                    {card.subtitle && <p className="mt-2 text-xs text-bt-subtle">{card.subtitle}</p>}
                    <p className="mt-2 flex-1 whitespace-pre-line text-xs leading-relaxed text-bt-muted">{card.bodyKr}</p>
                    {editorialSourceLine ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-bt-subtle">{editorialSourceLine}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            <p className="mt-10 text-center text-sm text-bt-muted">
              상담이 필요하신가요?{' '}
              <Link href="/inquiry?type=travel&source=/travel/overseas" className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline">
                해외여행 상담 신청
              </Link>
            </p>
          </div>
        </section>
      )}

      {!omitMonthlyCuration && monthlies.length > 0 && (
        <section id="travel-os-curation" className="scroll-mt-24 border-b border-bt-border bg-bt-surface py-12 sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <header className="max-w-3xl">
              <h2 className="text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">시즌 추천</h2>
            </header>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {monthlies.map((item) => {
                const href = item.linkedProductId
                  ? `/products/${item.linkedProductId}`
                  : toSafePublicUrlOrPath(item.linkedHref)
                const imageUrl = toSafePublicUrlOrPath(item.imageUrl)
                const sourceLine = formatCmsSourceLine(item.sourceName, item.sourceUrl, item.sourceType)
                return (
                  <li key={item.id} className="rounded-xl border border-bt-border bg-white p-5 shadow-sm">
                    {imageUrl && (
                      <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-bt-surface">
                        <Image
                          src={imageUrl}
                          alt={item.imageAlt || item.title}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width:1024px) 100vw, 33vw"
                        />
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-bt-ink">{item.title}</h3>
                    {item.subtitle && <p className="mt-1 text-xs text-bt-subtle">{item.subtitle}</p>}
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-bt-muted">{item.bodyKr}</p>
                    {sourceLine ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-bt-subtle">{sourceLine}</p>
                    ) : null}
                    {href && (
                      <Link href={href} className="mt-4 inline-block text-sm font-medium text-bt-link hover:text-bt-link-hover hover:underline">
                        {item.ctaLabel || '자세히 보기'}
                      </Link>
                    )}
                    {!href && <p className="mt-4 text-xs text-bt-subtle">링크가 설정되지 않은 안내 카드입니다.</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}

