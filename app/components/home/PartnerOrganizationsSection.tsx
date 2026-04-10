import Image from 'next/image'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const partnerOrganizations = [
  { name: '경기관광공사', src: '/images/org-logos/경기관광공사.png' },
  { name: '한국관광공사', src: '/images/org-logos/한국관광공사.jpg' },
  { name: '수원도시재단', src: '/images/org-logos/수원도시재단.png' },
  { name: '중부일보', src: '/images/org-logos/중부일보.png' },
  { name: '경기도의회', src: '/images/org-logos/경기도의회.jpg' },
  { name: '수원특례시의회', src: '/images/org-logos/수원특례시의회.png' },
  { name: '경기문화재단', src: '/images/org-logos/경기문화재단.jpg' },
  { name: '경기도경제과학진흥원', src: '/images/org-logos/경기도경제과학진흥원.png' },
  { name: '경기도청', src: '/images/org-logos/경기도청.jpg' },
  { name: '수원특례시', src: '/images/org-logos/수원특례시.png' },
] as const

/** 통일된 로고 셀 높이 (CLS 방지, 세로 기준 정렬) */
const LOGO_BOX_H = 'h-[4.25rem] sm:h-[4.75rem] md:h-[5rem]'

export default function PartnerOrganizationsSection() {
  return (
    <section
      className="border-t border-slate-200/70 bg-slate-50/90 py-10 md:py-12"
      aria-labelledby="partner-orgs-heading"
    >
      <div className={SITE_CONTENT_CLASS}>
        <h2
          id="partner-orgs-heading"
          className="text-center text-base font-semibold tracking-tight text-slate-800 md:text-lg"
        >
          주요 거래·협력 이력 기관
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[13px] leading-relaxed text-slate-600 sm:text-sm">
          봉투어가 실제 상담·진행·연수·행사 운영 등의 업무를 수행한 기관입니다.
        </p>

        <ul
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
          aria-label="주요 거래·협력 이력 기관 로고"
        >
          {partnerOrganizations.map((org) => (
            <li key={org.src} className="list-none">
              <div
                className={
                  'group relative w-full overflow-hidden rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2.5 transition-colors duration-200 hover:border-slate-300/90 ' +
                  LOGO_BOX_H
                }
              >
                <Image
                  src={org.src}
                  alt={org.name}
                  fill
                  sizes="(max-width:640px) 45vw, (max-width:1024px) 28vw, 18vw"
                  className="object-contain object-center p-0.5 opacity-80 saturate-[0.82] transition-[opacity,filter] duration-200 group-hover:opacity-100 group-hover:saturate-100"
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-[11px] leading-snug text-slate-500 sm:text-xs">
          각 기관의 로고 및 상표는 해당 권리자에게 있습니다.
        </p>
      </div>
    </section>
  )
}
