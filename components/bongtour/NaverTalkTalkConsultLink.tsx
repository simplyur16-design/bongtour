import { KAKAO_CHANNEL_BTN_CLASS } from '@/components/bongtour/KakaoChannelConsultLink'
import { NAVER_TALK_CONSULT_LABEL, NAVER_TALK_PROFILE_URL } from '@/lib/main-hub-copy'

type Props = {
  className?: string
}

/** 카카오 채널 버튼과 같은 스타일. 터치 높이 44px. */
export default function NaverTalkTalkConsultLink({ className = '' }: Props) {
  return (
    <a
      href={NAVER_TALK_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={NAVER_TALK_CONSULT_LABEL}
      className={`${KAKAO_CHANNEL_BTN_CLASS} min-h-11 ${className}`.trim()}
    >
      {NAVER_TALK_CONSULT_LABEL}
    </a>
  )
}
