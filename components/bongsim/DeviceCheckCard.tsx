"use client";

type Props = {
  onClick: () => void;
  /** `home`: lighter card for STEP 0 so the hero stays the visual focus. */
  variant?: "default" | "home";
};

export function DeviceCheckCard({ onClick, variant = "default" }: Props) {
  const home = variant === "home";

  if (home) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-100/80 transition hover:border-sky-200 hover:shadow-md active:scale-[0.99] sm:px-5 sm:py-4"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 sm:h-12 sm:w-12">
          <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900 sm:text-[15px]">이용 가능 기기</p>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-600">개통 전에 eSIM 지원 여부를 짧게 확인해요.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-bold text-white sm:px-3.5">
          확인하기
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-orange-50/80 px-4 py-3 text-left shadow-sm ring-1 ring-amber-100/80 transition hover:border-amber-300 active:scale-[0.99] sm:py-3.5 lg:px-5 lg:py-4"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/95">먼저 확인</p>
        <p className="mt-0.5 text-[14px] font-bold text-slate-900 sm:text-[15px]">이용 가능 기기</p>
        <p className="mt-0.5 text-[11px] text-amber-950/70">eSIM 지원 여부를 살펴보세요</p>
      </div>
      <span className="shrink-0 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200 sm:px-3 sm:text-xs">
        확인
      </span>
    </button>
  );
}
