import { USIMSA_CX_KAKAO_CHAT_URL } from "@/lib/bongsim/constants";
import { ESIM_GUIDE_CS_EMAIL } from "@/lib/bongsim/esim-guide-content";

type Props = {
  /** 카카오 CTA 라벨 — 기본: guide FAQ/note 와 동일 */
  kakaoLabel?: string;
  /** true면 "이메일 문의: {주소}" (guide), false면 주소만 링크 텍스트 (devices) */
  emailWithPrefix?: boolean;
  className?: string;
};

export function EsimUsimsaCsLinks({
  kakaoLabel = "카카오톡 상담하기",
  emailWithPrefix = true,
  className = "mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center",
}: Props) {
  return (
    <div className={className}>
      <a
        href={USIMSA_CX_KAKAO_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#f5dc00]"
      >
        {kakaoLabel}
      </a>
      <a
        href={`mailto:${ESIM_GUIDE_CS_EMAIL}`}
        className="inline-flex min-h-10 items-center text-sm font-medium text-teal-700 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-500"
      >
        {emailWithPrefix ? `이메일 문의: ${ESIM_GUIDE_CS_EMAIL}` : ESIM_GUIDE_CS_EMAIL}
      </a>
    </div>
  );
}
