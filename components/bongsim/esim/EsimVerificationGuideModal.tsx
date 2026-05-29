"use client";

import { EsimVerificationGuideContent } from "@/components/bongsim/esim/EsimVerificationGuideContent";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function EsimVerificationGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="esim-verification-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bt-bongsim-readable max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white text-slate-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="esim-verification-guide-title" className="text-base font-bold text-slate-900 lg:text-lg">
            여행자 인증 안내
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <EsimVerificationGuideContent />
        </div>
        <div className="border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white transition hover:bg-teal-800"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
