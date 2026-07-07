import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Noto_Sans_KR, Outfit } from 'next/font/google'
import './globals.css'
import SessionProvider from './components/providers/SessionProvider'
import UtmCaptureProvider from '@/components/UtmCaptureProvider'
import ChunkLoadRecovery from './components/ChunkLoadRecovery'
import AntiCopyProtectionGate from './components/AntiCopyProtectionGate'
import ConditionalSiteFooter from './components/ConditionalSiteFooter'
import GoogleTagManager from './components/GoogleTagManager'
import MobileStickyBar from './components/MobileStickyBar'
import AdminQuickActionsMount from '@/components/admin/AdminQuickActionsMount'
import BongtourPretendardStyles from './components/BongtourPretendardStyles'
import { getSeasonalDefaultOgImagePath } from '@/lib/og-image-seasonal'
import { getSiteOrigin, SITE_NAME } from '@/lib/site-metadata'
import { auth } from '@/auth'
import { SIMPLYUR_SURFACE_HEADER, SIMPLYUR_SURFACE_VALUE } from '@/lib/surface/simplyur-surface'

const siteOrigin = getSiteOrigin()

export async function generateMetadata(): Promise<Metadata> {
  const defaultOgImagePath = getSeasonalDefaultOgImagePath()
  return {
    metadataBase: new URL(siteOrigin),
    icons: {
      icon: [
        { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
        { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
    title: {
      default: `${SITE_NAME} | BongTour`,
      template: `%s | ${SITE_NAME}`,
    },
    description: '해외·국내 여행 상품 안내와 예약·상담을 제공합니다.',
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: `${SITE_NAME} | BongTour`,
      description: '해외·국내 여행 상품 안내와 예약·상담을 제공합니다.',
      url: '/',
      images: [{ url: defaultOgImagePath, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} | BongTour`,
      description: '해외·국내 여행 상품 안내와 예약·상담을 제공합니다.',
      images: [defaultOgImagePath],
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: {
      other: {
        'naver-site-verification': '3f9184c6e176330957acec29603387d07115e54d',
        'facebook-domain-verification': 'mcg3b915poi6zo8fcl33v2gedulj5p',
      },
    },
  }
}

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
  preload: true,
})

/** 메인 허브 4카드 영문 타이틀 등 — `HomeHubFourClientCard`에서 `var(--font-hub-outfit)` 로 사용 */
const hubOutfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-hub-outfit',
  display: 'swap',
  preload: false,
})

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const hdrs = await headers()
  const isSimplyur = hdrs.get(SIMPLYUR_SURFACE_HEADER) === SIMPLYUR_SURFACE_VALUE

  // REGRESSION-FREEZE[simplyur-surface-layout-p2]: simplyur 경량 루트 셸 — manifest
  const htmlClass = isSimplyur ? undefined : `${notoSansKr.variable} ${hubOutfit.variable}`
  const bodyClass = isSimplyur
    ? 'min-h-screen antialiased flex flex-col'
    : 'min-h-screen bg-beige antialiased font-sans flex flex-col pb-20 lg:pb-0'

  return (
    <html
      lang={isSimplyur ? 'en' : 'ko'}
      className={htmlClass}
      data-surface={isSimplyur ? 'simplyur' : 'bongtour'}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={bodyClass}>
        <ChunkLoadRecovery />
        {!isSimplyur ? <AntiCopyProtectionGate /> : null}
        {!isSimplyur ? <GoogleTagManager /> : null}
        {!isSimplyur ? <BongtourPretendardStyles /> : null}
        <SessionProvider session={session}>
          {isSimplyur ? (
            <div className="flex-1 flex flex-col">{children}</div>
          ) : (
            <UtmCaptureProvider>
              <div className="flex-1 flex flex-col">{children}</div>
              <ConditionalSiteFooter />
              <MobileStickyBar />
              <AdminQuickActionsMount />
            </UtmCaptureProvider>
          )}
        </SessionProvider>
      </body>
    </html>
  )
}
