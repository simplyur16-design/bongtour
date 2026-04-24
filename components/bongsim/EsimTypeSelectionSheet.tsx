"use client";

import type { EsimProductTypeOption, NetworkType } from "@/lib/bongsim/types";

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function displayLabel(o: EsimProductTypeOption): string {
  if (o.networkType === "roaming") return "로밍형";
  if (o.networkType === "local") return "현지망형";
  return o.label;
}

type Props = {
  open: boolean;
  options: EsimProductTypeOption[];
  pending: NetworkType | null;
  onPick: (t: NetworkType) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function EsimTypeSelectionSheet({ open, options, pending, onPick, onClose, onConfirm }: Props) {
  if (!open || options.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="취소"
      />
      <div className="pointer-events-none relative flex min-h-full items-end justify-center sm:items-center sm:p-6 lg:p-8">
        <div
          className="pointer-events-auto flex w-full max-w-lg justify-center sm:block sm:max-w-lg lg:max-w-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="esim-type-title"
        >
          <div className="flex h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-16px_48px_rgba(0,0,0,0.2)] ring-1 ring-black/10 sm:h-[min(80vh,560px)] sm:rounded-3xl sm:shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <h2
                id="esim-type-title"
                className="min-w-0 flex-1 break-words pr-2 text-lg font-bold leading-snug text-slate-900 sm:pr-6 sm:text-xl"
              >
                eSIM 종류를 선택해주세요.
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="닫기"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6">
              <div className="flex min-w-0 flex-col gap-3">
                {options.map((o) => {
                  const sel = pending === o.networkType;
                  const label = displayLabel(o);
                  return (
                    <button
                      key={o.networkType}
                      type="button"
                      onClick={() => onPick(o.networkType)}
                      className={`rounded-2xl border-2 px-4 py-4 text-left transition sm:min-h-[4.5rem] sm:px-5 sm:py-4 ${
                        sel
                          ? "border-teal-600 bg-teal-50/90 shadow-md ring-2 ring-teal-200/80"
                          : "border-slate-200 bg-white hover:border-teal-200"
                      }`}
                    >
                      <p className="text-lg font-bold text-slate-900">{label}</p>
                      {o.helperText ? (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 sm:text-sm">{o.helperText}</p>
                      ) : null}
                      {typeof o.startingPrice === "number" && Number.isFinite(o.startingPrice) ? (
                        <p className="mt-2 text-[13px] font-bold text-slate-800">비교 기준 {formatKrw(o.startingPrice)}부터</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-bold text-slate-800 transition hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!pending}
                onClick={onConfirm}
                className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-teal-700 text-[15px] font-bold text-white shadow-md transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
