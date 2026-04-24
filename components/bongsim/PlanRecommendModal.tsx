"use client";

import type { MockPlan } from "@/lib/bongsim/types";

type Props = {
  open: boolean;
  onClose: () => void;
  plans: MockPlan[];
  onSelect: (planId: string) => void;
};

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

export function PlanRecommendModal({ open, onClose, plans, onSelect }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[85vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h2 id="plan-modal-title" className="text-lg font-bold text-slate-900">
              추천 플랜
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              일정과 네트워크에 맞춰 골라봤어요.
            </p>
          </div>
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
        <ul className="max-h-[70vh] overflow-y-auto px-3 py-3 sm:px-4">
          {plans.length === 0 ? (
            <li className="px-2 py-8 text-center text-sm text-slate-500">
              조건에 맞는 플랜이 없습니다. 국가나 네트워크를 다시 선택해 주세요.
            </li>
          ) : (
            plans.map((p) => (
              <li key={p.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-400 hover:bg-teal-50/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{p.nameKo}</div>
                      <p className="mt-1 text-sm text-slate-600">{p.dataSummaryKo}</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {p.highlightsKo.slice(0, 2).map((h) => (
                          <li
                            key={h}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-teal-800">
                        {formatKrw(p.priceKrw)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {p.validityDays}일권
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
