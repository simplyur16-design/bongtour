/**
 * Detail-body 타입 re-export. 본문 **슬라이스·호텔·포함불포함** 본체는 `detail-body-parser-{supplier}.ts`.
 *
 * 항공·옵션·쇼핑 필드는 타입 호환용으로 스냅샷에 있으나, 구조화 책임은 `register-input-parse-*` + `register-parse-*`이다.
 *
 * SSOT: `docs/body-parser-*-ssot.md`.
 *
 * @see docs/detail-body-review-policy.md
 * @see docs/detail-body-input-priority.md
 */
export type {
  DetailSectionType,
  FlightStructured,
  HotelStructured,
  OptionalToursStructured,
  ShoppingStructured,
  IncludedExcludedStructured,
  DetailBodyParseSnapshot,
} from '@/lib/detail-body-parser-types'
