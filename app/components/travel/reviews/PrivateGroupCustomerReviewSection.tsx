import Link from 'next/link'
import OverseasReviewsRotatingGrid from '@/app/components/travel/reviews/OverseasReviewsRotatingGrid'
import TravelReviewCard from '@/app/components/travel/reviews/TravelReviewCard'
/** 섹션 카피 SSOT: `lib/reviews/overseas-reviews-section-copy.ts` */
import {
  OVERSEAS_LANDING_FEATURED_REVIEWS_LIMIT,
  OVERSEAS_REVIEWS_ROTATION_MS,
  OVERSEAS_REVIEWS_SECTION_COPY,
  overseasReviewsPublishedMetaLabel,
} from '@/lib/reviews/overseas-reviews-section-copy'
import type { ReviewCardModel } from '@/lib/reviews-types'

const DEFAULT_INQUIRY_HREF = '/inquiry?type=travel&source=/travel/overseas'

type Props = {
  /** 공개(published) 후기 목록 — 서버에서만 조회. pending/rejected 미포함 */
  publishedReviews: ReviewCardModel[]
  /** 해외·published 전체 건수 — 메타 `공개 후기 N건` */
  publishedTotalCount: number
  /** 하단 문의 CTA 링크 — 페이지별 source만 바꿀 때 사용 */
  inquiryHref?: string
  /** h2·본문 설명 오버라이드(단독여행 랜딩 등) */
  headingOverride?: string
  descriptionOverride?: string
  /** 섹션 내부 하단 문의 블록 숨김 — 페이지에 별도 마지막 CTA가 있을 때 */
  hideFooterCta?: boolean
  /** 상단 eyebrow(BongTour overseas) 숨김 */
  hideEyebrow?: boolean
}

/**
 * 해외여행 랜딩 하단 — 공개 후기만. 6장씩 보이며 전체가 순환(21건 등).
 */
export default function PrivateGroupCustomerReviewSection({
  publishedReviews,
  publishedTotalCount,
  inquiryHref = DEFAULT_INQUIRY_HREF,
  headingOverride,
  descriptionOverride,
  hideFooterCta = false,
  hideEyebrow = false,
}: Props) {
  const hasCards = publishedReviews.length > 0
  const useRotation = publishedReviews.length > OVERSEAS_LANDING_FEATURED_REVIEWS_LIMIT

  return (
    <section
      id="travel-os-private-reviews"
      className="scroll-mt-24 border-t border-bt-border bg-gradient-to-b from-bt-surface/80 to-bt-page py-14 sm:py-16"
      aria-labelledby="travel-os-private-reviews-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {!hideEyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">BongTour overseas</p>
        )}
        <h2
          id="travel-os-private-reviews-heading"
          className={`text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl ${hideEyebrow ? '' : 'mt-2'}`}
        >
          {headingOverride ?? OVERSEAS_REVIEWS_SECTION_COPY.heading}
        </h2>
        <p className="mt-2 text-xs font-medium text-bt-muted sm:text-sm">
          {overseasReviewsPublishedMetaLabel(publishedTotalCount)}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">
          {descriptionOverride ?? OVERSEAS_REVIEWS_SECTION_COPY.description}
        </p>

        {hasCards ? (
          useRotation ? (
            <OverseasReviewsRotatingGrid
              reviews={publishedReviews}
              visibleCount={OVERSEAS_LANDING_FEATURED_REVIEWS_LIMIT}
              intervalMs={OVERSEAS_REVIEWS_ROTATION_MS}
            />
          ) : (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {publishedReviews.map((review) => (
                <li key={review.id}>
                  <TravelReviewCard review={review} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-bt-border bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-bt-muted">
              아직 소개할 공개 후기가 없습니다. 회원 후기는 제출 후 관리자 승인을 거쳐 이 영역에 노출됩니다.
            </p>
          </div>
        )}

        {!hideFooterCta && (
          <div className="mt-12 flex flex-col items-center gap-4 border-t border-bt-border/80 pt-10 text-center sm:pt-12">
            <p className="max-w-md text-sm text-bt-muted">일정·예산에 맞는 해외 패키지를 함께 짚어 드립니다.</p>
            <Link
              href={inquiryHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-bt-cta-primary px-8 py-3 text-sm font-semibold text-white transition hover:bg-bt-cta-primary-hover"
            >
              나에게 맞는 해외여행 상담 신청하기
            </Link>
            <Link
              href={inquiryHref}
              className="text-sm font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
            >
              짧은 문의로 시작하기
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
