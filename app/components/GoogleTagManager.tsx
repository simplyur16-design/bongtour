'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

/**
 * Google Tag Manager — `NEXT_PUBLIC_GTM_ID` 가 있을 때만 로드.
 * 클라이언트 마운트 후에만 삽입해 SSR `<script>` vs Suspense hydration 불일치 방지.
 * @see docs/GTM-KAKAO-COUNSEL-GA4.md
 */
export default function GoogleTagManager() {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!id || !mounted) return null

  return (
    <>
      <Script id="gtm-base" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`}
      </Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${id}`}
          height={0}
          width={0}
          title="Google Tag Manager"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  )
}
