import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Noto_Sans_KR, Outfit } from 'next/font/google'
import './globals.css'
import SessionProvider from './components/providers/SessionProvider'
import ChunkLoadRecovery from './components/ChunkLoadRecovery'
import AntiCopyProtectionGate from './components/AntiCopyProtectionGate'
import ConditionalSiteFooter from './components/ConditionalSiteFooter'
import GoogleTagManager from './components/GoogleTagManager'

const BongtourSplash = dynamic(
  () => import('@/components/bongtour/BongtourSplash').then((m) => ({ default: m.BongtourSplash })),
  { ssr: false },
)
import { DEFAULT_OG_IMAGE_PATH, getSiteOrigin, SITE_NAME } from '@/lib/site-metadata'

const siteOrigin = getSiteOrigin()

export const metadata: Metadata = {
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
    images: [{ url: DEFAULT_OG_IMAGE_PATH, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | BongTour`,
    description: '해외·국내 여행 상품 안내와 예약·상담을 제공합니다.',
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
  },
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} ${hubOutfit.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-beige antialiased font-sans flex flex-col">
        <BongtourSplash />
        <ChunkLoadRecovery />
        <AntiCopyProtectionGate />
        <GoogleTagManager />
        <SessionProvider>
          <div className="flex-1 flex flex-col">{children}</div>
          <ConditionalSiteFooter />
        </SessionProvider>
      </body>
    </html>
  )
}
