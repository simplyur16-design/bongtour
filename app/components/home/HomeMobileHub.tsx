import Link from 'next/link'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import MobileHomeClientErrorBoundary from '@/app/components/home/MobileHomeClientErrorBoundary'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { MAIN_HOME_FIRST_HUB_DESCRIPTION, MAIN_HOME_FIRST_HUB_TITLE } from '@/lib/main-hub-copy'
import { homeHubCardImageSrc } from '@/lib/home-hub-images'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrganizationsSection from '@/app/components/home/PartnerOrganizationsSection'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

/** 모바일 주요 서비스 카드 배경 — 메인 허브와 동일 키 규칙(`public/images/home-hub/…`). 항공+호텔은 국내 키로 톤 분리. */
const MAIN_TILES = [
  {
    href: '/travel/overseas',
    title: MAIN_HOME_FIRST_HUB_TITLE,
    desc: MAIN_HOME_FIRST_HUB_DESCRIPTION,
    bgSrc: homeHubCardImageSrc('overseas'),
  },
  {
    href: '/travel/air-hotel',
    title: '항공+호텔',
    desc: '자유여행 · 에어텔',
    bgSrc: homeHubCardImageSrc('domestic'),
  },
  {
    href: '/travel/overseas/private-trip',
    title: '우리여행',
    desc: '가족 · 소규모 맞춤여행',
    bgSrc: '/images/private-trip-hero/rjbl2142-0c881383-a.webp',
  },
  {
    href: '/training',
    title: '국외연수',
    desc: '학교 · 기업 · 공공기관',
    bgSrc: homeHubCardImageSrc('training'),
  },
] as const

const QUICK_ACTIONS = [
  { href: INQUIRY_TRAVEL, label: '상담접수', primary: true as const },
  { href: '/air-ticketing', label: '항공권', primary: false as const },
  { href: '/charter-bus', label: '전세버스', primary: false as const },
] as const

/** 카드 외곽·높이·라운드 공통 — 배경은 자식 레이어(이미지+오버레이) */
const TILE_CARD_CLASS =
  'relative isolate flex min-h-[8.75rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-bt-border-soft bg-slate-100 px-4 py-5 text-center shadow-sm ring-1 ring-bt-border-soft/40 transition active:scale-[0.99] hover:border-bt-border-strong hover:ring-bt-border-strong/30'

/** 모바일(`max-lg`)에서만 배경 이미지 스택 — PC 메인 허브와 겹치지 않도록 동일 컴포넌트라도 뷰포트로 제한 */
const TILE_BG_IMG =
  'pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-55 saturate-[0.82] contrast-[0.97] max-lg:block lg:hidden'
const TILE_BG_SCRIM =
  'pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/93 via-white/86 to-slate-50/90 max-lg:block lg:hidden'
const TILE_BG_VIGNETTE =
  'pointer-events-none absolute inset-0 -z-[9] bg-gradient-to-t from-slate-900/12 via-transparent to-slate-900/5 max-lg:block lg:hidden'

type Props = { seasonSlides: HomeSeasonPickDTO[] }

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 상담 CTA / 주요 서비스 / 시즌 추천(이미지·글) / 실무 요청 / 파트너.
 */
export default function HomeMobileHub({ seasonSlides }: Props) {
  return (
    <div className={`space-y-7 pb-8 pt-3 ${SITE_CONTENT_CLASS}`}>
      <div className="space-y-2">
        <p className="text-center text-[11px] font-semibold leading-snug tracking-tight text-teal-900 sm:text-xs">
          상담 완료시 여행자보험 무료
        </p>
        <Link
          href={INQUIRY_TRAVEL}
          className="flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-4 text-center text-base font-semibold text-white shadow-md transition hover:bg-teal-800"
        >
          내 여행 시작하기
        </Link>
      </div>

      <section aria-label="주요 서비스">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>주요 서비스</h2>
        <ul className="grid grid-cols-2 gap-3.5" role="list">
          {MAIN_TILES.map((t) => (
            <li key={t.href} className="min-w-0">
              <Link href={t.href} className={TILE_CARD_CLASS}>
                <span
                  aria-hidden
                  className={TILE_BG_IMG}
                  style={{ backgroundImage: `url(${JSON.stringify(t.bgSrc)})` }}
                />
                <span aria-hidden className={TILE_BG_SCRIM} />
                <span aria-hidden className={TILE_BG_VIGNETTE} />
                <span className="relative z-10 flex flex-col items-center text-center">
                  <p className="text-lg font-bold leading-tight text-slate-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)] sm:text-xl">
                    {t.title}
                  </p>
                  <p className="mt-2.5 max-w-[13rem] text-sm font-semibold leading-snug text-slate-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                    {t.desc}
                  </p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {seasonSlides.length > 0 ? (
        <MobileHomeClientErrorBoundary section="season-carousel">
          <HomeMobileHubSeasonCarousel slides={seasonSlides} hideManualNav />
        </MobileHomeClientErrorBoundary>
      ) : null}

      <section aria-label="실무 요청">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>실무 요청</h2>
        <div className="flex w-full flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center">
          {QUICK_ACTIONS.map((a) =>
            a.primary ? (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-teal-700 px-5 py-3.5 text-center text-base font-bold text-white shadow-md ring-2 ring-teal-800/25 transition hover:bg-teal-800 active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
              >
                {a.label}
              </Link>
            ) : (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl border-2 border-slate-400/90 bg-slate-50 px-5 py-3.5 text-center text-base font-bold text-slate-900 shadow-sm transition hover:border-teal-600 hover:bg-teal-50/90 active:scale-[0.99] sm:w-auto sm:min-w-[9.5rem]"
              >
                {a.label}
              </Link>
            )
          )}
        </div>
      </section>

      <div className="border-t border-slate-200/80 pt-7">
        <PartnerOrganizationsSection />
      </div>
    </div>
  )
}
