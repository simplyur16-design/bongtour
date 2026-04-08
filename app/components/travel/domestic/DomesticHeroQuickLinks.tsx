import Link from 'next/link'
import { DOMESTIC_HERO_QUICK_CHIPS } from '@/lib/domestic-landing-nav-data'

export default function DomesticHeroQuickLinks() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-2">
        {DOMESTIC_HERO_QUICK_CHIPS.map((c) => (
          <Link
            key={`${c.pillar}-${c.secondKey}`}
            href={`/travel/domestic?dmPillar=${encodeURIComponent(c.pillar)}&dmItem=${encodeURIComponent(c.secondKey)}#travel-dm-products`}
            className="bt-badge"
          >
            {c.label}
          </Link>
        ))}
      </div>
      <Link
        href="#travel-dm-explore"
        className="text-xs font-bold text-bt-link underline-offset-2 hover:underline sm:ml-auto"
      >
        지역 트리로 찾기 →
      </Link>
    </div>
  )
}
