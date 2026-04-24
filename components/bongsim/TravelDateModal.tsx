"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  initialStart: string | null;
  initialEnd: string | null;
  onConfirm: (range: { startDate: string; endDate: string }) => void;
};

export function TravelDateModal({
  open,
  onClose,
  initialStart,
  initialEnd,
  onConfirm,
}: Props) {
  const [start, setStart] = useState(initialStart ?? "");
  const [end, setEnd] = useState(initialEnd ?? "");

  if (!open) return null;

  const valid = start && end && end >= start;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-modal-title"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="date-modal-title" className="text-lg font-bold text-slate-900">
            여행 일정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          출국일과 귀국일을 선택해 주세요.
        </p>
        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">출발</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">귀국</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
            />
          </label>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              if (!valid) return;
              onConfirm({ startDate: start, endDate: end });
            }}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            일정 저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
