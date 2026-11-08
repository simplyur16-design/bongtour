import { kakaoConsultHref } from '@/lib/kakao-consult-href'
import { KAKAO_OPEN_CHAT_URL } from '@/lib/kakao-open-chat'

export const KAKAO_CHANNEL_BTN_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E5D200] bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-[#3C1E1E] transition hover:bg-[#f5dc00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3C1E1E]/30'

type Props = {
  className?: string
  label?: string
  productCode?: string | null
  productTitle?: string | null
}

/** 카카오 채널 1:1 상담 — `NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL` (/chat) */
export default function KakaoChannelConsultLink({
  className = '',
  label = '카카오 채널 상담',
  productCode = null,
  productTitle = null,
}: Props) {
  return (
    <a
      href={kakaoConsultHref(KAKAO_OPEN_CHAT_URL, { productCode, productTitle })}
      target="_blank"
      rel="noopener noreferrer"
      className={`${KAKAO_CHANNEL_BTN_CLASS} ${className}`.trim()}
    >
      {label}
    </a>
  )
}
