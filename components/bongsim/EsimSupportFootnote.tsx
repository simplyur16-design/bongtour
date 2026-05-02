'use client'

import {
  BONGSIM_ESIM_SUPPORT_EMAIL_LINE,
  BONGSIM_ESIM_USIM_SUPPORT_COPY,
  BONGSIM_KAKAO_CHANNEL_URL,
} from '@/lib/bongsim/constants'

type Props = {
  className?: string
}

/** eSIM 결제·가이드·기기·체크아웃 하단 — 유심사 직링크 없음, 자사 카카오 URL 있을 때만 링크 노출 */
export function EsimSupportFootnote({ className }: Props) {
  const kakao = BONGSIM_KAKAO_CHANNEL_URL.trim()
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
