import Script from 'next/script'

/**
 * Google Tag Manager — `NEXT_PUBLIC_GTM_ID` 가 있을 때만 로드.
 * 카카오 상담 등은 `dataLayer.push`로 이벤트만 쌓고, GTM이 없으면 태그는 실행되지 않음.
 * @see docs/GTM-KAKAO-COUNSEL-GA4.md
 */
export default function GoogleTagManager() {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim()
  if (!id) return null

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
