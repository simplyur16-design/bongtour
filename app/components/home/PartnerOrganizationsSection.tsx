import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrgLogoCell from './PartnerOrgLogoCell'

type PartnerOrg = {
  name: string
  src: string
  /** Optional rail cell size override */
  wrapperClassName?: string
  /** Optional per-logo scale / max-height tweak */
  logoClassName?: string
}

/** Taller cell for padded canvases (~1.4x default rail height); img stays max-h-full + object-contain. */
const LOGO_RAIL_WRAPPER_BOOSTED =
  'h-[3.4rem] w-full min-h-0 sm:h-[3.98rem] md:h-[4.55rem]'

/** Heavier canvas padding than BOOSTED (gyeonggi-province-office logo only). */
const LOGO_RAIL_WRAPPER_PROVINCE_OFFICE =
  'h-[4.1rem] w-full min-h-0 sm:h-[4.75rem] md:h-[5.4rem]'

/** Gunpo asset is small; tall cell + scale (tuned vs peers; last pass ~70% of prior scale). */
const LOGO_RAIL_WRAPPER_GUNPO =
  'h-[4rem] w-full min-h-0 sm:h-[4.65rem] md:h-[5.3rem]'

/** Oversized city logos (Goyang, Paju): cap height inside the rail cell. */
const LOGO_SHRINK_CITY =
  'max-h-[58%] w-auto origin-center sm:max-h-[60%] md:max-h-[62%]'

/** Hanam: slightly taller cap than SHRINK_CITY peers (~+10%). */
const LOGO_SHRINK_CITY_HANAM =
  'max-h-[64%] w-auto origin-center sm:max-h-[66%] md:max-h-[68%]'

/** Undersized city logos (Anyang, Osan, Anseong): gentle scale-up (~+10% vs prior pass). */
const LOGO_BOOST_CITY =
  'max-h-full w-auto origin-center scale-[1.45] sm:scale-[1.39] md:scale-[1.32]'

/** Siheung: BOOSTED rail; tuned ~80% of prior pass. */
const LOGO_BOOST_SIHEUNG =
  'max-h-full w-auto origin-center scale-[1.46] sm:scale-[1.41] md:scale-[1.38]'

/** Gunpo: tall cell + scale ~70% of prior pass. */
const LOGO_BOOST_GUNPO =
  'max-h-full w-auto origin-center scale-[1.65] sm:scale-[1.6] md:scale-[1.54]'

/** Gyeonggi GTI mark reads large on default rail; cap ~80%. */
const LOGO_SHRINK_GTI =
  'max-h-full w-auto origin-center scale-[0.8] sm:scale-[0.8] md:scale-[0.8]'

/** Default-rail logos that read ~10% small (KTO, Jungbu Ilbo, Gyeonggi Culture Foundation). */
const LOGO_BOOST_SUBTLE =
  'max-h-full w-auto origin-center scale-[1.1] sm:scale-[1.1] md:scale-[1.1]'

/** Paths under `public/images/org-logos/` (SSOT filenames). */
const partnerOrganizations: PartnerOrg[] = [
  {
    name: '\uacbd\uae30\uad00\uad11\uacf5\uc0ac',
    src: '/images/org-logos/gyeonggi-tourism-org.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED,
  },
  {
    name: '\uc548\uc591\uc2dc',
    src: '/images/org-logos/anyang.webp',
    logoClassName: LOGO_BOOST_CITY,
  },
  {
    name: '\ud55c\uad6d\uad00\uad11\uacf5\uc0ac',
    src: '/images/org-logos/korea-tourism-org.webp',
    logoClassName: LOGO_BOOST_SUBTLE,
  },
  { name: '\uae40\ud3ec\uc2dc', src: '/images/org-logos/gimpo.webp' },
  { name: '\uc218\uc6d0\ub3c4\uc2dc\uc7ac\ub2e8', src: '/images/org-logos/suwon-urban-foundation.webp' },
  {
    name: '\uace0\uc591\uc2dc',
    src: '/images/org-logos/goyang.webp',
    logoClassName: LOGO_SHRINK_CITY,
  },
  {
    name: '\uc911\ubd80\uc77c\ubcf4',
    src: '/images/org-logos/jungbu-ilbo.webp',
    logoClassName: LOGO_BOOST_SUBTLE,
  },
  {
    name: '\ud30c\uc8fc\uc2dc',
    src: '/images/org-logos/paju.webp',
    logoClassName: LOGO_SHRINK_CITY,
  },
  { name: '\uacbd\uae30\ub3c4\uc758\ud68c', src: '/images/org-logos/gyeonggi-assembly.webp' },
  {
    name: '\ud558\ub0a8\uc2dc',
    src: '/images/org-logos/hanam.webp',
    logoClassName: LOGO_SHRINK_CITY_HANAM,
  },
  { name: '\uc218\uc6d0\ud2b9\ub840\uc2dc\uc758\ud68c', src: '/images/org-logos/suwon-city-assembly.webp' },
  {
    name: '\uc624\uc0b0\uc2dc',
    src: '/images/org-logos/osan.webp',
    logoClassName: LOGO_BOOST_CITY,
  },
  {
    name: '\uacbd\uae30\ubb38\ud654\uc7ac\ub2e8',
    src: '/images/org-logos/gyeonggi-culture-foundation.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED,
    logoClassName: LOGO_BOOST_SUBTLE,
  },
  {
    name: '\uc2dc\ud765\uc2dc',
    src: '/images/org-logos/siheung.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_BOOSTED,
    logoClassName: LOGO_BOOST_SIHEUNG,
  },
  {
    name: '\uacbd\uae30\ub3c4\uacbd\uc81c\uacfc\ud559\uc9c4\ud765\uc6d0',
    src: '/images/org-logos/gyeonggi-gti.webp',
    logoClassName: LOGO_SHRINK_GTI,
  },
  {
    name: '\uc548\uc131\uc2dc',
    src: '/images/org-logos/ansung.gif',
    logoClassName: LOGO_BOOST_CITY,
  },
  {
    name: '\uacbd\uae30\ub3c4\uccad',
    src: '/images/org-logos/gyeonggi-province-office.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_PROVINCE_OFFICE,
  },
  { name: '\uc6a9\uc778\ud2b9\ub840\uc2dc', src: '/images/org-logos/yongin.webp' },
  { name: '\uc218\uc6d0\ud2b9\ub840\uc2dc', src: '/images/org-logos/suwon-city.webp' },
  {
    name: '\uad70\ud3ec\uc2dc',
    src: '/images/org-logos/gunpo.webp',
    wrapperClassName: LOGO_RAIL_WRAPPER_GUNPO,
    logoClassName: LOGO_BOOST_GUNPO,
  },
  { name: '\uad11\uba85\uc2dc', src: '/images/org-logos/gwangmyung.webp' },
]

/** 마퀴 대신 정적 그리드로 노출할 로고 수(동시 로드·대역 절감). */
const PARTNER_LOGO_GRID_MAX = 10

const partnerOrganizationsDisplay = partnerOrganizations.slice(0, PARTNER_LOGO_GRID_MAX)

/** Rail logo viewport height (slightly shorter on small screens). */
const LOGO_RAIL_WRAPPER =
  'h-[2.35rem] w-full min-h-0 sm:h-[2.75rem] md:h-[3.15rem]'

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

export default function PartnerOrganizationsSection() {
  return (
    <section
      className="border-t border-slate-200/70 bg-white py-10 md:py-12"
      aria-labelledby="partner-orgs-heading"
    >
      <div className={SITE_CONTENT_CLASS}>
        <h2
          id="partner-orgs-heading"
          className="text-center text-base font-semibold tracking-tight text-slate-800 md:text-lg"
        >
          {
            '\uc8fc\uc694 \uac70\ub798\u00b7\ud611\ub825 \uae30\uad00 \ubc0f \uc9c0\uc790\uccb4'
          }
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[13px] leading-relaxed text-slate-600 sm:text-sm">
          {
            '\ubd09\ud22c\uc5b4\uac00 \uc2e4\uc81c \uc0c1\ub2f4\u00b7\uc9c4\ud589\u00b7\uc5f0\uc218\u00b7\ud589\uc0ac \uc6b4\uc601 \ub4f1\uc758 \uc5c5\ubb34\ub97c \uc218\ud589\ud55c \uae30\uad00 \ubc0f \uc9c0\uc790\uccb4\uc785\ub2c8\ub2e4.'
          }
        </p>

        <div
          className="group relative mt-8"
          aria-label={
            '\uc8fc\uc694 \uac70\ub798\u00b7\ud611\ub825 \uae30\uad00 \ubc0f \uc9c0\uc790\uccb4 \ub85c\uace0'
          }
        >
          <ul className="mx-auto grid max-w-5xl list-none grid-cols-2 justify-items-center gap-x-4 gap-y-8 px-2 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-5 md:gap-x-6">
            <PartnerOrgRailItems idSuffix="grid" organizations={partnerOrganizationsDisplay} />
          </ul>
        </div>

        <p className="mt-8 text-center text-[11px] leading-snug text-slate-500 sm:text-xs">
          {
            '\uac01 \uae30\uad00 \ubc0f \uc9c0\uc790\uccb4\uc758 \ub85c\uace0\uc640 \uc0c1\ud45c\ub294 \ud574\ub2f9 \uad8c\ub9ac\uc790\uc5d0\uac8c \uc788\uc2b5\ub2c8\ub2e4.'
          }
        </p>
      </div>
    </section>
  )
}
