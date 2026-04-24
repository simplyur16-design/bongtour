"use client";

import type { EsimCoverageProduct, FunnelState, NetworkType } from "@/lib/bongsim/types";
import { getCountryById } from "@/lib/bongsim/mock-data";

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function formatYmdDots(ymd: string | null): string {
  if (!ymd) return "";
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  return `${p[0]}.${p[1]}.${p[2]}`;
}

function networkLabel(net: NetworkType): string {
  return net === "roaming" ? "로밍형" : "현지망형";
}

type Props = {
  open: boolean;
  funnel: FunnelState;
  selectedRow: EsimCoverageProduct;
  tripDays: number;
  tripNights: number;
  appliedNetwork: NetworkType;
  displayPriceKrw: number;
  onClose: () => void;
  onConfirm: () => void;
};

export function Step4PurchaseConfirmSheet({
  open,
  funnel,
  selectedRow,
  tripDays,
  tripNights,
  appliedNetwork,
  displayPriceKrw,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const dataLine =
    [selectedRow.subtitle, selectedRow.coverageSummaryKr].filter(Boolean).join(" · ") || "상품 안내 기준";

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="pointer-events-none relative flex min-h-full items-end justify-center sm:items-center sm:p-4">
        <div
          className="pointer-events-auto flex w-full max-w-lg justify-center sm:block"
          role="dialog"
          aria-modal="true"
          aria-labelledby="step4-confirm-title"
        >
          <div className="flex h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-16px_48px_rgba(0,0,0,0.22)] ring-1 ring-black/10 sm:h-[min(85vh,680px)] sm:rounded-3xl sm:shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">STEP 4</p>
                <h2
                  id="step4-confirm-title"
                  className="mt-1 break-words text-lg font-bold leading-snug text-slate-900 sm:text-xl"
                >
                  상세 보기 전에 확인해 주세요
                </h2>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
                  선택한 조건으로 이어갈 eSIM 요약이에요. 상세에서 요금제를 고른 뒤 결제로 넘어가요.
                </p>
              </div>
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

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-6 sm:py-5">
              <dl className="min-w-0 space-y-4 break-words text-[13px] leading-relaxed sm:text-[14px]">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">국가·지역</dt>
                  <dd className="mt-1.5 flex flex-wrap gap-2">
                    {funnel.countryIds.map((cid) => {
                      const c = getCountryById(cid);
                      if (!c) return null;
                      return (
                        <span
                          key={cid}
                          className="inline-flex items-center gap-1 rounded-full border border-teal-100 bg-teal-50/80 px-2.5 py-1 text-[12px] font-bold text-teal-950"
                        >
                          <span aria-hidden>{c.flag}</span>
                          {c.nameKr}
                        </span>
                      );
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">상품</dt>
                  <dd className="mt-1 font-bold text-slate-900">{selectedRow.title}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">이용 기간</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {formatYmdDots(funnel.tripStart)} ~ {formatYmdDots(funnel.tripEnd)}
                  </dd>
                  <dd className="mt-0.5 text-slate-700">
                    {tripDays}일 · {tripNights}박
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">데이터·요약</dt>
                  <dd className="mt-1 text-slate-800">{dataLine}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">네트워크 유형</dt>
                  <dd className="mt-1 font-bold text-teal-900">{networkLabel(appliedNetwork)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">수량</dt>
                  <dd className="mt-1 font-semibold text-slate-800">1</dd>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <dt className="text-[11px] font-bold text-slate-500">안내 금액</dt>
                  <dd className="mt-1 text-xl font-black tabular-nums text-slate-900">{formatKrw(displayPriceKrw)}</dd>
                  <dd className="mt-1 text-[11px] text-slate-500">비교 기준가 · 세금·수수료 별도</dd>
                </div>
              </dl>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:px-6 sm:pb-4">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-bold text-slate-800 transition hover:bg-slate-50 sm:flex-1"
              >
                비교로 돌아가기
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-700 text-[15px] font-bold text-white shadow-md transition hover:bg-teal-800 sm:flex-1"
              >
                상세 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
