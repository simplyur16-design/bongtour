import { USIMSA_CX_CONTACT_URL, USIMSA_CX_KAKAO_CHAT_URL } from "@/lib/bongsim/constants";

type Props = {
  className?: string;
};

/**
 * eSIM 설치·사용 고객지원 링크.
 * 링크 대상은 유심사 CX이지만, 손님 노출 문구에는 공급사명을 쓰지 않는다.
 */
export function EsimMypageUsimsaCsLinks({ className = "" }: Props) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-800">eSIM 설치·사용 문의 (24시간)</p>
      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <a
          href={USIMSA_CX_KAKAO_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#f5dc00]"
        >
          카카오톡 문의
        </a>
        <a
          href={USIMSA_CX_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center text-sm font-medium text-teal-700 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-500"
        >
          고객센터
        </a>
      </div>
    </div>
  );
}
