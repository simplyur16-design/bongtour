"use client";

import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 로그인 성공 후 이동 경로 */
  callbackUrl?: string;
};

export function EsimLoginRequiredModal({ open, onClose, callbackUrl = "/mypage/esim" }: Props) {
  if (!open) return null;

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="esim-login-required-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-t-2xl bg-white text-slate-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="esim-login-required-title" className="text-base font-bold text-slate-900">
            로그인 후 확인
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
        <p className="px-5 py-4 text-sm leading-relaxed text-slate-600">
          데이터 사용량은 로그인 후 마이페이지 <span className="font-medium text-slate-800">내 eSIM</span>에서 확인할 수
          있습니다.
        </p>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={signInHref}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white transition hover:bg-teal-800"
          >
            로그인하기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-10 w-full items-center justify-center rounded-xl text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
