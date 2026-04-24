"use client";

type Props = {
  className?: string;
  onClick?: () => void;
};

export function GiftForeignFriendEntry({ className = "", onClick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      className={`w-full rounded-2xl border-2 border-dashed border-violet-300/90 bg-gradient-to-br from-violet-50 via-white to-sky-50 px-4 py-4 text-left shadow-sm ring-1 ring-violet-100/80 transition hover:border-violet-400 active:scale-[0.99] sm:px-5 sm:py-5 ${className}`}
      aria-label="외국인 친구에게 eSIM 선물하기"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-violet-100" aria-hidden>
          🎁
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700/90">대한민국 출발 · 선물 전용</p>
          <p className="mt-1 text-[15px] font-bold leading-snug text-violet-950 sm:text-[16px]">외국인 친구에게 eSIM 선물하기</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">여행 목적지 선택과는 따로 준비 중인 메뉴예요.</p>
        </div>
      </div>
    </button>
  );
}
