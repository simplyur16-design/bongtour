import {
  BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
  BONGSIM_ESIM_USIM_SUPPORT_COPY,
  BONGSIM_KAKAO_CHANNEL_URL,
} from '@/lib/bongsim/constants'

/** 봉심 체크아웃 푸터 전용 — 랜딩·다른 비즈 채널 URL과 분리 */
const BONGSIM_CHECKOUT_KAKAO_OPEN_CHAT_URL = 'https://open.kakao.com/o/s13CLdai'

type Props = {
  className?: string
  /** 체크아웃에서만 고정 오픈채팅 링크 사용 */
  useCheckoutOpenChat?: boolean
}

/** eSIM 결제·가이드·기기·체크아웃 하단 — 유심사 직링크 없음, 자사 카카오 URL 있을 때만 링크 노출 */
export function EsimSupportFootnote({ className, useCheckoutOpenChat }: Props) {
  const kakao = useCheckoutOpenChat
    ? BONGSIM_CHECKOUT_KAKAO_OPEN_CHAT_URL
    : BONGSIM_KAKAO_CHANNEL_URL.trim()
  return (
    <div className={className}>
      <div className="space-y-2 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-600">문제가 있으신가요?</p>
        <p className="text-xs leading-relaxed text-slate-500">{BONGSIM_ESIM_USIM_SUPPORT_COPY}</p>
        <p className="font-medium text-slate-600">{BONGSIM_ESIM_SUPPORT_EMAIL_LINE}</p>
        {kakao ? (
          <a
            href={kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-teal-600 underline hover:text-teal-700"
          >
            카카오톡 문의하기
          </a>
        ) : null}
      </div>
    </div>
  )
}
