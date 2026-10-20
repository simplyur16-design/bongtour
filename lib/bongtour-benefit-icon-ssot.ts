/**
 * 상품 혜택·교통 아이콘 SSOT — pastel squircle + Lucide stroke (문자 이모지 금지).
 * 레퍼런스: 직항/국내선/노쇼핑… 아이콘 행.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: BONGTOUR_BENEFIT_ICON_KEYS — manifest
 */

export const BONGTOUR_BENEFIT_ICON_KEYS = [
  'direct_flight',
  'domestic_flight',
  'international_flight',
  'coach',
  'no_shopping',
  'no_tip',
  'no_option',
  'conductor',
  'guide_fee',
  'relaxed',
  'small_group',
  'vip',
  'gourmet',
  'hotel',
  'meal',
  'map_pin',
] as const

export type BongtourBenefitIconKey = (typeof BONGTOUR_BENEFIT_ICON_KEYS)[number]

export type BongtourBenefitIconTone = 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'teal'

export type BongtourBenefitIconDef = {
  key: BongtourBenefitIconKey
  label: string
  tone: BongtourBenefitIconTone
  /** lucide-react export name */
  lucide: string
}

export const BONGTOUR_BENEFIT_ICON_DEFS: Record<BongtourBenefitIconKey, BongtourBenefitIconDef> = {
  direct_flight: { key: 'direct_flight', label: '직항', tone: 'blue', lucide: 'Plane' },
  domestic_flight: { key: 'domestic_flight', label: '국내선', tone: 'green', lucide: 'PlaneTakeoff' },
  international_flight: { key: 'international_flight', label: '국제선', tone: 'teal', lucide: 'Plane' },
  coach: { key: 'coach', label: '전용버스', tone: 'blue', lucide: 'Bus' },
  no_shopping: { key: 'no_shopping', label: '노쇼핑', tone: 'orange', lucide: 'ShoppingBag' },
  no_tip: { key: 'no_tip', label: '노팁', tone: 'purple', lucide: 'Banknote' },
  no_option: { key: 'no_option', label: '노옵션', tone: 'pink', lucide: 'Ban' },
  conductor: { key: 'conductor', label: '인솔자동행', tone: 'orange', lucide: 'User' },
  guide_fee: { key: 'guide_fee', label: '가이드경비포함', tone: 'blue', lucide: 'ShieldCheck' },
  relaxed: { key: 'relaxed', label: '여유로운일정', tone: 'green', lucide: 'Leaf' },
  small_group: { key: 'small_group', label: '소규모', tone: 'purple', lucide: 'Users' },
  vip: { key: 'vip', label: 'VIP', tone: 'blue', lucide: 'Crown' },
  gourmet: { key: 'gourmet', label: '미식특화', tone: 'green', lucide: 'UtensilsCrossed' },
  hotel: { key: 'hotel', label: '숙소', tone: 'teal', lucide: 'Building2' },
  meal: { key: 'meal', label: '식사', tone: 'orange', lucide: 'UtensilsCrossed' },
  map_pin: { key: 'map_pin', label: '동선', tone: 'blue', lucide: 'MapPin' },
}

/** 원문/칩 문자열 → 아이콘 키 (결정론) */
export function inferBongtourBenefitIconKeys(haystack: string): BongtourBenefitIconKey[] {
  const t = haystack.replace(/\s+/g, ' ')
  const out: BongtourBenefitIconKey[] = []
  const push = (k: BongtourBenefitIconKey) => {
    if (!out.includes(k)) out.push(k)
  }
  if (/직항|논\s*스탑|경유\s*없/.test(t)) push('direct_flight')
  if (/국내선/.test(t)) push('domestic_flight')
  if (/국제선/.test(t)) push('international_flight')
  if (/대형\s*버스|관광\s*버스|버스\s*이동/.test(t)) push('coach')
  if (/노쇼핑|쇼핑\s*없/.test(t)) push('no_shopping')
  if (/노팁|팁\s*없/.test(t)) push('no_tip')
  if (/노옵션|옵션\s*없/.test(t)) push('no_option')
  if (/인솔자/.test(t)) push('conductor')
  if (/가이드\s*경비\s*포함|가이드비\s*포함/.test(t)) push('guide_fee')
  if (/여유로운\s*일정|여유\s*일정/.test(t)) push('relaxed')
  if (/소규모/.test(t)) push('small_group')
  if (/\bVIP\b|브이아이피/.test(t)) push('vip')
  if (/미식|특식/.test(t)) push('gourmet')
  return out
}

/** 동선 구간 mode/label → 범례 아이콘 */
export function benefitIconKeyForTransportLabel(label: string): BongtourBenefitIconKey {
  const t = label.replace(/\s+/g, '')
  if (/국내선/.test(t)) return 'domestic_flight'
  if (/직항/.test(t)) return 'direct_flight'
  if (/국제선|항공/.test(t)) return 'international_flight'
  if (/버스|코치/.test(t)) return 'coach'
  return 'map_pin'
}
