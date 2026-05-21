/** 회원 후기 — 상품 라인(우리끼리 / 패키지 / 자유여행). tags SSOT */

export const TRIP_LINE_TAG_PREFIX = 'trip_line:'

export type MemberReviewTripLine = 'private_trip' | 'package' | 'air_hotel_free'

export const MEMBER_REVIEW_TRIP_LINES: { id: MemberReviewTripLine; label: string; hint: string }[] = [
  { id: 'private_trip', label: '우리끼리', hint: '맞춤·소그룹 우리견적 여행' },
  { id: 'package', label: '패키지', hint: '해외 패키지 상품' },
  { id: 'air_hotel_free', label: '자유여행', hint: '항공+호텔·에어텔 등' },
]

export function tripLineTag(line: MemberReviewTripLine): string {
  return `${TRIP_LINE_TAG_PREFIX}${line}`
}

export function parseTripLineFromTags(tags: string[] | null | undefined): MemberReviewTripLine | null {
  if (!tags?.length) return null
  for (const t of tags) {
    if (t.startsWith(TRIP_LINE_TAG_PREFIX)) {
      const id = t.slice(TRIP_LINE_TAG_PREFIX.length) as MemberReviewTripLine
      if (MEMBER_REVIEW_TRIP_LINES.some((x) => x.id === id)) return id
    }
  }
  return null
}

export function tripLineLabel(line: MemberReviewTripLine | null): string {
  if (!line) return '—'
  return MEMBER_REVIEW_TRIP_LINES.find((x) => x.id === line)?.label ?? '—'
}

export function mergeTripLineIntoTags(tags: string[] | undefined, line: MemberReviewTripLine): string[] {
  const base = (tags ?? []).filter((t) => !t.startsWith(TRIP_LINE_TAG_PREFIX))
  return [...base, tripLineTag(line)]
}
