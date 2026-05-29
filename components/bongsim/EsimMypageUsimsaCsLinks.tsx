import { USIMSA_CX_CONTACT_URL, USIMSA_CX_KAKAO_CHAT_URL } from "@/lib/bongsim/constants";

type Props = {
  className?: string;
};

/** 마이페이지 eSIM 구매내역 전용 — 유심사 CX (설치·사용 24시간) */
export function EsimMypageUsimsaCsLinks({ className = "" }: Props) {
  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-800">
        주문별 eSIM 설치·사용 문의 (유심사 CX, eSIM 전문 파트너)
      </p>
      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <a
          href={USIMSA_CX_KAKAO_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#f5dc00]"
        >
          유심사 카카오톡 문의
        </a>
        <a
          href={USIMSA_CX_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center text-sm font-medium text-teal-700 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-500"
        >
          유심사 고객센터 페이지
        </a>
      </div>
    </div>
  );
}
