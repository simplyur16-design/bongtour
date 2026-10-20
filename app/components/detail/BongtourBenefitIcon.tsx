'use client'

import {
  Ban,
  Banknote,
  Building2,
  Bus,
  Crown,
  Leaf,
  MapPin,
  Plane,
  PlaneTakeoff,
  ShieldCheck,
  ShoppingBag,
  User,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import {
  BONGTOUR_BENEFIT_ICON_DEFS,
  type BongtourBenefitIconKey,
  type BongtourBenefitIconTone,
} from '@/lib/bongtour-benefit-icon-ssot'

// REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: BongtourBenefitIcon pastel squircle — manifest

const LUCIDE_BY_KEY: Record<BongtourBenefitIconKey, LucideIcon> = {
  direct_flight: Plane,
  domestic_flight: PlaneTakeoff,
  international_flight: Plane,
  coach: Bus,
  no_shopping: ShoppingBag,
  no_tip: Banknote,
  no_option: Ban,
  conductor: User,
  guide_fee: ShieldCheck,
  relaxed: Leaf,
  small_group: Users,
  vip: Crown,
  gourmet: UtensilsCrossed,
  hotel: Building2,
  meal: UtensilsCrossed,
  map_pin: MapPin,
}

const TONE_CLASS: Record<BongtourBenefitIconTone, string> = {
  blue: 'bt-benefit--blue',
  green: 'bt-benefit--green',
  orange: 'bt-benefit--orange',
  purple: 'bt-benefit--purple',
  pink: 'bt-benefit--pink',
  teal: 'bt-benefit--teal',
}

type Props = {
  iconKey: BongtourBenefitIconKey
  /** 라벨 노출 (기본 true) */
  showLabel?: boolean
  /** 라벨 덮어쓰기 */
  label?: string
  size?: 'sm' | 'md'
  className?: string
  /** 노쇼핑·노팁 등 사선 금지 오버레이 */
  struck?: boolean
}

const STRUCK_KEYS: BongtourBenefitIconKey[] = ['no_shopping', 'no_tip', 'no_option']

export default function BongtourBenefitIcon({
  iconKey,
  showLabel = true,
  label,
  size = 'md',
  className = '',
  struck,
}: Props) {
  const def = BONGTOUR_BENEFIT_ICON_DEFS[iconKey]
  const Icon = LUCIDE_BY_KEY[iconKey]
  if (!def || !Icon) return null
  const showStrike = struck ?? STRUCK_KEYS.includes(iconKey)
  const text = label ?? def.label

  return (
    <span className={`bt-benefit ${TONE_CLASS[def.tone]} bt-benefit--${size} ${className}`.trim()}>
      <span className="bt-benefit__well" aria-hidden>
        <Icon className="bt-benefit__svg" strokeWidth={1.75} />
        {showStrike ? <span className="bt-benefit__slash" /> : null}
      </span>
      {showLabel ? <span className="bt-benefit__label">{text}</span> : null}
    </span>
  )
}
