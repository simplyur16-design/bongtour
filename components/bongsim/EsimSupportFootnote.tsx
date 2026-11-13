import { USIMSA_CX_CONTACT_URL, USIMSA_CX_KAKAO_CHAT_URL } from '@/lib/bongsim/constants'

type Props = {
  className?: string
}

/** eSIM 결제·결과·체크아웃 하단. 고객센터는 유심사 공식 문의만 연다. */
export function EsimSupportFootnote({ className }: Props) {
  return (
    <div className={className}>
      <div className="space-y-2 text-center text-sm text-slate-400">
        <p className="font-medium text-slate-600">문제가 있으신가요?</p>
        <p className="text-xs leading-relaxed text-slate-500">설치·사용 문의는 고객센터로 연결됩니다.</p>
        <a
          href={USIMSA_CX_KAKAO_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-teal-600 underline hover:text-teal-700"
        >
          카카오톡 문의
        </a>
        <a
          href={USIMSA_CX_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-teal-700 underline hover:text-teal-800"
        >
          고객센터
        </a>
      </div>
    </div>
  )
}
