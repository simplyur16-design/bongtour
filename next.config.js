const path = require('path')

/**
 * 프로덕션 전용 CSP. `next dev`에서는 NODE_ENV=development 이므로 적용되지 않아 HMR(ws)을 깨지 않는다.
 * GTM·Google Maps embed·원격 이미지(https) 등을 허용한다. (이미지 호스트는 Ncloud 등 — Supabase Storage 미사용)
 */
/** NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL hostname → next/image remotePatterns (custom CDN / endpoint). */
function remotePatternsFromNcloudPublicBase() {
  const raw = process.env.NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL?.trim()
  if (!raw) return []
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const protocol = u.protocol === 'http:' ? 'http' : 'https'
    if (!u.hostname) return []
    return [{ protocol, hostname: u.hostname, pathname: '/**' }]
  } catch {
    return []
  }
}

function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
    // globals.css @import Pretendard from jsDelivr — Chrome may enforce style-src-elem separately
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "frame-src 'self' https://www.googletagmanager.com https://www.google.com",
    // www / non-www 혼용 시 RSC·fetch가 'self'와 달라 connect-src 에서 막힘 — origin 통일 전까지 둘 다 허용
    // jsDelivr: Pretendard 등 @import 리소스의 .map 소스맵 fetch(connect) — style-src/font-src 와 별도
    "connect-src 'self' https://bongtour.com https://www.bongtour.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.google.com",
    "worker-src 'self' blob:",
  ]
  return directives.join('; ')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  experimental: {
    instrumentationHook: true,
    /** lucide named import 시 서버 vendor chunk 분절 완화(개발 중 ENOENT 완화에 도움) */
    optimizePackageImports: ['lucide-react'],
    // puppeteer-extra → merge-deep → clone-deep 동적 require로 webpack 정적 분석 실패 방지
    serverComponentsExternalPackages: [
      'puppeteer',
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
    ],
  },
  async headers() {
    const base = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]
    if (process.env.NODE_ENV === 'production') {
      base.push({ key: 'Content-Security-Policy', value: buildContentSecurityPolicy() })
    }
    return [
      {
        source: '/:path*',
        headers: base,
      },
    ]
  },
  images: {
    remotePatterns: (() => {
      const base = [
        { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
        { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
        { protocol: 'https', hostname: 'images.pexels.com', pathname: '/**' },
        /** Ncloud Object Storage 공개 객체 (path-style 등) */
        { protocol: 'https', hostname: 'kr.object.ncloudstorage.com', pathname: '/**' },
        { protocol: 'https', hostname: '**.object.ncloudstorage.com', pathname: '/**' },
      ]
      const seen = new Set(base.map((p) => `${p.protocol}://${p.hostname}`))
      for (const p of remotePatternsFromNcloudPublicBase()) {
        const k = `${p.protocol}://${p.hostname}`
        if (!seen.has(k)) {
          base.push(p)
          seen.add(k)
        }
      }
      return base
    })(),
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@google/generative-ai': path.resolve(__dirname, 'node_modules/@google/generative-ai/dist/index.js'),
        /**
         * Prisma `generator output = "../prisma-gen-runtime"` — TS paths만으로는 번들러가
         * `node_modules/@prisma/client`(구버전/스텁)를 잡는 경우가 있어 delegate 누락(undefined)이 난다.
         * 서버 번들에서 항상 생성 산출물을 쓰도록 고정.
         */
        '@prisma/client': path.resolve(__dirname, 'prisma-gen-runtime'),
      }
    }
    return config
  },
}

module.exports = nextConfig
