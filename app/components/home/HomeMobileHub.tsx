import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import SeasonCurationCarouselClient from '@/app/components/home/SeasonCurationCarouselClient'
import MobileHomeClientErrorBoundary from '@/app/components/home/MobileHomeClientErrorBoundary'
import HomeHubPhotoPlaceholder from '@/app/components/home/HomeHubPhotoPlaceholder'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { MAIN_HUB_FOUR_CARDS, type HubFourCardKey } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import type { MobileMainServiceTileKey } from '@/lib/home-hub-resolve-images'
import { resolveMobileMainTileBgSrc } from '@/lib/home-mobile-hub-tile-images'
import { hubPhotoCardIsPending } from '@/lib/home-hub-photo-card-pending'
import { getHubFourPhotosBundle } from '@/lib/home-hub-four-photo-bundle'
import { HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS } from '@/lib/home-hub-four-accent-classes'
import { getCachedSeasonCurationNextTwoMonthsSlides } from '@/lib/season-curation-content'
import { getCachedSeasonLinkedProductItemsForMobile } from '@/lib/season-linked-products-mobile-data'
import { normalizeHomeSeasonSlidesForClient } from '@/lib/home-season-pick-shared'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

/** PC 시즌·4카드 — 메모리 #27 밝은 톤 */
const MOBILE_HUB_PHOTO_FILTER =
  'transition-[filter] duration-200 ease-out [filter:brightness(0.92)_saturate(1.08)] group-hover:[filter:brightness(1.0)_saturate(1.15)]'

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

const QUICK_ACTIONS = [
  { href: INQUIRY_TRAVEL, label: '상담접수', primary: true as const },
  { href: '/air-ticketing', label: '항공권', primary: false as const },
  { href: '/charter-bus', label: '전세버스', primary: false as const },
] as const

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 주요 서비스(사진 카드) / 시즌 큐레이션(+1·+2월) / 연결 상품 / 실무 요청.
 */
export default async function HomeMobileHub() {
  const [seasonRaw, linkedItems] = await Promise.all([
    getCachedSeasonCurationNextTwoMonthsSlides(),
    getCachedSeasonLinkedProductItemsForMobile(),
  ])
  const seasonSlides = normalizeHomeSeasonSlidesForClient(seasonRaw)

  const bundle = await getHubFourPhotosBundle()
  const mainTiles = MAIN_HUB_FOUR_CARDS.map((card) => {
    const bgKey = hubFourCardKeyToMobileTileKey(card.key)
    const fromBundle = (bundle[card.key] ?? '').trim()
    const mobileDefault = resolveMobileMainTileBgSrc(bgKey)
    const fallbackStatic = (card.imageSrc ?? '').trim()
    const resolved =
      fromBundle || (mobileDefault ?? '').trim() || fallbackStatic || ''
    const bgSrc = resolved.length > 0 ? resolved : null
    const imagePending = hubPhotoCardIsPending(bgSrc)
    return {
      href: card.href,
      title: card.categoryLabel,
      desc: card.headline,
      bgSrc,
      imagePending,
    }
  })

  return (
    <div className={`space-y-7 pb-8 pt-3 ${SITE_CONTENT_CLASS}`}>
      <section aria-label="주요 서비스">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>주요 서비스</h2>
        <ul className="grid grid-cols-2 gap-3.5" role="list">
          {mainTiles.map((t, index) => {
            const aria = [t.title, t.desc, '바로가기'].filter(Boolean).join('. ')
            return (
              <li key={t.href} className="min-w-0">
                <Link
                  href={t.href}
                  prefetch={t.href !== '/travel/overseas/private-trip'}
                  aria-label={aria}
                  className={`group relative flex min-h-[11.5rem] flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-sm active:scale-[0.99] ${HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS}`}
                >
                  {t.imagePending ? (
                    <HomeHubPhotoPlaceholder />
                  ) : (
                    <>
                      <div className="absolute inset-0 z-[1] overflow-hidden rounded-2xl">
                        <div className={`absolute inset-0 z-0 ${MOBILE_HUB_PHOTO_FILTER}`}>
                          <SafeImage
                            src={t.bgSrc!}
                            alt=""
                            fill
                            sizes="(max-width:768px) 100vw, (max-width:1024px) 50vw, 25vw"
                            quality={index === 0 ? 80 : 75}
                            className="object-cover object-center"
                            priority={index === 0}
                            loading={index === 0 ? undefined : 'lazy'}
                          />
                        </div>
                      </div>
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-2/3 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
                        aria-hidden
                      />
                    </>
                  )}
                  <div className="relative z-[3] flex flex-1 flex-col items-center justify-center px-3 py-6 text-center">
                    <p className="text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-[28px]">
                      {t.title}
                    </p>
                    <p className="mt-2 max-w-[18ch] text-sm leading-snug text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                      {t.desc}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {seasonSlides.length > 0 ? (
        <MobileHomeClientErrorBoundary section="season-curation">
          <SeasonCurationCarouselClient slides={seasonSlides} variant="mobile" />
        </MobileHomeClientErrorBoundary>
      ) : null}

      {linkedItems.length > 0 ? (
        <section aria-label="시즌 연결 상품">
          <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>시즌에서 이어지는 일정</h2>
          <ProductResultCardsClient items={linkedItems} layout="scroll" />
        </section>
      ) : null}

      <section aria-label="실무 요청">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>실무 요청</h2>
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
            ),
          )}
        </div>
      </section>
    </div>
  )
}
