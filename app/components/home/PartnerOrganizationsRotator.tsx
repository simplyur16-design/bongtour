'use client'

import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import PartnerOrgLogoCell from './PartnerOrgLogoCell'

type PartnerOrg = {
  name: string
  src: string
  wrapperClassName?: string
  logoClassName?: string
}

const LOGO_RAIL_WRAPPER_BOOSTED =
  'h-[3.4rem] w-full min-h-0 sm:h-[3.98rem] md:h-[4.55rem]'

const LOGO_RAIL_WRAPPER_PROVINCE_OFFICE =
  'h-[4.1rem] w-full min-h-0 sm:h-[4.75rem] md:h-[5.4rem]'

const LOGO_RAIL_WRAPPER_GUNPO = 'h-[4rem] w-full min-h-0 sm:h-[4.65rem] md:h-[5.3rem]'

const LOGO_SHRINK_CITY = 'max-h-[58%] w-auto origin-center sm:max-h-[60%] md:max-h-[62%]'

const LOGO_SHRINK_CITY_HANAM = 'max-h-[64%] w-auto origin-center sm:max-h-[66%] md:max-h-[68%]'

const LOGO_BOOST_CITY = 'max-h-full w-auto origin-center scale-[1.45] sm:scale-[1.39] md:scale-[1.32]'

const LOGO_BOOST_SIHEUNG = 'max-h-full w-auto origin-center scale-[1.46] sm:scale-[1.41] md:scale-[1.38]'

const LOGO_BOOST_GUNPO = 'max-h-full w-auto origin-center scale-[1.65] sm:scale-[1.6] md:scale-[1.54]'

const LOGO_SHRINK_GTI = 'max-h-full w-auto origin-center scale-[0.8] sm:scale-[0.8] md:scale-[0.8]'

const LOGO_BOOST_SUBTLE = 'max-h-full w-auto origin-center scale-[1.1] sm:scale-[1.1] md:scale-[1.1]'

const partnerOrganizations: PartnerOrg[] = [
  { name: '경기관광공사', src: '/images/org-logos/gyeonggi-tourism-org.webp', wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED },
  { name: '안양시', src: '/images/org-logos/anyang.webp', logoClassName: LOGO_BOOST_CITY },
  { name: '한국관광공사', src: '/images/org-logos/korea-tourism-org.webp', logoClassName: LOGO_BOOST_SUBTLE },
  { name: '김포시', src: '/images/org-logos/gimpo.webp' },
  { name: '수원도시재단', src: '/images/org-logos/suwon-urban-foundation.webp' },
  { name: '고양시', src: '/images/org-logos/goyang.webp', logoClassName: LOGO_SHRINK_CITY },
  { name: '중부일보', src: '/images/org-logos/jungbu-ilbo.webp', logoClassName: LOGO_BOOST_SUBTLE },
  { name: '파주시', src: '/images/org-logos/paju.webp', logoClassName: LOGO_SHRINK_CITY },
  { name: '경기도의회', src: '/images/org-logos/gyeonggi-assembly.webp' },
  { name: '하남시', src: '/images/org-logos/hanam.webp', logoClassName: LOGO_SHRINK_CITY_HANAM },
  { name: '수원특례시의회', src: '/images/org-logos/suwon-city-assembly.webp' },
  { name: '오산시', src: '/images/org-logos/osan.webp', logoClassName: LOGO_BOOST_CITY },
  {
    name: '경기문화재단',
    src: '/images/org-logos/gyeonggi-culture-foundation.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED,
    logoClassName: LOGO_BOOST_SUBTLE,
  },
  {
    name: '시흥시',
    src: '/images/org-logos/siheung.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED,
    logoClassName: LOGO_BOOST_SIHEUNG,
  },
  { name: '경기도경제과학진흥원', src: '/images/org-logos/gyeonggi-gti.webp', logoClassName: LOGO_SHRINK_GTI },
  { name: '안성시', src: '/images/org-logos/ansung.gif', logoClassName: LOGO_BOOST_CITY },
  {
    name: '경기도청',
    src: '/images/org-logos/gyeonggi-province-office.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_PROVINCE_OFFICE,
  },
  { name: '용인특례시', src: '/images/org-logos/yongin.webp' },
  { name: '수원특례시', src: '/images/org-logos/suwon-city.webp' },
  {
    name: '군포시',
    src: '/images/org-logos/gunpo.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_GUNPO,
    logoClassName: LOGO_BOOST_GUNPO,
  },
  { name: '광명시', src: '/images/org-logos/gwangmyung.webp' },
]

const LOGO_RAIL_WRAPPER = 'h-[2.35rem] w-full min-h-0 sm:h-[2.75rem] md:h-[3.15rem]'

function PartnerOrgRailItems({
  idSuffix,
  organizations,
}: {
  idSuffix: string
  organizations: PartnerOrg[]
}) {
  return (
    <>
      {organizations.map((org) => (
        <li
          key={`${org.src}-${idSuffix}`}
          className="box-border flex w-[min(12.5rem,46vw)] shrink-0 list-none items-center justify-center px-3 sm:w-[13.75rem] md:w-[14.75rem]"
        >
          <PartnerOrgLogoCell
            name={org.name}
            src={org.src}
            sizes="(max-width:640px) 42vw, 208px"
            wrapperClassName={org.wrapperClassName ?? LOGO_RAIL_WRAPPER}
            logoClassName={org.logoClassName}
            imageClassName="opacity-[0.86] saturate-[0.86] transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:saturate-100"
          />
        </li>
      ))}
    </>
  )
}

const partnerMarqueeRowSplit = (() => {
  const n = partnerOrganizations.length
  const mid = Math.ceil(n / 2)
  return { track1: partnerOrganizations.slice(0, mid), track2: partnerOrganizations.slice(mid) }
})()

function PartnerOrgMarqueeRow({
  rowKey,
  organizations,
  trackStyle,
  edgeFadeClass,
}: {
  rowKey: string
  organizations: PartnerOrg[]
  trackStyle?: CSSProperties
  edgeFadeClass: { left: string; right: string }
}) {
  return (
    <div className="relative overflow-hidden">
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r sm:w-12 md:w-16 ${edgeFadeClass.left}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l sm:w-12 md:w-16 ${edgeFadeClass.right}`}
        aria-hidden
      />
      <div className="bt-partner-org-marquee-track flex w-max flex-nowrap" style={trackStyle}>
        <ul className="flex shrink-0 list-none items-center gap-x-8 pr-8">
          <PartnerOrgRailItems idSuffix={`${rowKey}-a`} organizations={organizations} />
        </ul>
        <ul className="flex shrink-0 list-none items-center gap-x-8 pr-8" aria-hidden="true">
          <PartnerOrgRailItems idSuffix={`${rowKey}-b`} organizations={organizations} />
        </ul>
      </div>
    </div>
  )
}

export type PartnerOrganizationsRotatorTone = 'on-white' | 'on-lavender'

export type PartnerOrganizationsRotatorProps = {
  tone?: PartnerOrganizationsRotatorTone
  deferMount?: boolean
  showRightsLine?: boolean
  className?: string
}

const RIGHTS_LINE_KO = '각 기관 및 지자체의 로고와 상표는 해당 권리자에게 있습니다.'

export default function PartnerOrganizationsRotator({
  tone = 'on-white',
  deferMount = false,
  showRightsLine = true,
  className = '',
}: PartnerOrganizationsRotatorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(!deferMount)

  useEffect(() => {
    if (!deferMount || mounted) return
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setMounted(true)
          io.disconnect()
        }
      },
      { rootMargin: '320px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [deferMount, mounted])

  const edgeFadeClass =
    tone === 'on-lavender'
      ? {
          left: 'from-bt-bg-lavender-soft via-bt-bg-lavender-soft/90 to-transparent',
          right: 'from-transparent via-bt-bg-lavender/50 to-bt-bg-lavender/40',
        }
      : {
          left: 'from-white to-transparent',
          right: 'from-transparent to-white',
        }

  const rightsClass =
    tone === 'on-lavender'
      ? 'mt-8 text-center text-[11px] leading-snug text-bt-text-muted-lavender sm:text-xs'
      : 'mt-8 text-center text-[11px] leading-snug text-slate-500 sm:text-xs'

  return (
    <div ref={rootRef} className={`min-h-[10rem] scroll-mt-8 ${className}`.trim()}>
      {mounted ? (
        <>
          <div className="group relative space-y-6" aria-label="주요 거래·협력 기관 및 지자체 로고">
            <PartnerOrgMarqueeRow rowKey="t1" organizations={partnerMarqueeRowSplit.track1} edgeFadeClass={edgeFadeClass} />
            <PartnerOrgMarqueeRow
              rowKey="t2"
              organizations={partnerMarqueeRowSplit.track2}
              trackStyle={{ '--bt-partner-marquee-dur': '44s' } as CSSProperties}
              edgeFadeClass={edgeFadeClass}
            />
          </div>
          {showRightsLine ? <p className={rightsClass}>{RIGHTS_LINE_KO}</p> : null}
        </>
      ) : (
        <div className="min-h-[12rem] w-full rounded-lg bg-white/40" aria-busy="true" aria-label="로딩 중" />
      )}
    </div>
  )
}
