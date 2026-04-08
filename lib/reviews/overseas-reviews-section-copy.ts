/**
 * 해외여행 `/travel/overseas` 하단 「단독모임 고객리뷰」 블록 — 카피·목록 한도 SSOT.
 *
 * 수정 위치 안내
 * - 타이틀·설명: 아래 `OVERSEAS_REVIEWS_SECTION_COPY` 만 편집 (메타는 실제 published 건수로 동적 생성)
 * - 순환 그리드: `listOverseasPublishedReviewCards` 로 최대 `OVERSEAS_LANDING_PUBLISHED_REVIEWS_LIMIT` 건 로드 후
 *   `OVERSEAS_LANDING_FEATURED_REVIEWS_LIMIT` 장씩 `OVERSEAS_REVIEWS_ROTATION_MS` 마다 로테이션
 * - UI: `PrivateGroupCustomerReviewSection` + `OverseasReviewsRotatingGrid`
 */
/** 한 번에 보이는 카드 수(21건 전체를 이 개수씩 돌려 가며 표시) */
export const OVERSEAS_LANDING_FEATURED_REVIEWS_LIMIT = 6

/** 후기 카드 묶음이 바뀌는 간격(ms) */
export const OVERSEAS_REVIEWS_ROTATION_MS = 6000

/** 전체 published 목록 조회 시 기본 상한(더보기·별도 연결용) */
export const OVERSEAS_LANDING_PUBLISHED_REVIEWS_LIMIT = 21

/** 해외·published 실제 건수 기반 메타 문구 */
export function overseasReviewsPublishedMetaLabel(publishedCount: number): string {
  return `공개 후기 ${publishedCount}건`
}

export const OVERSEAS_REVIEWS_SECTION_COPY = {
  /** 섹션 h2 (타이틀) */
  heading: '단독모임 고객리뷰',
  /**
   * 본문 설명 (기존 2문단을 요청 카피 한 줄로 통합)
   */
  description: '검수를 마친 회원 후기를 소개합니다. 일부 내용은 요약될 수 있습니다.',
} as const
