import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import MobileHomeClientErrorBoundary from '@/app/components/home/MobileHomeClientErrorBoundary'
import {
  MAIN_HERO_CTA_PRIMARY_HREF,
  MAIN_HERO_CTA_PRIMARY_LABEL,
  MAIN_HERO_CTA_SECONDARY_HREF,
  MAIN_HERO_CTA_SECONDARY_LABEL,
  MAIN_HERO_MAIN_COPY,
  MAIN_HERO_SUB_COPY,
  MAIN_HUB_FOUR_CARDS,
  MAIN_HUB_FOUR_SECTION_TITLE,
  type HubFourAccent,
  type HubFourCardKey,
} from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import type { MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'
import { resolveMobileMainTileBgSrc } from '@/lib/home-mobile-hub-tile-images'
import PartnerOrganizationsSectionGate from '@/app/components/home/PartnerOrganizationsSectionGate'
import {
  HUB_FOUR_V5_HOVER_RING_CLASS,
  hubFourAccentCardSurfaceClass,
} from '@/lib/home-hub-four-accent-classes'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

/** `MAIN_HUB_FOUR_CARDS` 논리 키 → `home-hub-active.json` `mobileMainServiceTiles` 키 */
function hubFourCardKeyToMobileTileKey(k: HubFourCardKey): MobileMainServiceTileKey {
  switch (k) {
    case 'package':
      return 'overseas'
    case 'free-travel':
      return 'airHotel'
    case 'private-trip':
      return 'privateTrip'
    case 'business':
      return 'training'
    default: {
      const _exhaustive: never = k
      return _exhaustive
    }
  }
}

function hubImagePositionForTile(accent: HubFourAccent): string {
  switch (accent) {
    case 'biz':
      return 'object-[center_38%]'
    default:
      return 'object-[center_32%]'
  }
}

const QUICK_ACTIONS = [
  { href: INQUIRY_TRAVEL, label: '상담접수', primary: true as const },
  { href: '/air-ticketing', label: '항공권', primary: false as const },
  { href: '/charter-bus', label: '전세버스', primary: false as const },
] as const

const MOBILE_HUB_FOUR_SECTION_H2_CLASS =
  'mb-3 text-center text-lg font-bold leading-snug tracking-tight text-bt-text-navy sm:text-xl'

type Props = { seasonSlides: HomeSeasonPickDTO[] }

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 상담 CTA / 주요 카테고리(v5) / 시즌 추천 / 실무 요청 / 파트너.
 */
export default function HomeMobileHub({ seasonSlides }: Props) {
  const mainTiles = MAIN_HUB_FOUR_CARDS.map((card) => {
    const bgKey = hubFourCardKeyToMobileTileKey(card.key)
    return {
      href: card.href,
      key: card.key,
      title: card.categoryLabel,
      desc: card.headline,
      titleEn: card.titleEn,
      accent: card.accent,
      bgKey,
      bgSrc: resolveMobileMainTileBgSrc(bgKey),
    }
  })

  return (
    <div className={`space-y-7 pb-8 pt-3 ${SITE_CONTENT_CLASS}`}>
      <section
        aria-label="메인 소개"
        className="rounded-2xl border border-bt-border-soft/80 bg-gradient-to-b from-bt-bg-lavender-soft via-white to-bt-bg-lavender/50 px-4 py-5 shadow-sm ring-1 ring-bt-bg-lavender/30"
      >
        <h1 className="text-center text-lg font-semibold leading-snug tracking-tight text-bt-text-navy sm:text-xl">
          {MAIN_HERO_MAIN_COPY}
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-bt-text-muted-lavender sm:text-[0.9375rem]">
          {MAIN_HERO_SUB_COPY}
        </p>
        <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
          <Link
            href={MAIN_HERO_CTA_PRIMARY_HREF}
            className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center rounded-full bg-bt-text-navy px-4 py-2.5 text-center text-sm font-medium text-white transition hover:opacity-95 active:scale-[0.99] sm:flex-none sm:px-5"
          >
            {MAIN_HERO_CTA_PRIMARY_LABEL}
          </Link>
          <Link
            href={MAIN_HERO_CTA_SECONDARY_HREF}
            className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center rounded-full border border-bt-bg-lavender bg-white px-4 py-2.5 text-center text-sm font-medium text-bt-text-navy shadow-sm transition hover:bg-bt-bg-lavender-soft active:scale-[0.99] sm:flex-none sm:px-5"
          >
            {MAIN_HERO_CTA_SECONDARY_LABEL}
          </Link>
        </div>
      </section>

      <section aria-label={MAIN_HUB_FOUR_SECTION_TITLE}>
        <h2 className={MOBILE_HUB_FOUR_SECTION_H2_CLASS}>{MAIN_HUB_FOUR_SECTION_TITLE}</h2>
        <ul className="grid grid-cols-2 gap-3.5" role="list">
          {mainTiles.map((t, index) => (
            <li key={t.key} className="min-w-0">
              <Link
                href={t.href}
                prefetch={t.href !== '/travel/overseas/private-trip'}
                className={`group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-2xl shadow-sm ring-0 ring-transparent ${hubFourAccentCardSurfaceClass(t.accent)} ${HUB_FOUR_V5_HOVER_RING_CLASS}`}
              >
                <div className="relative z-[2] flex flex-1 flex-col items-center justify-center px-3 pb-1 pt-4 text-center">
                  <p className="text-base font-bold tracking-tight text-bt-text-navy sm:text-lg">{t.title}</p>
                  <p className="mt-1.5 max-w-[13rem] text-xs font-semibold leading-snug text-bt-text-muted-lavender sm:text-sm">
                    {t.desc}
                  </p>
                  <p className="mt-1 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-bt-text-navy/50 [font-family:var(--font-hub-outfit),ui-sans-serif,system-ui,sans-serif]">
                    {t.titleEn}
                  </p>
                </div>
                <div className="relative z-[1] mt-auto h-[3.75rem] w-full shrink-0 overflow-hidden rounded-b-2xl">
                  {t.bgSrc ? (
                    <>
                      <span className="pointer-events-none absolute inset-0 z-[0] bg-black/[0.04]" aria-hidden />
                      <SafeImage
                        src={t.bgSrc}
                        alt=""
                        fill
                        sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 25vw"
                        quality={index === 0 ? 80 : 75}
                        className={`object-cover opacity-[0.4] saturate-[0.88] transition duration-300 ease-out group-hover:opacity-[0.5] ${hubImagePositionForTile(t.accent)}`}
                        priority={index === 0}
                        loading={index === 0 ? undefined : 'lazy'}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/[0.1] via-transparent to-[color-mix(in_srgb,var(--bt-bg-lavender-soft)_50%,transparent)]"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <span
                      className="block h-full w-full bg-gradient-to-br from-bt-bg-lavender-soft/80 to-bt-text-navy/10"
                      aria-hidden
                    />
                  )}
                </div>
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
        <h2 className={MOBILE_HUB_FOUR_SECTION_H2_CLASS}>실무 요청</h2>
        <div className="flex w-full flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center">
          {QUICK_ACTIONS.map((a) =>
            a.primary ? (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-bt-text-navy px-5 py-3.5 text-center text-base font-bold text-white shadow-md ring-2 ring-bt-text-navy/20 transition hover:opacity-95 active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
              >
                {a.label}
              </Link>
            ) : (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl border-2 border-bt-bg-lavender bg-bt-bg-lavender-soft px-5 py-3.5 text-center text-base font-bold text-bt-text-navy shadow-sm transition hover:border-bt-text-navy/25 hover:bg-white active:scale-[0.99] sm:w-auto sm:min-w-[9.5rem]"
              >
                {a.label}
              </Link>
            )
          )}
        </div>
      </section>

      <div className="border-t border-bt-border-soft/90 pt-7">
        <PartnerOrganizationsSectionGate />
      </div>
    </div>
  )
}
