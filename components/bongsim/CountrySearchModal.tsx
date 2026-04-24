"use client";

import { useMemo, useState } from "react";
import { CountryPickerGrid } from "@/components/bongsim/CountryPickerGrid";
import { filterCountryOptions } from "@/lib/bongsim/country-options";
import { MOCK_COUNTRIES } from "@/lib/bongsim/mock-data";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (code: string) => void;
};

export function CountrySearchModal({ open, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => filterCountryOptions(MOCK_COUNTRIES, q), [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="country-modal-title"
    >
      <div className="flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:max-h-[88vh] sm:rounded-3xl">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="country-modal-title" className="text-lg font-bold text-slate-900">
                국가 선택
              </h2>
              <p className="mt-1 text-sm text-slate-500">여행할 국가를 선택해 주세요.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="닫기"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <label className="relative mt-4 block">
            <span className="sr-only">국가 검색</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="도시, 국가명 검색"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/25"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>
          ) : (
            <CountryPickerGrid
              countries={filtered}
              selectedCode={null}
              onSelect={(code) => {
                if (code === "kr") return;
                onSelect(code);
                setQ("");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
