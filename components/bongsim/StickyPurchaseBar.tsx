"use client";

import Link from "next/link";

type Props = {
  priceKrw: number;
  priceCaption?: string;
  primaryHref?: string;
  primaryLabel: string;
  onPrimaryClick?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
  /** split: 가격 + 버튼 나란히 · stacked-cta: 세로 전폭 구매 버튼 */
  variant?: "split" | "stacked-cta";
  /** true면 lg 이상 뷰포트에서 고정 바를 렌더하지 않음(데스크톱 전용 패널과 중복 방지) */
  hideFromLarge?: boolean;
};

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

export function StickyPurchaseBar({
  priceKrw,
  priceCaption = "금액",
  primaryHref,
  primaryLabel,
  onPrimaryClick,
  secondaryHref,
  secondaryLabel,
  variant = "split",
  hideFromLarge = false,
}: Props) {
  const primaryBtnClass =
    variant === "stacked-cta"
      ? "inline-flex min-h-[3.35rem] w-full items-center justify-center rounded-2xl bg-teal-700 px-5 text-[16px] font-bold text-white shadow-[0_10px_36px_-8px_rgba(15,118,110,0.45)] transition hover:bg-teal-800 active:scale-[0.99]"
      : "inline-flex min-h-12 min-w-[8rem] items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-md transition hover:bg-teal-800";

  const dockClass = hideFromLarge ? "lg:hidden" : "";

  if (variant === "stacked-cta") {
    return (
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-slate-200/90 bg-gradient-to-t from-slate-100/98 via-white/95 to-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-white/85 ${dockClass}`}
      >
        <div className="pointer-events-auto w-full max-w-lg sm:max-w-xl md:max-w-2xl">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-500">{priceCaption}</p>
            <p className="text-xl font-black tabular-nums tracking-tight text-slate-900">{formatKrw(priceKrw)}</p>
          </div>
          {onPrimaryClick ? (
            <button type="button" onClick={onPrimaryClick} className={primaryBtnClass}>
              {primaryLabel}
            </button>
          ) : primaryHref ? (
            <Link href={primaryHref} className={primaryBtnClass}>
              {primaryLabel}
            </Link>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="mt-3 block text-center text-[13px] font-semibold text-slate-600 underline-offset-2 hover:text-teal-800 hover:underline"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4 ${dockClass}`}
    >
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[0_-4px_24px_rgba(15,23,42,0.12)] backdrop-blur-md sm:max-w-2xl">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{priceCaption}</p>
          <p className="truncate text-lg font-bold tracking-tight text-slate-900">{formatKrw(priceKrw)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-3.5 sm:text-sm"
            >
              {secondaryLabel}
            </Link>
          ) : null}
          {onPrimaryClick ? (
            <button type="button" onClick={onPrimaryClick} className={primaryBtnClass}>
              {primaryLabel}
            </button>
          ) : primaryHref ? (
            <Link href={primaryHref} className={primaryBtnClass}>
              {primaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
