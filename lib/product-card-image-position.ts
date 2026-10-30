// REGRESSION-FREEZE[product-card-image-object-position]: 상품 카드(4:3·정사각·16:9 프레임) 대표사진 object-position — 표시 설정만(DB 칸 없음).
// 상세용 1920x1080 크롭을 카드에서 object-cover로 자를 때 피사체가 잘리는 상품만 slug로 지정한다.
// 근거: /workspace/live/push-1031/photo-apply-prep/flagged.csv (2026-10-31 카드 캡처 검토). 목록에 없는 상품은 기본(center) 그대로.

/** slug → CSS object-position (가로% 세로%). */
export const PRODUCT_CARD_IMAGE_OBJECT_POSITION: Readonly<Record<string, string>> = Object.freeze({
  /** 타이베이 101이 16:9 왼쪽 끝 — 4:3 카드에서 통째로 잘림 */
  'fit-mt-0028': '15% 50%',
  /** 마쓰야마성 천수각(오른쪽)이 반으로 잘림 */
  'fit-hn-0035': '80% 50%',
  /** 잘츠부르크 대성당 돔·탑(오른쪽 끝) */
  'fit-hn-0047': '70% 50%',
  /** 료칸 건물(오른쪽) */
  'fit-nl-0004': '70% 50%',
  /** 교회 탑(오른쪽 끝) */
  'fit-nl-0009': '65% 50%',
  /** 하버브리지 오른쪽 기둥 — 검토 결과 '그대로 OK' (명시적으로 가운데 유지) */
  'fim-yb-0003': '50% 50%',
})

const POSITION_RE = /^(?:100|[1-9]?\d)% (?:100|[1-9]?\d)%$/

/** 카드 이미지 object-position. 지정 없음/형식 오류면 null (= 기본 center). */
export function productCardImageObjectPosition(slug: string | null | undefined): string | null {
  const key = (slug ?? '').trim().toLowerCase()
  if (!key) return null
  const v = PRODUCT_CARD_IMAGE_OBJECT_POSITION[key]
  return v && POSITION_RE.test(v) ? v : null
}

/** SafeImage style 병합용. 지정 없으면 undefined (스타일 변경 없음). */
export function productCardImageObjectPositionStyle(
  slug: string | null | undefined,
): { objectPosition: string } | undefined {
  const p = productCardImageObjectPosition(slug)
  return p ? { objectPosition: p } : undefined
}
