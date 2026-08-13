import type { Metadata } from 'next'
import { Noto_Sans_KR, Outfit } from 'next/font/google'
import './globals.css'
import SessionProvider from './components/providers/SessionProvider'
import ChunkLoadRecovery from './components/ChunkLoadRecovery'
import BongtourRootShell from './components/BongtourRootShell'
import { getSeasonalDefaultOgImagePath } from '@/lib/og-image-seasonal'
import { getSiteOrigin, SITE_NAME } from '@/lib/site-metadata'

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
    description: '해외 여행 상품 안내와 예약·상담을 제공합니다.',
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: SITE_NAME,
      title: `${SITE_NAME} | BongTour`,
      description: '해외 여행 상품 안내와 예약·상담을 제공합니다.',
      url: '/',
      images: [{ url: defaultOgImagePath, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} | BongTour`,
      description: '해외 여행 상품 안내와 예약·상담을 제공합니다.',
      images: [defaultOgImagePath],
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: {
      other: {
        'naver-site-verification': 'ae6ce863b7e961b590c7ca31eddd12ba245ebfaa',
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

/**
 * REGRESSION-FREEZE[layout-drop-root-auth]: no server auth() on every page — manifest
 * REGRESSION-FREEZE[simplyur-surface-layout-p2]: simplyur 경량 셸 — path 분기(headers 없음) — manifest
 * REGRESSION-FREEZE[layout-no-headers-isr]: root layout headers() 제거로 ISR/CDN — manifest
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // simplyur first-paint: path로 lang/surface/body 보정 (headers() 없이 ISR 유지)
  // REGRESSION-FREEZE[simplyur-locale-lang-boot]: lang from /simplyur/{locale} (not always en) — manifest
  const simplyurBoot = `(function(){try{var p=location.pathname||'/';if(p==='/simplyur'||p.indexOf('/simplyur/')===0){var d=document.documentElement;var loc=(p.split('/')[2]||'en');var allow={en:1,ja:1,zh:1,'zh-TW':1,vi:1};d.lang=allow[loc]?loc:'en';d.dataset.surface='simplyur';document.body.className='min-h-screen antialiased flex flex-col';}}catch(e){}})();`

  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${hubOutfit.variable}`}
      data-surface="bongtour"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-beige antialiased font-sans flex flex-col pb-20 lg:pb-0">
        <script dangerouslySetInnerHTML={{ __html: simplyurBoot }} />
        <ChunkLoadRecovery />
        <SessionProvider>
          <BongtourRootShell>{children}</BongtourRootShell>
        </SessionProvider>
      </body>
    </html>
  )
}
