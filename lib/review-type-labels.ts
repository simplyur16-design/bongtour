import type { ReviewType } from '@/lib/reviews-types'

export const REVIEW_TYPES_ORDERED: ReviewType[] = [
  'solo',
  'group_small',
  'group_corporate',
  'group_friends',
  'family',
  'parents',
  'hiking',
]

/** review_type → 화면 표시명 (시스템 분류 고정) */
export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  solo: '단독여행',
  group_small: '소규모단체',
  group_corporate: '기업단체',
  group_friends: '친구모임',
  family: '가족여행',
  parents: '부모님동반',
  hiking: '산악회여행',
}

export function reviewTypeLabel(t: string | null | undefined): string {
  if (!t) return ''
  return REVIEW_TYPE_LABELS[t as ReviewType] ?? t
}
