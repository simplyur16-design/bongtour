"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  used_at: string;
  order_number: string;
  code: string;
  original_amount_krw: number;
  discount_amount_krw: number;
  final_amount_krw: number;
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
      const j = (await res.json()) as {
        rows?: Row[];
        summary?: { count: number; total_discount_krw: number; total_final_krw: number };
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "불러오기 실패");
      setRows(j.rows ?? []);
      setSummary(j.summary ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadCsv = () => {
    const header = ["날짜(UTC)", "주문번호", "쿠폰코드", "원가", "할인액", "결제액"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.used_at,
          r.order_number,
          r.code,
          r.original_amount_krw,
          r.discount_amount_krw,
          r.final_amount_krw,
        ].join(","),
      );
    }
    if (summary) {
      lines.push("");
      lines.push(`합계,건수,${summary.count},할인합,${summary.total_discount_krw},결제합,${summary.total_final_krw}`);
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bongsim-coupon-usage-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">쿠폰 사용 리포트</h1>
        <p className="mt-1 text-sm text-slate-400">월별 사용 내역과 합계입니다 (UTC 기준).</p>
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
          onClick={downloadCsv}
          disabled={!rows.length}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
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
              <th className="py-2 pr-3">쿠폰</th>
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
                <td className="py-2 pr-3">{r.code}</td>
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
