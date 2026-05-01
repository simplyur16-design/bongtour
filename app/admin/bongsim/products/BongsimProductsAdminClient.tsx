"use client";

import { useCallback, useEffect, useState } from "react";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";

type ProductRow = {
  option_api_id: string;
  plan_name: string;
  days_raw: string;
  allowance_label: string;
  network_type: string;
  qos_raw: string | null;
  recommended_krw: string | null;
  supply_krw: string | null;
  is_active: boolean;
};

function nfKrw(raw: string | null): string {
  if (raw == null || raw === "") return "—";
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v)) return raw;
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

export default function BongsimProductsAdminClient() {
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      if (country.trim()) q.set("country", country.trim().toUpperCase());
      const res = await fetch(`/api/admin/bongsim/products?${q.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as {
        products?: ProductRow[];
        total_pages?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "목록을 불러오지 못했습니다.");
      setRows(j.products ?? []);
      setTotalPages(Math.max(1, j.total_pages ?? 1));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  }, [page, country]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (optionApiId: string, next: boolean) => {
    setBusyId(optionApiId);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/admin/bongsim/products/${encodeURIComponent(optionApiId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "변경 실패");
      await load();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="text-slate-100">
      <h1 className="text-2xl font-bold text-slate-100">eSIM 상품 관리</h1>
      <p className="mt-2 text-sm text-slate-400">가격은 엑셀 임포트로만 반영합니다. 노출 여부(is_active)만 여기서 변경합니다.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">국가 필터</span>
          <select
            value={country}
            onChange={(ev) => {
              setCountry(ev.target.value);
              setPage(1);
            }}
            className="mt-1 block min-w-[180px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">전체</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code.toUpperCase()}>
                {c.nameKr} ({c.code.toUpperCase()})
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadErr ? <p className="mt-4 text-sm text-red-400">{loadErr}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
        <table className="min-w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-[10px] uppercase text-slate-400 sm:text-xs">
              <th className="px-2 py-2 sm:px-3 sm:py-3">option_api_id</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">plan_name</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">days</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">allowance</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">권장가</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">공급가</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">망</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">qos</th>
              <th className="px-2 py-2 sm:px-3 sm:py-3">노출</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.option_api_id} className="border-b border-slate-800">
                <td className="max-w-[140px] truncate px-2 py-2 font-mono text-[11px] text-teal-200 sm:px-3" title={r.option_api_id}>
                  {r.option_api_id}
                </td>
                <td className="max-w-[160px] truncate px-2 py-2 sm:max-w-[220px] sm:px-3" title={r.plan_name}>
                  {r.plan_name}
                </td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">{r.days_raw}</td>
                <td className="max-w-[120px] truncate px-2 py-2 sm:px-3" title={r.allowance_label}>
                  {r.allowance_label}
                </td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">{nfKrw(r.recommended_krw)}</td>
                <td className="whitespace-nowrap px-2 py-2 sm:px-3">{nfKrw(r.supply_krw)}</td>
                <td className="px-2 py-2 sm:px-3">{r.network_type}</td>
                <td className="max-w-[100px] truncate px-2 py-2 sm:px-3" title={r.qos_raw ?? ""}>
                  {r.qos_raw ?? "—"}
                </td>
                <td className="px-2 py-2 sm:px-3">
                  <button
                    type="button"
                    disabled={busyId === r.option_api_id}
                    onClick={() => void toggle(r.option_api_id, !r.is_active)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      r.is_active ? "bg-emerald-700 text-white hover:bg-emerald-600" : "bg-slate-600 text-slate-200 hover:bg-slate-500"
                    } disabled:opacity-50`}
                  >
                    {r.is_active ? "ON" : "OFF"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  상품이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400">
        <button
          type="button"
          disabled={page <= 1}
          className="rounded-lg border border-slate-600 px-3 py-1.5 disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-600 px-3 py-1.5 disabled:opacity-40"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}
