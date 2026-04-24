"use client";

import {
  DEVICE_COMPATIBILITY_BRANDS,
  DEVICE_COMPATIBILITY_CAUTION,
  DEVICE_EID_HELP_LINES,
  DEVICE_EID_HELP_TITLE,
} from "@/lib/bongsim/device-compatibility";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DeviceCompatibilityModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:p-4 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="device-compat-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:h-[min(88dvh,720px)] sm:rounded-3xl lg:h-[min(90dvh,820px)] lg:max-w-2xl xl:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 lg:px-8 lg:pb-5 lg:pt-6">
          <h2 id="device-compat-title" className="text-xl font-bold leading-snug text-slate-900 lg:text-2xl">
            이용 가능 기기
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

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="rounded-2xl border-2 border-amber-300/80 bg-amber-50 px-4 py-3.5 text-[13px] font-medium leading-relaxed text-amber-950 lg:text-[14px]">
            {DEVICE_COMPATIBILITY_CAUTION}
          </div>

          <div className="mt-7 space-y-8 lg:mt-8">
            {DEVICE_COMPATIBILITY_BRANDS.map((b) => (
              <section key={b.brand} aria-labelledby={`device-brand-${b.brand}`}>
                <h3 id={`device-brand-${b.brand}`} className="border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-900 lg:text-base">
                  {b.brand}
                </h3>
                <div className="mt-4 space-y-4">
                  {b.series.map((s) => (
                    <div
                      key={`${b.brand}-${s.title}`}
                      className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-3 sm:px-4 sm:py-3.5"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.title}</p>
                      <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-slate-800">
                        {s.models.map((m) => (
                          <li key={m} className="flex gap-2 pl-0.5">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-600" aria-hidden />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5 lg:mt-10" aria-labelledby="device-eid-help">
            <h3 id="device-eid-help" className="text-sm font-bold text-slate-900 lg:text-[15px]">
              {DEVICE_EID_HELP_TITLE}
            </h3>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-slate-700">
              {DEVICE_EID_HELP_LINES.map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-600" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold text-slate-600">다이얼 코드 (대부분 안드로이드)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <kbd className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[15px] font-bold tracking-wider text-slate-900 shadow-sm">
                  *#06#
                </kbd>
                <span className="text-[12px] text-slate-600">발신 후 EID·IMEI 표시 여부 확인</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">iPhone은 설정 → 일반 → 정보 등에서 EID를 확인하는 경우가 많아요.</p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-slate-600">
              EID가 보이면 이 단말에 eSIM 프로필을 등록할 수 있는 경우가 많다는 뜻이에요. 최종 개통은 통신사·단말 정책을 따릅니다.
            </p>
          </section>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-8">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-700 text-[15px] font-bold text-white transition hover:bg-teal-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
