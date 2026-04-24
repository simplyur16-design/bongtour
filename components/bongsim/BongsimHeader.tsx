import Link from "next/link";
import { bongsimPath } from '@/lib/bongsim/constants'

type Props = {
  variant?: "default" | "hub";
};

export function BongsimHeader({ variant = "default" }: Props) {
  const hub = variant === "hub";

  return (
    <header
      className={`sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md ${hub ? "" : "shadow-sm shadow-slate-200/20"}`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-3 ${hub ? "px-4 py-2.5 sm:px-6 lg:px-10" : "px-4 py-3 sm:px-6 lg:px-10"}`}
      >
        <Link
          href={bongsimPath()}
          className={`shrink-0 font-bold tracking-tight text-teal-800 ${hub ? "text-[16px] leading-tight sm:text-[17px]" : "text-lg sm:text-xl"}`}
        >
          봉SIM
        </Link>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {!hub ? (
            <>
              <Link
                href={bongsimPath("/catalog")}
                className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-teal-900"
              >
                요금제
              </Link>
              <Link
                href={bongsimPath("/recommend")}
                className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-teal-900"
              >
                추천 받기
              </Link>
            </>
          ) : (
            <>
              <Link
                href={bongsimPath("/catalog")}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/80 hover:text-teal-900 sm:px-3 sm:py-2 sm:text-[13px]"
              >
                요금제
              </Link>
              <Link
                href={bongsimPath("/recommend")}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50/80 hover:text-teal-900 sm:px-3.5 sm:py-2 sm:text-[13px]"
              >
                시작하기
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
