import { USIMSA_CX_CONTACT_URL } from "@/lib/bongsim/constants";

type Props = {
  className?: string;
  /** true: 제목 포함 (기본), false: 버튼만 */
  showHeading?: boolean;
};

/** eSIM 설치 문의 — 링크는 유심사 고객센터 페이지만 (11/14 00:16) */
export function EsimMypageUsimsaCsLinks({
  className = "",
  showHeading = true,
}: Props) {
  return (
    <div className={className}>
      {showHeading ? <p className="text-sm font-semibold text-slate-800">고객센터</p> : null}
      <div
        className={
          showHeading
            ? "mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
            : "flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        }
      >
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
