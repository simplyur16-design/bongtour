import { BONGSIM_KAKAO_CHANNEL_URL } from "@/lib/bongsim/constants";
import { ESIM_VERIFICATION_GUIDE_HOURS } from "@/components/bongsim/esim/EsimVerificationGuideContent";

type Props = {
  /** 카카오 CTA 라벨 */
  kakaoLabel?: string;
  className?: string;
  /** true: 제목·보조 안내 포함 (기본), false: 버튼·보조만 */
  showHeading?: boolean;
};

/** eSIM 구매 전·가이드·혜택 등 — 봉투어 고객센터 CS 링크 */
export function EsimBongsimCsLinks({
  kakaoLabel = "카카오톡 문의하기",
  className = "mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center",
  showHeading = true,
}: Props) {
  const kakao = BONGSIM_KAKAO_CHANNEL_URL.trim();

  return (
    <div className={className}>
      {showHeading ? (
        <p className="w-full text-sm font-semibold text-slate-800">
          봉투어 고객센터 ({ESIM_VERIFICATION_GUIDE_HOURS})
        </p>
      ) : null}
      {kakao ? (
        <a
          href={kakao}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#f5dc00]"
        >
          {kakaoLabel}
        </a>
      ) : null}
      <p className="w-full text-xs leading-relaxed text-slate-500 sm:text-sm">
        긴급·시간 외 불편사항은 마이페이지 → eSIM 구매내역 → 고객지원센터 이용
      </p>
    </div>
  );
}
