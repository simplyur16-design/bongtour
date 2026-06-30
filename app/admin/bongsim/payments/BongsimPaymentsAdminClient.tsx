"use client";

import { useCallback, useEffect, useState } from "react";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import { ADMIN_CARD_CLASS } from "@/lib/admin-design-system";
import { refundErrorMessage } from "@/lib/bongsim/refund/refund-error-message";

const PURGE_CONFIRM = "PURGE_BONGSIM_ORDERS";

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  checkout_channel?: string;
  grand_total_krw: string;
  buyer_email: string;
  created_at: string;
};

type DetailResponse = {
  order: Record<string, unknown>;
  lines: Array<
    Record<string, unknown> & {
      usim_capable?: boolean;
      plan_name?: string;
    }
  >;
  payment_attempts: Record<string, unknown>[];
  fulfillment_jobs?: Record<string, unknown>[];
  fulfillment_topups?: Array<
    Record<string, unknown> & { fulfillment_kind?: string }
  >;
  offline_usim?: {
    fulfillment: string;
    payment?: { channel?: string; note?: string | null };
  } | null;
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
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const [purgeErr, setPurgeErr] = useState<string | null>(null);
  const [usimIccid, setUsimIccid] = useState("");
  const [usimLineOptionId, setUsimLineOptionId] = useState("");
  const [usimBusy, setUsimBusy] = useState(false);
  const [usimErr, setUsimErr] = useState<string | null>(null);
  const [usimOk, setUsimOk] = useState<string | null>(null);

  const [offlineOptionId, setOfflineOptionId] = useState("");
  const [offlineQty, setOfflineQty] = useState(1);
  const [offlineEmail, setOfflineEmail] = useState("");
  const [offlinePhone, setOfflinePhone] = useState("");
  const [offlineNote, setOfflineNote] = useState("");
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineErr, setOfflineErr] = useState<string | null>(null);
  const [offlineOk, setOfflineOk] = useState<string | null>(null);
  const [offlinePayChannel, setOfflinePayChannel] = useState<"cash" | "card_terminal" | "bank_transfer">("cash");
  const [offlinePayNote, setOfflinePayNote] = useState("");
  const [offlinePayBusy, setOfflinePayBusy] = useState(false);

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
    setUsimIccid("");
    setUsimLineOptionId("");
    setUsimErr(null);
    setUsimOk(null);
    try {
      const res = await fetch(`/api/admin/bongsim/payments/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const j = (await res.json()) as DetailResponse & { error?: string };
      if (!res.ok) throw new Error(j.error ?? "상세를 불러오지 못했습니다.");
      setDetail(j);
      const firstUsimLine = (j.lines ?? []).find((l) => Boolean(l.usim_capable));
      if (firstUsimLine?.option_api_id) {
        setUsimLineOptionId(String(firstUsimLine.option_api_id));
      }
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "오류");
    }
  };

  const purgeOrders = async (mode: "unfinished" | "all") => {
    const label =
      mode === "all"
        ? "모든 주문을 DB에서 삭제합니다. 복구할 수 없습니다."
        : "미완료 주문(대기·결제대기·실패·취소)만 삭제합니다.";
    if (!window.confirm(`${label}\n\n계속할까요?`)) return;
    setPurgeBusy(true);
    setPurgeMsg(null);
    setPurgeErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/payments/purge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: PURGE_CONFIRM, mode }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        deletedCount?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? `삭제 실패 (${res.status})`);
      }
      setPurgeMsg(`${j.deletedCount ?? 0}건 삭제했습니다. (mode=${mode})`);
      setPage(1);
      await load();
    } catch (e) {
      setPurgeErr(e instanceof Error ? e.message : "오류");
    } finally {
      setPurgeBusy(false);
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
      if (!res.ok) throw new Error(refundErrorMessage(j));
      setDetailId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setRefundErr(e instanceof Error ? e.message : "오류");
    } finally {
      setRefundBusy(false);
    }
  };

  const submitUsimActivate = async () => {
    if (!detail?.order) return;
    const oid = String(detail.order.order_id ?? "").trim();
    const optionId = usimLineOptionId.trim();
    const iccid = usimIccid.trim();
    if (!oid || !optionId || !iccid) {
      setUsimErr("상품 라인과 ICCID를 입력해 주세요.");
      return;
    }
    setUsimBusy(true);
    setUsimErr(null);
    setUsimOk(null);
    try {
      const res = await fetch(
        `/api/admin/bongsim/payments/${encodeURIComponent(oid)}/usim-activate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option_api_id: optionId, iccid }),
        },
      );
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string; iccid?: string };
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? "USIM 활성화에 실패했습니다.");
      }
      setUsimOk(`물리 USIM 활성화 완료 (ICCID ${j.iccid ?? iccid})`);
      setUsimIccid("");
      await openDetail(oid);
    } catch (e) {
      setUsimErr(e instanceof Error ? e.message : "오류");
    } finally {
      setUsimBusy(false);
    }
  };

  const submitOfflineCreate = async () => {
    setOfflineBusy(true);
    setOfflineErr(null);
    setOfflineOk(null);
    try {
      const res = await fetch("/api/admin/bongsim/offline-usim/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_api_id: offlineOptionId.trim(),
          quantity: offlineQty,
          buyer_email: offlineEmail.trim(),
          buyer_phone: offlinePhone.trim(),
          note: offlineNote.trim() || null,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        order_id?: string;
        order_number?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !j.ok || !j.order_id) {
        throw new Error(j.message ?? j.error ?? "주문 생성 실패");
      }
      setOfflineOk(`오프라인 주문 생성: ${j.order_number}`);
      setPage(1);
      await load();
      await openDetail(j.order_id);
    } catch (e) {
      setOfflineErr(e instanceof Error ? e.message : "오류");
    } finally {
      setOfflineBusy(false);
    }
  };

  const submitOfflinePaymentConfirm = async (orderId: string) => {
    setOfflinePayBusy(true);
    setUsimErr(null);
    setOfflineErr(null);
    try {
      const res = await fetch(
        `/api/admin/bongsim/offline-usim/orders/${encodeURIComponent(orderId)}/confirm-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_channel: offlinePayChannel,
            note: offlinePayNote.trim() || null,
          }),
        },
      );
      const j = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? "결제 확인 실패");
      }
      setUsimOk(null);
      await openDetail(orderId);
    } catch (e) {
      setUsimErr(e instanceof Error ? e.message : "오류");
    } finally {
      setOfflinePayBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="eSIM 결제 내역"
        subtitle="온라인 PG 주문과 매장 오프라인 USIM 주문(현금·별도 단말기·계좌이체)을 관리합니다."
      />

      <section className={`${ADMIN_CARD_CLASS} border-teal-200/80 bg-teal-50/30`}>
        <h2 className="text-sm font-semibold text-teal-950">매장 오프라인 USIM 주문 (전자결제 없음)</h2>
        <p className="mt-2 text-xs text-teal-900/90">
          1) 주문 생성 → 2) 현금·카드단말기·계좌이체 수령 확인 → 3) 주문 상세에서 ICCID로 USIM 활성화.
          eSIM QR은 자동 발급되지 않습니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-bt-text-muted-lavender sm:col-span-2">
            option_api_id
            <input
              value={offlineOptionId}
              onChange={(e) => setOfflineOptionId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 font-mono text-sm"
              placeholder="유심사 옵션 ID"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender">
            수량
            <input
              type="number"
              min={1}
              max={99}
              value={offlineQty}
              onChange={(e) => setOfflineQty(Number.parseInt(e.target.value, 10) || 1)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender">
            메모 (선택)
            <input
              value={offlineNote}
              onChange={(e) => setOfflineNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender">
            고객 이메일
            <input
              type="email"
              value={offlineEmail}
              onChange={(e) => setOfflineEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender">
            고객 휴대폰
            <input
              type="tel"
              value={offlinePhone}
              onChange={(e) => setOfflinePhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
              placeholder="010-0000-0000"
            />
          </label>
        </div>
        {offlineErr ? <p className="mt-2 text-sm text-red-600">{offlineErr}</p> : null}
        {offlineOk ? <p className="mt-2 text-sm text-emerald-700">{offlineOk}</p> : null}
        <button
          type="button"
          disabled={offlineBusy}
          onClick={() => void submitOfflineCreate()}
          className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {offlineBusy ? "생성 중…" : "오프라인 주문 생성 (결제대기)"}
        </button>
      </section>

      <section className={`${ADMIN_CARD_CLASS} border-amber-200/80 bg-amber-50/40`}>
        <h2 className="text-sm font-semibold text-amber-950">결제 내역 DB 초기화 (테스트·운영 정리)</h2>
        <p className="mt-2 text-xs text-amber-900/90">
          기존 「초기화」는 검색만 비웁니다. 아래 버튼은 DB에서 주문을 삭제합니다. 결제완료·전달완료·환불 건은 「미완료만
          삭제」에서 제외됩니다. 로컬·스테이징 권장.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={purgeBusy}
            onClick={() => void purgeOrders("unfinished")}
            className="rounded-lg border border-amber-600 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            {purgeBusy ? "처리 중…" : "미완료 주문 삭제"}
          </button>
          <button
            type="button"
            disabled={purgeBusy}
            onClick={() => void purgeOrders("all")}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            전체 주문 삭제 (로컬만)
          </button>
        </div>
        {purgeMsg ? <p className="mt-2 text-sm text-emerald-800">{purgeMsg}</p> : null}
        {purgeErr ? <p className="mt-2 text-sm text-red-700">{purgeErr}</p> : null}
      </section>

      <section className={ADMIN_CARD_CLASS}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput);
        }}
      >
        <label className="block min-w-[200px] flex-1">
          <span className="text-xs font-medium text-bt-text-muted-lavender">주문번호 또는 이메일</span>
          <input
            value={searchInput}
            onChange={(ev) => setSearchInput(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm text-bt-text-navy placeholder:text-bt-text-muted-lavender"
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
          className="rounded-lg border border-bt-border-soft px-4 py-2 text-sm text-bt-text-navy hover:bg-bt-bg-lavender/80"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setPage(1);
          }}
        >
          검색 초기화
        </button>
      </form>

      {loadErr ? <p className="mt-4 text-sm text-red-600">{loadErr}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-bt-border-soft">
        <table className="min-w-full text-left text-sm text-bt-text-navy">
          <thead>
            <tr className="border-b border-bt-border-soft bg-bt-bg-lavender/50 text-xs uppercase text-bt-text-muted-lavender">
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
                className="cursor-pointer border-b border-bt-border-soft/80 hover:bg-bt-bg-lavender/40"
                onClick={() => void openDetail(r.order_id)}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-teal-800">
                  {r.order_number}
                  {r.checkout_channel === "admin_offline_usim" ? (
                    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      오프라인
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5">{nfKrw(r.grand_total_krw)}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5" title={r.buyer_email}>
                  {r.buyer_email}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-bt-text-muted-lavender">
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
                    <span className="text-bt-text-muted-lavender">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-bt-text-muted-lavender">
                  주문이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-bt-text-muted-lavender">
        <button
          type="button"
          disabled={page <= 1}
          className="rounded-lg border border-bt-border-soft px-3 py-1.5 disabled:opacity-40"
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
          className="rounded-lg border border-bt-border-soft px-3 py-1.5 disabled:opacity-40"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          다음
        </button>
      </div>
      </section>

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
                          <th className="px-2 py-2">상품명</th>
                          <th className="px-2 py-2">수량</th>
                          <th className="px-2 py-2">USIM</th>
                          <th className="px-2 py-2">라인합계</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((l) => (
                          <tr key={String(l.line_id)} className="border-t border-slate-800">
                            <td className="px-2 py-2 font-mono">{String(l.option_api_id ?? "")}</td>
                            <td className="max-w-[160px] truncate px-2 py-2" title={String(l.plan_name ?? "")}>
                              {String(l.plan_name ?? "—")}
                            </td>
                            <td className="px-2 py-2">{String(l.quantity ?? "")}</td>
                            <td className="px-2 py-2">
                              {l.usim_capable ? (
                                <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-amber-200">가능</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-2 py-2">{nfKrw(String(l.line_total_krw ?? "0"))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {(detail.fulfillment_topups?.length ?? 0) > 0 ? (
                  <div>
                    <h3 className="font-semibold text-teal-300">발급·활성화 (topup)</h3>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-700">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400">
                          <tr>
                            <th className="px-2 py-2">종류</th>
                            <th className="px-2 py-2">topup_id</th>
                            <th className="px-2 py-2">ICCID</th>
                            <th className="px-2 py-2">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.fulfillment_topups ?? []).map((t) => (
                            <tr key={String(t.topup_row_id)} className="border-t border-slate-800">
                              <td className="px-2 py-2">
                                {t.fulfillment_kind === "usim" ? "물리 USIM" : "eSIM"}
                              </td>
                              <td className="px-2 py-2 font-mono">{String(t.topup_id ?? "")}</td>
                              <td className="px-2 py-2 font-mono">{String(t.iccid ?? "—")}</td>
                              <td className="px-2 py-2">{String(t.status ?? "")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
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
                  const isOffline = Boolean(detail.offline_usim);
                  if (!isOffline || st !== "awaiting_payment" || !oid) return null;
                  return (
                    <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4">
                      <h3 className="font-semibold text-amber-200">오프라인 결제 확인</h3>
                      <p className="mt-1 text-xs text-amber-100/80">
                        현금·별도 카드단말기·계좌이체 수령 후 결제완료로 전환합니다. (봉투어 PG 미사용)
                      </p>
                      <label className="mt-3 block text-xs text-slate-400">
                        결제 수단
                        <select
                          value={offlinePayChannel}
                          onChange={(e) =>
                            setOfflinePayChannel(
                              e.target.value as "cash" | "card_terminal" | "bank_transfer",
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        >
                          <option value="cash">현금</option>
                          <option value="card_terminal">별도 카드단말기</option>
                          <option value="bank_transfer">계좌이체</option>
                        </select>
                      </label>
                      <label className="mt-3 block text-xs text-slate-400">
                        메모 (선택)
                        <input
                          value={offlinePayNote}
                          onChange={(e) => setOfflinePayNote(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={offlinePayBusy}
                        className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                        onClick={() => void submitOfflinePaymentConfirm(oid)}
                      >
                        {offlinePayBusy ? "처리 중…" : "오프라인 결제 확인"}
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  const st = String(detail.order.status ?? "");
                  const oid = String(detail.order.order_id ?? "");
                  const usimLines = detail.lines.filter((l) => Boolean(l.usim_capable));
                  const canUsimActivate =
                    (st === "paid" || st === "delivered") && oid && usimLines.length > 0;
                  if (!canUsimActivate) return null;
                  return (
                    <div className="rounded-xl border border-teal-800/60 bg-teal-950/40 p-4">
                      <h3 className="font-semibold text-teal-200">물리 USIM 활성화 (오프라인 카드)</h3>
                      <p className="mt-1 text-xs text-teal-100/80">
                        매장에서 판매한 플랜 미설정 USIM의 ICCID를 입력하면 유심사 API로 해당 주문 플랜을
                        활성화합니다. eSIM이 아직 발급되지 않은 경우 자동으로 eSIM 예약을 취소한 뒤 진행합니다.
                      </p>
                      <label className="mt-3 block text-xs text-slate-400">
                        상품 라인
                        <select
                          value={usimLineOptionId}
                          onChange={(e) => setUsimLineOptionId(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        >
                          {usimLines.map((l) => (
                            <option key={String(l.line_id)} value={String(l.option_api_id ?? "")}>
                              {String(l.plan_name || l.option_api_id)} × {String(l.quantity)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs text-slate-400">
                        ICCID (19~20자리)
                        <input
                          value={usimIccid}
                          onChange={(e) => setUsimIccid(e.target.value)}
                          placeholder="8901…"
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
                          autoComplete="off"
                        />
                      </label>
                      {usimErr ? <p className="mt-2 text-xs text-red-400">{usimErr}</p> : null}
                      {usimOk ? <p className="mt-2 text-xs text-emerald-400">{usimOk}</p> : null}
                      <button
                        type="button"
                        disabled={usimBusy}
                        className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                        onClick={() => void submitUsimActivate()}
                      >
                        {usimBusy ? "활성화 중…" : "USIM 활성화 실행"}
                      </button>
                    </div>
                  );
                })()}
                {(() => {
                  const st = String(detail.order.status ?? "");
                  const oid = String(detail.order.order_id ?? "");
                  const provider = String(detail.order.payment_provider ?? "");
                  const isOfflinePaid = provider === "offline" || Boolean(detail.offline_usim);
                  const canRefund =
                    (st === "paid" || st === "delivered") && oid && !isOfflinePaid;
                  if (!canRefund) {
                    if (isOfflinePaid && (st === "paid" || st === "delivered")) {
                      return (
                        <p className="text-xs text-slate-500">
                          오프라인 결제 주문은 PG 자동 환불이 없습니다. 유심사 취소·현금 반환은 별도 운영 절차로
                          처리해 주세요.
                        </p>
                      );
                    }
                    return null;
                  }
                  return (
                    <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-4">
                      <h3 className="font-semibold text-amber-200">환불 (웰컴페이 전액 취소)</h3>
                      <p className="mt-1 text-xs text-amber-100/80">
                        데이터를 사용하지 않은 eSIM은 ICCID(발급) 여부와 관계없이 환불할 수 있습니다. PG 취소 성공 시
                        주문 상태가 refunded로 바뀝니다.
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
