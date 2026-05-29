import { BONGSIM_KAKAO_CHANNEL_URL } from "@/lib/bongsim/constants";

export const ESIM_VERIFICATION_GUIDE_HOURS = "09:00-18:00 KST" as const;

const STEPS = [
  "결제 완료 후 ICCID 번호가 발급됩니다.",
  "CMLink 페이지에서 ICCID 끝 12자리로 신원 인증을 진행합니다 (1~2분 소요).",
  "인증 완료 후 eSIM이 활성화됩니다.",
] as const;

type Props = {
  className?: string;
};

/** 구매 전 여행자 인증 안내 — 박스·모달 공유 본문 */
export function EsimVerificationGuideContent({ className = "" }: Props) {
  const kakao = BONGSIM_KAKAO_CHANNEL_URL.trim();

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-900">여행자 인증이 필요한 eSIM 안내</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-slate-700 lg:text-sm">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-slate-600 lg:text-sm">
        인증은 중국·홍콩·마카오·대만 통신사 정책에 따른 필수 절차입니다. 자세한 문의는 봉투어 고객센터로
        연락 주세요.
      </p>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-800">봉투어 고객센터 ({ESIM_VERIFICATION_GUIDE_HOURS})</p>
        {kakao ? (
          <a
            href={kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-[#FEE500] px-4 py-2 text-xs font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#f5dc00] lg:text-sm"
          >
            카카오톡 문의하기
          </a>
        ) : (
          <p className="mt-1 text-xs text-slate-500">카카오 채널 링크는 고객센터 안내를 참고해 주세요.</p>
        )}
      </div>
    </div>
  );
}
