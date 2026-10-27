/**
 * 등록 저장 duration 한 줄 — 전 공급사 공통.
 * REGRESSION-FREEZE[trip-duration-hashtag-leak]: 팩트 nights/days → 없으면 제목 머리 구간(첫 # 이전)만.
 * 해시태그 속 부분 일정(「#후르가다 2박3일」)은 상품 길이로 쓰지 않는다. nights는 공급사 명시일 때만 (days-1 추측 금지).
 */
import { durationHintFromTitleHeadOnly } from '@/lib/derive-trip-nights-days'

export function buildRegisterDurationLabel(
  nights: number | null | undefined,
  days: number | null | undefined,
  title?: string | null,
): string {
  const n = typeof nights === 'number' && Number.isInteger(nights) && nights >= 0 ? nights : null
  const d = typeof days === 'number' && Number.isInteger(days) && days >= 1 ? days : null
  if (n != null && d != null) return `${n}박 ${d}일`
  if (d != null) return `${d}일`
  const hint = durationHintFromTitleHeadOnly(title)
  if (hint) return hint
  return ''
}
