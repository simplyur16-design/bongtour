"use client";

import { readAdminResponseJson } from '@/lib/admin/read-admin-response-json'

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  used_at: string;
  order_number: string;
  code: string;
  description?: string | null;
  original_amount_krw: number;
  discount_amount_krw: number;
  final_amount_krw: number;
  source?: "coupon" | "complimentary_esim";
};

export default function CouponReportClient() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{ count: number; total_discount_krw: number; total_final_krw: number } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await fetch(`/api/admin/bongsim/coupon-report?${q.toString()}`, { cache: "no-store" });
      const j = await readAdminResponseJson<{
        rows?: Row[];
        summary?: { count: number; total_discount_krw: number; total_final_krw: number };
        error?: string;
        message?: string;
      }>(res);
      if (!res.ok) throw new Error(
        j.message ??
          (j.error === "query_failed" ? "리포트 조회에 실패했습니다." : j.error) ??
          "불러오기 실패",
      );
      setRows(j.rows ?? []);
      setSummary(j.summary ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = async () => {
    try {
      const q = new URLSearchParams({ year: String(year), month: String(month) });
      const res = await fetch(`/api/admin/bongsim/coupon-report/export?${q.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await readAdminResponseJson(res).catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "다운로드 실패");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bongsim-coupon-report-${year}-${String(month).padStart(2, "0")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "CSV 오류");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">할인·쿠폰 사용 리포트</h1>
        <p className="mt-1 text-sm text-slate-400">
          월별 쿠폰 사용과 관리자 무상 eSIM 발급(전액 할인) 내역·합계입니다 (UTC 기준).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="text-slate-400">연도</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10) || year)}
            className="mt-1 block w-28 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-400">월</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
        >
          조회
        </button>
        <button
          type="button"
          onClick={() => void downloadCsv()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          CSV 다운로드
        </button>
      </div>

      {err ? <div className="rounded-lg border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">{err}</div> : null}

      {summary ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
          <span className="font-semibold text-teal-300">합계</span> · 건수 {summary.count} · 총 할인{" "}
          {summary.total_discount_krw.toLocaleString("ko-KR")}원 · 총 결제 {summary.total_final_krw.toLocaleString("ko-KR")}원
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-2 pr-3">날짜</th>
              <th className="py-2 pr-3">주문번호</th>
              <th className="py-2 pr-3">쿠폰/유형</th>
              <th className="py-2 pr-3">설명</th>
              <th className="py-2 pr-3">원가</th>
              <th className="py-2 pr-3">할인</th>
              <th className="py-2">결제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.used_at}-${r.order_number}`} className="border-b border-slate-800">
                <td className="py-2 pr-3 font-mono text-xs">{r.used_at}</td>
                <td className="py-2 pr-3 font-mono">{r.order_number}</td>
                <td className="py-2 pr-3">
                  {r.code}
                  {r.source === "complimentary_esim" ? (
                    <span className="ml-1.5 rounded bg-violet-900/60 px-1.5 py-0.5 text-[10px] text-violet-200">
                      무상
                    </span>
                  ) : null}
                </td>
                <td className="max-w-[200px] truncate py-2 pr-3 text-slate-400" title={r.description ?? ""}>
                  {r.description?.trim() ? r.description : "—"}
                </td>
                <td className="py-2 pr-3">{r.original_amount_krw.toLocaleString("ko-KR")}</td>
                <td className="py-2 pr-3 text-amber-200">{r.discount_amount_krw.toLocaleString("ko-KR")}</td>
                <td className="py-2">{r.final_amount_krw.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">내역이 없습니다.</p> : null}
      </div>
    </div>
  );
}
