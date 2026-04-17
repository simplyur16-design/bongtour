'use client'

import Script from 'next/script'

/**
 * 네이버 톡톡 파트너센터 배너 스크립트.
 * `NEXT_PUBLIC_NAVER_TALKTALK_BANNER_ID` = 배너 관리에서 받은 `data-id` (숫자 문자열). 비우면 렌더하지 않음.
 * @see https://partner.talk.naver.com — 배너 소스 발급
 */
export default function NaverTalktalkPartnerBanner() {
  const bannerId = process.env.NEXT_PUBLIC_NAVER_TALKTALK_BANNER_ID?.trim()
  if (!bannerId) return null

  return (
    <div className="talk-banner-host flex justify-end" aria-label="네이버 톡톡 상담 배너">
      <div className="talk_banner_div" data-id={bannerId} />
      <Script src="https://partner.talk.naver.com/banners/script" strategy="lazyOnload" />
    </div>
  )
}
