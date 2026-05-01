"use client";

import { useCallback, useEffect, useState } from "react";

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  grand_total_krw: string;
  buyer_email: string;
  created_at: string;
};

type DetailResponse = {
  order: Record<string, unknown>;
  lines: Record<string, unknown>[];
  payment_attempts: Record<string, unknown>[];
};

function nfKrw(n: string): string {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return n;
  return `${v.toLocaleString("ko-KR")}원`;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
    case "awaiting_payment":
      return "bg-slate-600 text-white";
    case "paid":
      return "bg-teal-600 text-white";
    case "delivered":
      return "bg-emerald-600 text-white";
    case "failed":
      return "bg-red-600 text-white";
    case "cancelled":
      return "bg-amber-500 text-slate-900";
    default:
      return "bg-slate-500 text-white";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "대기";
    case "awaiting_payment":
      return "결제대기";
    case "paid":
      return "결제완료";
    case "delivered":
      return "전달완료";
    case "failed":
      return "실패";
    case "cancelled":
      return "취소";
    default:
      return status;
  }
}

export default function BongsimPaymentsAdminClient() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("고객 요청 환불");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/admin/bongsim/payments?${q.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as {
        orders?: OrderRow[];
        total_pages?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "목록을 불러오지 못했습니다.");
      setRows(j.orders ?? []);
      setTotalPages(Math.max(1, j.total_pages ?? 1));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "오류");
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (orderId: string) => {
    setDetailId(orderId);
    setDetail(null);
    setDetailErr(null);
    setRefundErr(null);
    setRefundReason("고객 요청 환불");
    try {
      const res = await fetch(`/api/admin/bongsim/payments/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const j = (await res.json()) as DetailResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "상세를 불러오지 못했습니다.");
      setDetail(j);
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "오류");
    }
  };

  const submitRefund = async () => {
    if (!detail?.order) return;
    const oid = String(detail.order.order_id ?? "").trim();
    if (!oid) return;
    setRefundBusy(true);
    setRefundErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: oid, reason: refundReason.trim() || "고객 요청 환불" }),
      });
      const j = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(j.message ?? j.error ?? "환불 실패");
      setDetailId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setRefundErr(e instanceof Error ? e.message : "오류");
    } finally {
      setRefundBusy(false);
    }
  };

  return (
    <div className="text-slate-100">
      <h1 className="text-2xl font-bold text-slate-100">결제 내역</h1>
      <p className="mt-2 text-sm text-slate-400">bongsim_order 최근 주문 (페이지당 50건)</p>

      <form
        className="mt-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput);
        }}
      >
        <label className="block min-w-[200px] flex-1">
          <span className="text-xs font-medium text-slate-400">주문번호 또는 이메일</span>
          <input
            value={searchInput}
            onChange={(ev) => setSearchInput(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="검색…"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          검색
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setPage(1);
          }}
        >
          초기화
        </button>
      </form>

      {loadErr ? <p className="mt-4 text-sm text-red-400">{loadErr}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-xs uppercase text-slate-400">
              <th className="px-3 py-3">주문번호</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">결제금액</th>
              <th className="px-3 py-3">이메일</th>
              <th className="px-3 py-3">생성일</th>
              <th className="px-3 py-3">환불</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.order_id}
                className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/60"
                onClick={() => void openDetail(r.order_id)}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-teal-200">{r.order_number}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-200">{nfKrw(r.grand_total_krw)}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-300" title={r.buyer_email}>
                  {r.buyer_email}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {r.status === "paid" || r.status === "delivered" ? (
                    <button
                      type="button"
                      className="rounded-md bg-amber-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                      onClick={() => void openDetail(r.order_id)}
                    >
                      환불
                    </button>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  주문이 없습니다.
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

      {detailId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          onClick={() => {
            setDetailId(null);
            setDetail(null);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-white">주문 상세</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  setDetailId(null);
                  setDetail(null);
                }}
              >
                닫기
              </button>
            </div>
            {detailErr ? <p className="mt-4 text-sm text-red-400">{detailErr}</p> : null}
            {!detail && !detailErr ? <p className="mt-4 text-sm text-slate-400">불러오는 중…</p> : null}
            {detail ? (
              <div className="mt-4 space-y-6 text-sm text-slate-200">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(detail.order).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-950/80 px-3 py-2">
                      <dt className="text-xs text-slate-500">{k}</dt>
                      <dd className="mt-0.5 break-all text-xs text-slate-200">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="font-semibold text-teal-300">주문 라인</h3>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-2 py-2">option_api_id</th>
                          <th className="px-2 py-2">수량</th>
                          <th className="px-2 py-2">라인합계</th>
                          <th className="px-2 py-2">과금기준</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((l) => (
                          <tr key={String(l.line_id)} className="border-t border-slate-800">
                            <td className="px-2 py-2 font-mono">{String(l.option_api_id ?? "")}</td>
                            <td className="px-2 py-2">{String(l.quantity ?? "")}</td>
                            <td className="px-2 py-2">{nfKrw(String(l.line_total_krw ?? "0"))}</td>
                            <td className="max-w-[140px] truncate px-2 py-2" title={String(l.charged_basis_key ?? "")}>
                              {String(l.charged_basis_key ?? "")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-teal-300">결제 시도</h3>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="px-2 py-2">provider</th>
                          <th className="px-2 py-2">상태</th>
                          <th className="px-2 py-2">금액</th>
                          <th className="px-2 py-2">생성</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payment_attempts.map((a) => (
                          <tr key={String(a.payment_attempt_id)} className="border-t border-slate-800">
                            <td className="px-2 py-2">{String(a.provider ?? "")}</td>
                            <td className="px-2 py-2">{String(a.status ?? "")}</td>
                            <td className="px-2 py-2">{nfKrw(String(a.amount_krw ?? "0"))}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                              {a.created_at ? new Date(String(a.created_at)).toLocaleString("ko-KR") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {(() => {
                  const st = String(detail.order.status ?? "");
                  const oid = String(detail.order.order_id ?? "");
                  const canRefund = (st === "paid" || st === "delivered") && oid;
                  if (!canRefund) return null;
                  return (
                    <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-4">
                      <h3 className="font-semibold text-amber-200">환불 (웰컴페이 전액 취소)</h3>
                      <p className="mt-1 text-xs text-amber-100/80">
                        eSIM ICCID가 발급된 주문은 환불할 수 없습니다. PG 취소 성공 시 주문 상태가 refunded로 바뀝니다.
                      </p>
                      <label className="mt-3 block text-xs text-slate-400">
                        사유
                        <input
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        />
                      </label>
                      {refundErr ? <p className="mt-2 text-xs text-red-400">{refundErr}</p> : null}
                      <button
                        type="button"
                        disabled={refundBusy}
                        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                        onClick={() => void submitRefund()}
                      >
                        {refundBusy ? "처리 중…" : "환불 실행"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
