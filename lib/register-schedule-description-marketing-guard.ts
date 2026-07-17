/**
 * 등록 schedule description — 홍보·특전·수하물·쇼핑 등 요약 오염 감지 (전 공급사 공통).
 * REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: plan_info 마케팅 필터 — manifest
 */

const REGISTER_SCHEDULE_DESCRIPTION_MARKETING_RE =
  /seat\s*pitch|좌석\s*(?:간격|피치)|수하물|위탁\s*수|기내\s*수화물|기내수화물|baggage|carry[\s-]?on|mileage|마일리지|탑승권|기내\s*엔터|entertainment\s*service|엔터테인먼트|특전|인솔자|escort|프리미엄\s*석|비즈니스\s*석|프레스티지|프리\s*미디엄|유의\s*사항|선택\s*관광|쇼핑\s*(?:횟수|타임|점)|면세(?:점|품)?(?:\s*\d+)?\s*(?:회\s*)?쇼핑|쇼핑\s*\d+\s*회|회이|kaiseki|카이세키|롯데관광\s*단독|한국보다\s*\d+\s*시간|국가번호|관광\s*시간|여행\s*준비\s*가이드|비즈니스\s*클래스|프리미엄\s*서비스|기내\s*식\s*특전|좌석\s*배정|leg\s*room|recline|리클라이닝/i

const REGISTER_SCHEDULE_DESCRIPTION_TITLE_SHOPPING_RE =
  /면세(?:점|품)?(?:\s*\d+)?\s*(?:회\s*)?쇼핑|쇼핑\s*\d+\s*회/u

/** 일정요약(description)에 마케팅·특전·수하물·쇼핑 안내가 섞였는지 */
export function registerScheduleDescriptionHasMarketingNoise(
  description: string | null | undefined,
): boolean {
  const t = String(description ?? '').trim()
  if (!t) return false
  return REGISTER_SCHEDULE_DESCRIPTION_MARKETING_RE.test(t)
}

/** title·routeText·city 슬롯에 쇼핑·면세 라벨이 들어갔는지 */
export function registerScheduleRouteOrTitleHasShoppingNoise(
  text: string | null | undefined,
): boolean {
  const t = String(text ?? '').trim()
  if (!t) return false
  if (REGISTER_SCHEDULE_DESCRIPTION_TITLE_SHOPPING_RE.test(t)) return true
  if (/쇼핑\s*타임|시내를\s*떠나기\s*전/u.test(t)) return true
  return false
}

/** plan_info 한 줄(문장)이 일정 본문이 아닌 마케팅·행정인지 */
export function isRegisterSchedulePlanInfoMarketingLine(line: string): boolean {
  const t = String(line ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length < 4) return true
  if (registerScheduleDescriptionHasMarketingNoise(t)) return true
  if (/^\[특전\]/i.test(t)) return true
  if (/^\[포함\s*일정\]/i.test(t)) return true
  if (/^(?:조식|중식|석식|운항\s*소요|호텔식|기내식|자유식|특식)\b/u.test(t) && t.length < 72) return true
  return false
}
