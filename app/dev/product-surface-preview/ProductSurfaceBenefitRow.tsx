/**
 * 서버 컴포넌트 — Lucide 혜택 아이콘 (클라이언트 청크/HMR call 오류 회피).
 * ScheduleDayHotelMealCard와 동일하게 RSC에서 lucide-react 직접 사용.
 */
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

const STRUCK = new Set<BongtourBenefitIconKey>(['no_shopping', 'no_tip', 'no_option'])

type Props = { icons: BongtourBenefitIconKey[] }

export default function ProductSurfaceBenefitRow({ icons }: Props) {
  if (!icons.length) return null
  return (
    <div className="bt-benefit-row ps-benefit-row" aria-label="상품 혜택">
      {icons.map((k) => {
        const def = BONGTOUR_BENEFIT_ICON_DEFS[k]
        const Icon = LUCIDE_BY_KEY[k]
        if (!def || !Icon) return null
        return (
          <span key={k} className={`bt-benefit ${TONE_CLASS[def.tone]} bt-benefit--md`}>
            <span className="bt-benefit__well" aria-hidden>
              <Icon className="bt-benefit__svg" strokeWidth={1.75} />
              {STRUCK.has(k) ? <span className="bt-benefit__slash" /> : null}
            </span>
            <span className="bt-benefit__label">{def.label}</span>
          </span>
        )
      })}
    </div>
  )
}
