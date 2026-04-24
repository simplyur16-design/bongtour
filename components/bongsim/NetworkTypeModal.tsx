"use client";

import type { NetworkType } from "@/lib/bongsim/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (t: NetworkType) => void;
};

export const NETWORK_OPTIONS: { id: NetworkType; title: string; desc: string }[] = [
  {
    id: "roaming",
    title: "로밍형",
    desc: "한국에서 익숙한 통신사 흐름에 가깝게, 해외에서 데이터를 쓰는 방식이에요.",
  },
  {
    id: "local",
    title: "현지망형",
    desc: "현지 네트워크에 붙는 타입으로, 체감 속도와 안정성을 중시할 때 좋아요.",
  },
];

export function NetworkTypeModal({ open, onClose, onSelect }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="net-modal-title"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id="net-modal-title" className="text-lg font-bold text-slate-900">
            네트워크 타입
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
          여행 스타일에 맞는 방식을 골라주세요.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {NETWORK_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o.id)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-400 hover:bg-teal-50/60"
            >
              <div className="font-semibold text-slate-900">{o.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
