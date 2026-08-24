"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AdminPageHeader from "@/app/admin/components/AdminPageHeader";
import OfflineUsimPlanPicker, {
  type OfflineUsimPlanSelection,
} from "@/app/admin/bongsim/payments/OfflineUsimPlanPicker";
import { ADMIN_CARD_CLASS } from "@/lib/admin-design-system";
import { clampAdminListPage } from "@/lib/bongsim/admin/clamp-admin-list-page";
import { refundErrorMessage } from "@/lib/bongsim/refund/refund-error-message";
import { supplyLineTotalKrw } from "@/lib/bongsim/admin/line-supply-cost";

const PURGE_CONFIRM = "PURGE_BONGSIM_ORDERS";

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  checkout_channel?: string;
  grand_total_krw: string;
  buyer_email: string;
  buyer_tel?: string | null;
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
  complimentary_esim?: {
    fulfillment: string;
    reason_category: string;
    reason_memo: string;
    granted_at: string;
    granted_by_admin_id: string;
  } | null;
};

function nfKrw(n: string): string {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return n;
  return `${v.toLocaleString("ko-KR")}원`;
}

function adminPlanPricingBlock(
  selection: OfflineUsimPlanSelection | null,
  qty: number,
  opts?: { customerLabel?: string; showZeroCustomer?: boolean },
): ReactNode {
  if (!selection?.price_krw && selection?.supply_krw == null) return null;
  const q = Math.max(1, Math.trunc(qty));
  const customerUnit = selection?.price_krw ?? null;
  const supplyUnit = selection?.supply_krw ?? null;
  const customerTotal =
    customerUnit != null ? customerUnit * q : opts?.showZeroCustomer ? 0 : null;
  const supplyTotal = supplyUnit != null ? supplyUnit * q : null;
  const customerLabel = opts?.customerLabel ?? "고객 수납액";
  return (
    <div className="mt-2 space-y-1 text-sm">
      {customerTotal != null ? (
        <p>
          <span className="text-bt-text-muted-lavender">{customerLabel}</span>{" "}
          <span className="font-semibold">{customerTotal.toLocaleString("ko-KR")}원</span>
          <span className="text-xs text-bt-text-muted-lavender"> (수량 {q})</span>
        </p>
      ) : null}
      {supplyTotal != null ? (
        <p>
          <span className="text-bt-text-muted-lavender">공급 원가</span>{" "}
          <span className="font-semibold">{supplyTotal.toLocaleString("ko-KR")}원</span>
        </p>
      ) : null}
    </div>
  );
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

/**
 * REGRESSION-FREEZE[bongsim-complimentary-esim-bulk]: 빈/잘린 본문에서 Response.json() 예외 방지 — manifest
 * (`Failed to execute 'json' on 'Response': Unexpected end of JSON input`)
 */
async function readAdminResponseJson<T>(res: Response, emptyHint?: string): Promise<T> {
  const raw = await res.text();
  if (!raw.trim()) {
    throw new Error(
      emptyHint?.trim() ||
        `서버 응답이 비었습니다 (${res.status}). 잠시 후 다시 시도하거나 결제 내역을 확인하세요.`,
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`서버 응답을 해석할 수 없습니다 (${res.status}).`);
  }
}

function isLikelyProxyTimeoutEmpty(res: Response, raw: string): boolean {
  return !raw.trim() && (res.status === 500 || res.status === 502 || res.status === 504 || res.status === 524);
}

/** 클라이언트 청크 — 프록시 타임아웃으로 bulk 응답이 비는 것 방지 */
const COMPLIMENTARY_BULK_CLIENT_CHUNK = 8;

export default function BongsimPaymentsAdminClient() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  // REGRESSION-FREEZE[bongsim-admin-payments-pagination]: 느린 응답 레이스로 이전 페이지 덮어쓰기 방지 — manifest
  const loadGenRef = useRef(0);
  /** 서버가 page를 clamp해 내려준 뒤 state만 맞출 때 useEffect 재조회를 한 번 건너뛴다. */
  const skipLoadAfterPageSyncRef = useRef(false);

  // REGRESSION-FREEZE[bongsim-admin-payments-query]: query_failed 한글 메시지 — manifest
  const adminLoadErrorMessage = (j: { error?: string; message?: string }, fallback: string) =>
    j.message?.trim() ||
    (j.error === "query_failed"
      ? "주문·발급 내역 조회에 실패했습니다. 새로고침해 주세요."
      : j.error === "connection_timeout"
        ? "DB 연결이 지연되었습니다. 잠시 후 새로고침해 주세요."
        : j.error) ||
    fallback;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("고객 요청 환불");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState<string | null>(null);
  const [nonPgCancelReason, setNonPgCancelReason] = useState("관리자 무상·오프라인 eSIM 취소");
  const [nonPgCancelBusy, setNonPgCancelBusy] = useState(false);
  const [nonPgCancelErr, setNonPgCancelErr] = useState<string | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const [purgeErr, setPurgeErr] = useState<string | null>(null);
  const [usimIccid, setUsimIccid] = useState("");
  const [usimLineOptionId, setUsimLineOptionId] = useState("");
  const [usimBusy, setUsimBusy] = useState(false);
  const [usimErr, setUsimErr] = useState<string | null>(null);
  const [usimOk, setUsimOk] = useState<string | null>(null);

  const [offlineOptionId, setOfflineOptionId] = useState("");
  const [offlinePlanSelection, setOfflinePlanSelection] = useState<OfflineUsimPlanSelection | null>(null);
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

  const [compOptionId, setCompOptionId] = useState("");
  const [compPlanSelection, setCompPlanSelection] = useState<OfflineUsimPlanSelection | null>(null);
  const [compQty, setCompQty] = useState(1);
  const [compPhone, setCompPhone] = useState("");
  const [compEmail, setCompEmail] = useState("");
  const [compReasonCategory, setCompReasonCategory] = useState<
    "group_benefit" | "cs_compensation" | "customer_thanks" | "promo_event" | "other"
  >("group_benefit");
  const [compReasonMemo, setCompReasonMemo] = useState("");
  const [compBusy, setCompBusy] = useState(false);
  const [compErr, setCompErr] = useState<string | null>(null);
  const [compOk, setCompOk] = useState<string | null>(null);
  const [compBulkPhones, setCompBulkPhones] = useState("");
  const [compBulkBusy, setCompBulkBusy] = useState(false);
  const [compBulkErr, setCompBulkErr] = useState<string | null>(null);
  const [compBulkOk, setCompBulkOk] = useState<string | null>(null);
  const [compBulkFailed, setCompBulkFailed] = useState<
    Array<{ phone: string; message: string }>
  >([]);
  const [usageByOrder, setUsageByOrder] = useState<
    Record<
      string,
      | { state: "loading" }
      | { state: "ok"; unused: boolean; activated: boolean; label: string }
      | { state: "err"; message: string }
    >
  >({});

  // REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: 목록 미사용 확인 버튼 — manifest
  const checkOrderUsage = async (orderId: string) => {
    setUsageByOrder((prev) => ({ ...prev, [orderId]: { state: "loading" } }));
    try {
      const res = await fetch(`/api/admin/bongsim/payments/${encodeURIComponent(orderId)}/usage`, {
        cache: "no-store",
      });
      const j = await readAdminResponseJson<{
        ok?: boolean;
        unused?: boolean;
        activated?: boolean;
        label?: string;
        error?: string;
        message?: string;
      }>(res);
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? "사용량 조회 실패");
      }
      setUsageByOrder((prev) => ({
        ...prev,
        [orderId]: {
          state: "ok",
          unused: Boolean(j.unused),
          activated: Boolean(j.activated),
          label: j.label?.trim() || (j.unused ? "미사용" : j.activated ? "활성화됨" : "사용"),
        },
      }));
    } catch (e) {
      setUsageByOrder((prev) => ({
        ...prev,
        [orderId]: {
          state: "err",
          message: e instanceof Error ? e.message : "사용량 조회 실패",
        },
      }));
    }
  };

  const load = useCallback(
    async (opts?: { page?: number; search?: string }) => {
      const pageToLoad = opts?.page ?? page;
      const searchToLoad = opts?.search ?? search;
      const gen = ++loadGenRef.current;
      setListLoading(true);
      setLoadErr(null);
      try {
        const q = new URLSearchParams();
        q.set("page", String(pageToLoad));
        if (searchToLoad.trim()) q.set("search", searchToLoad.trim());
        const res = await fetch(`/api/admin/bongsim/payments?${q.toString()}`, { cache: "no-store" });
        const j = await readAdminResponseJson<{
          orders?: OrderRow[];
          page?: number;
          total_pages?: number;
          error?: string;
          message?: string;
        }>(res);
        if (gen !== loadGenRef.current) return;
        if (!res.ok) throw new Error(adminLoadErrorMessage(j, "목록을 불러오지 못했습니다."));
        const nextTotalPages = Math.max(1, Number(j.total_pages) || 1);
        const serverPage = Number(j.page);
        const nextPage = clampAdminListPage(
          Number.isFinite(serverPage) && serverPage > 0 ? serverPage : pageToLoad,
          nextTotalPages,
        );
        setRows(j.orders ?? []);
        setTotalPages(nextTotalPages);
        // REGRESSION-FREEZE[bongsim-admin-payments-pagination]: 서버 clamp page를 UI에 동기화 — manifest
        if (nextPage !== page) {
          skipLoadAfterPageSyncRef.current = true;
          setPage(nextPage);
        }
      } catch (e) {
        if (gen !== loadGenRef.current) return;
        setLoadErr(e instanceof Error ? e.message : "오류");
      } finally {
        if (gen === loadGenRef.current) setListLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    if (skipLoadAfterPageSyncRef.current) {
      skipLoadAfterPageSyncRef.current = false;
      return;
    }
    void load();
  }, [load]);

  const goToPage = (next: number) => {
    const clamped = clampAdminListPage(next, totalPages);
    if (clamped === page) return;
    setPage(clamped);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openDetail = async (orderId: string) => {
    setDetailId(orderId);
    setDetail(null);
    setDetailErr(null);
    setRefundErr(null);
    setRefundReason("고객 요청 환불");
    setNonPgCancelReason("관리자 무상·오프라인 eSIM 취소");
    setNonPgCancelErr(null);
    setUsimIccid("");
    setUsimLineOptionId("");
    setUsimErr(null);
    setUsimOk(null);
    try {
      const res = await fetch(`/api/admin/bongsim/payments/${encodeURIComponent(orderId)}`, { cache: "no-store" });
      const j = await readAdminResponseJson<DetailResponse & { error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(adminLoadErrorMessage(j, "상세를 불러오지 못했습니다."));
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
      const j = await readAdminResponseJson<{
        ok?: boolean;
        deletedCount?: number;
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? `삭제 실패 (${res.status})`);
      }
      setPurgeMsg(`${j.deletedCount ?? 0}건 삭제했습니다. (mode=${mode})`);
      setPage(1);
      await load({ page: 1 });
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
      const j = await readAdminResponseJson<{ error?: string; message?: string }>(res);
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

  const submitNonPgCancel = async () => {
    if (!detail?.order) return;
    const oid = String(detail.order.order_id ?? "").trim();
    if (!oid) return;
    if (
      !window.confirm(
        "유심사에서 eSIM을 취소하고 주문을 refunded로 표시합니다. PG 카드 환불은 없습니다. 계속할까요?",
      )
    ) {
      return;
    }
    setNonPgCancelBusy(true);
    setNonPgCancelErr(null);
    try {
      const res = await fetch("/api/admin/bongsim/cancel-non-pg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: oid,
          reason: nonPgCancelReason.trim() || "관리자 무상·오프라인 eSIM 취소",
        }),
      });
      const j = await readAdminResponseJson<{ ok?: boolean; error?: string; message?: string }>(res);
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? `취소 실패 (${res.status})`);
      }
      setDetailId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setNonPgCancelErr(e instanceof Error ? e.message : "오류");
    } finally {
      setNonPgCancelBusy(false);
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
      const j = await readAdminResponseJson<{ ok?: boolean; message?: string; error?: string; iccid?: string }>(
        res,
      );
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? "USIM 활성화에 실패했습니다.");
      }
      setUsimOk(`물리 USIM 활성화 완료 (ICCID ${j.iccid ?? iccid})`);
      setUsimIccid("");
      await openDetail(oid);
      await load();
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
      const j = await readAdminResponseJson<{
        ok?: boolean;
        order_id?: string;
        order_number?: string;
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok || !j.ok || !j.order_id) {
        throw new Error(j.message ?? j.error ?? "주문 생성 실패");
      }
      setOfflineOk(`오프라인 주문 생성: ${j.order_number}`);
      setOfflinePlanSelection(null);
      setOfflineOptionId("");
      setPage(1);
      await load({ page: 1 });
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
      const j = await readAdminResponseJson<{ ok?: boolean; message?: string; error?: string }>(res);
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? "결제 확인 실패");
      }
      setUsimOk(null);
      // REGRESSION-FREEZE[bongsim-offline-usim-order]: confirm/activate 후 목록 status 갱신 — manifest
      await openDetail(orderId);
      await load();
    } catch (e) {
      setUsimErr(e instanceof Error ? e.message : "오류");
    } finally {
      setOfflinePayBusy(false);
    }
  };

  const submitComplimentaryGrant = async () => {
    setCompBusy(true);
    setCompErr(null);
    setCompOk(null);
    try {
      const res = await fetch("/api/admin/bongsim/complimentary-esim/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_api_id: compOptionId.trim(),
          quantity: compQty,
          buyer_phone: compPhone.trim(),
          buyer_email: compEmail.trim() || null,
          reason_category: compReasonCategory,
          reason_memo: compReasonMemo.trim(),
        }),
      });
      const raw = await res.text();
      // REGRESSION-FREEZE[bongsim-complimentary-grant-no-postcommit-500]: empty proxy 500 soft-ok — manifest
      if (isLikelyProxyTimeoutEmpty(res, raw)) {
        setCompOk("무상 eSIM 발급 요청이 접수된 것으로 보입니다. 주문 목록을 확인해 주세요.");
        try {
          await load();
        } catch {
          /* ignore */
        }
        return;
      }
      if (!raw.trim()) {
        throw new Error(`서버 응답이 비었습니다 (${res.status}). 결제 내역을 확인해 주세요.`);
      }
      let j: { order_number?: string; message?: string; error?: string; ok?: boolean };
      try {
        j = JSON.parse(raw) as typeof j;
      } catch {
        throw new Error(`서버 응답을 해석할 수 없습니다 (${res.status}).`);
      }
      if (!res.ok) throw new Error(j.message ?? j.error ?? "무상 발급 실패");
      setCompOk(`무상 eSIM 발급 완료: ${j.order_number ?? ""} — QR 알림톡 발송이 시작됩니다.`);
      setCompPlanSelection(null);
      setCompOptionId("");
      setCompReasonMemo("");
      try {
        await load();
      } catch {
        /* 발급 성공 후 목록 갱신 실패는 무시 */
      }
    } catch (e) {
      setCompErr(e instanceof Error ? e.message : "오류");
    } finally {
      setCompBusy(false);
    }
  };

  const submitComplimentaryBulkGrant = async () => {
    setCompBulkBusy(true);
    setCompBulkErr(null);
    setCompBulkOk(null);
    setCompBulkFailed([]);
    try {
      const phoneLines = compBulkPhones
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (phoneLines.length === 0) {
        throw new Error("휴대폰 번호를 1건 이상 입력해 주세요.");
      }

      type BulkJson = {
        ok?: boolean;
        requested?: number;
        succeeded?: number;
        failed?: number;
        invalid_phones?: string[];
        results?: Array<
          | { phone: string; ok: true; order_number: string }
          | { phone: string; ok: false; message?: string; reason?: string }
        >;
        message?: string;
        error?: string;
      };

      let succeeded = 0;
      let failed = 0;
      const invalid: string[] = [];
      const failedRows: Array<{ phone: string; message: string }> = [];
      let proxyTimeoutChunks = 0;
      // REGRESSION-FREEZE[bongsim-complimentary-esim-bulk]: 클라이언트 청크 + 빈 500 soft-ok — manifest
      for (let i = 0; i < phoneLines.length; i += COMPLIMENTARY_BULK_CLIENT_CHUNK) {
        const chunk = phoneLines.slice(i, i + COMPLIMENTARY_BULK_CLIENT_CHUNK);
        const res = await fetch("/api/admin/bongsim/complimentary-esim/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            option_api_id: compOptionId.trim(),
            reason_category: compReasonCategory,
            reason_memo: compReasonMemo.trim(),
            phones_text: chunk.join("\n"),
          }),
        });
        const raw = await res.text();
        // 발급·문자는 끝났는데 프록시가 빈 500을 주는 경우 — 치명 실패로 보지 않음
        if (isLikelyProxyTimeoutEmpty(res, raw)) {
          proxyTimeoutChunks += 1;
          succeeded += chunk.length;
          continue;
        }
        if (!raw.trim()) {
          throw new Error(
            `서버 응답이 비었습니다 (${res.status}). ${i + 1}~${i + chunk.length}번째 번호 구간. 결제 내역을 확인한 뒤 빠진 번호만 다시 시도하세요.`,
          );
        }
        let j: BulkJson;
        try {
          j = JSON.parse(raw) as BulkJson;
        } catch {
          throw new Error(`서버 응답을 해석할 수 없습니다 (${res.status}).`);
        }
        if (!res.ok) throw new Error(j.message ?? j.error ?? "일괄 발급 실패");
        succeeded += j.succeeded ?? 0;
        failed += j.failed ?? 0;
        for (const p of j.invalid_phones ?? []) invalid.push(p);
        for (const r of j.results ?? []) {
          if (!r.ok) {
            failedRows.push({
              phone: r.phone,
              message: r.message ?? r.reason ?? "발급 실패",
            });
          }
        }
      }

      setCompBulkFailed(failedRows);
      const parts = [
        proxyTimeoutChunks > 0
          ? `발급 요청 처리됨(응답 지연 ${proxyTimeoutChunks}구간) — 결제 내역에서 건수 확인`
          : `일괄 발급 완료: 성공 ${succeeded}건`,
        !proxyTimeoutChunks && failed > 0 ? `실패 ${failed}건` : null,
        invalid.length > 0 ? `형식 오류 ${invalid.length}건` : null,
        phoneLines.length > COMPLIMENTARY_BULK_CLIENT_CHUNK
          ? `${COMPLIMENTARY_BULK_CLIENT_CHUNK}명씩 나눠 처리`
          : null,
      ].filter(Boolean);
      setCompBulkOk(
        `${parts.join(" · ")} — QR 카톡/LMS는 백그라운드에서 순차 발송됩니다(약 1~2초 간격). 공급사 발급이 늦으면 수 분 뒤·2분 주기 재시도로 이어질 수 있습니다.`,
      );
      if (succeeded > 0 || proxyTimeoutChunks > 0) {
        setCompBulkPhones("");
      }
      try {
        await load();
      } catch {
        /* 발급 성공 후 목록 갱신 실패는 무시 */
      }
    } catch (e) {
      setCompBulkErr(e instanceof Error ? e.message : "오류");
    } finally {
      setCompBulkBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="eSIM 결제 내역"
        subtitle="온라인 PG 주문, 매장 오프라인 USIM, 관리자 무상 eSIM 발급을 관리합니다."
      />

      <div className="grid gap-6 xl:grid-cols-2">
      <section className={`${ADMIN_CARD_CLASS} border-teal-200/80 bg-teal-50/30`}>
        <h2 className="text-sm font-semibold text-teal-950">매장 오프라인 USIM 주문 (전자결제 없음)</h2>
        <p className="mt-2 text-xs text-teal-900/90">
          1) 주문 생성 → 2) 현금·카드단말기·계좌이체 수령 확인 → 3) 주문 상세에서 ICCID로 USIM 활성화.
          eSIM QR은 자동 발급되지 않습니다.
        </p>
        <OfflineUsimPlanPicker
          value={offlineOptionId}
          emptyPlansHint="선택한 조건에 맞는 USIM 플랜이 없습니다. 여행지·일수를 바꿔 보세요."
          onChange={(sel) => {
            setOfflinePlanSelection(sel);
            setOfflineOptionId(sel?.option_api_id ?? "");
          }}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        {adminPlanPricingBlock(offlinePlanSelection, offlineQty, { customerLabel: "고객 수납액" })}
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

      <section className={`${ADMIN_CARD_CLASS} border-violet-200/80 bg-violet-50/30`}>
        <h2 className="text-sm font-semibold text-violet-950">무상 eSIM 발급 (결제 없음)</h2>
        <p className="mt-2 text-xs text-violet-900/90">
          고객 휴대폰으로 eSIM QR 알림톡을 발송합니다. 발급 사유 메모는 필수이며, 휴대폰 번호는 직접 입력합니다.
          USIMSA 공급 비용은 발생합니다.
        </p>
        <OfflineUsimPlanPicker
          value={compOptionId}
          plansApiPath="/api/admin/bongsim/complimentary-esim/plans"
          emptyPlansHint="선택한 조건에 맞는 eSIM 플랜이 없습니다. 여행지·일수를 바꿔 보세요."
          onChange={(sel) => {
            setCompPlanSelection(sel);
            setCompOptionId(sel?.option_api_id ?? "");
          }}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-bt-text-muted-lavender">
            수량
            <input
              type="number"
              min={1}
              max={99}
              value={compQty}
              onChange={(e) => setCompQty(Number.parseInt(e.target.value, 10) || 1)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender sm:col-span-2">
            고객 휴대폰 (필수)
            <input
              type="tel"
              value={compPhone}
              onChange={(e) => setCompPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
              placeholder="010-0000-0000"
              required
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender sm:col-span-2">
            고객 이메일 (선택)
            <input
              type="email"
              value={compEmail}
              onChange={(e) => setCompEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
              placeholder="미입력 시 휴대폰 기반 내부 이메일 사용"
            />
          </label>
          <label className="block text-xs text-bt-text-muted-lavender">
            무상 발급 사유 유형
            <select
              value={compReasonCategory}
              onChange={(e) =>
                setCompReasonCategory(
                  e.target.value as typeof compReasonCategory,
                )
              }
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
            >
              <option value="group_benefit">단체 혜택</option>
              <option value="cs_compensation">CS 보상</option>
              <option value="customer_thanks">고객 감사</option>
              <option value="promo_event">프로모션·이벤트</option>
              <option value="other">기타</option>
            </select>
          </label>
          <label className="block text-xs text-bt-text-muted-lavender sm:col-span-2">
            무상 발급 사유 메모 (필수)
            <textarea
              value={compReasonMemo}
              onChange={(e) => setCompReasonMemo(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 text-sm"
              placeholder="예: ○○ 단체 예약 고객 혜택 / CS 접수 #1234 보상"
              required
            />
          </label>
        </div>
        {adminPlanPricingBlock(compPlanSelection, compQty, {
          customerLabel: "카탈로그 정가(할인 전)",
          showZeroCustomer: true,
        })}
        {compPlanSelection?.price_krw != null ? (
          <p className="mt-1 text-xs text-violet-800/80">고객 결제 0원 · 할인 리포트에 전액 할인으로 기록됩니다.</p>
        ) : null}
        {compErr ? <p className="mt-2 text-sm text-red-600">{compErr}</p> : null}
        {compOk ? <p className="mt-2 text-sm text-emerald-700">{compOk}</p> : null}
        <button
          type="button"
          disabled={compBusy || !compOptionId.trim() || !compPhone.trim() || compReasonMemo.trim().length < 2}
          onClick={() => void submitComplimentaryGrant()}
          className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {compBusy ? "발급 중…" : "무상 eSIM 발급 (QR 알림톡)"}
        </button>

        <div className="mt-6 border-t border-violet-200/80 pt-5">
          <h3 className="text-sm font-semibold text-violet-950">단체 일괄 발급</h3>
          <p className="mt-1 text-xs text-violet-900/90">
            위와 같은 상품·사유로 여러 명에게 1인 1장씩 발급합니다. 휴대폰 번호만 한 줄에 하나씩 입력하세요. (최대
            100명 · {COMPLIMENTARY_BULK_CLIENT_CHUNK}명씩 자동 분할 처리)
          </p>
          <label className="mt-3 block text-xs text-bt-text-muted-lavender">
            휴대폰 목록
            <textarea
              value={compBulkPhones}
              onChange={(e) => setCompBulkPhones(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-bt-border-soft px-3 py-2 font-mono text-sm"
              placeholder={"010-1234-5678\n01098765432\n01055556666"}
            />
          </label>
          {compBulkErr ? <p className="mt-2 text-sm text-red-600">{compBulkErr}</p> : null}
          {compBulkOk ? <p className="mt-2 text-sm text-emerald-700">{compBulkOk}</p> : null}
          {compBulkFailed.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-800">
              {compBulkFailed.map((row) => (
                <li key={row.phone}>
                  {row.phone}: {row.message}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={
              compBulkBusy ||
              !compOptionId.trim() ||
              !compBulkPhones.trim() ||
              compReasonMemo.trim().length < 2
            }
            onClick={() => void submitComplimentaryBulkGrant()}
            className="mt-4 rounded-lg bg-violet-800 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {compBulkBusy ? "일괄 발급 중…" : "단체 일괄 발급 (QR 알림톡)"}
          </button>
        </div>
      </section>
      </div>

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
            placeholder="주문번호·이메일·휴대폰·ICCID 검색…"
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
      {listLoading ? (
        <p className="mt-2 text-sm text-bt-text-muted-lavender">목록 불러오는 중…</p>
      ) : null}

      <div
        ref={listTopRef}
        className={`mt-6 overflow-x-auto rounded-xl border border-bt-border-soft ${listLoading ? "opacity-60" : ""}`}
      >
        <table className="min-w-full text-left text-sm text-bt-text-navy">
          <thead>
            <tr className="border-b border-bt-border-soft bg-bt-bg-lavender/50 text-xs uppercase text-bt-text-muted-lavender">
              <th className="px-3 py-3">주문번호</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3">결제금액</th>
              <th className="px-3 py-3">연락처</th>
              <th className="px-3 py-3">생성일</th>
              <th className="px-3 py-3">사용·환불</th>
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
                  {r.checkout_channel === "admin_complimentary_esim" ? (
                    <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">
                      무상
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="px-3 py-2.5">{nfKrw(r.grand_total_krw)}</td>
                <td
                  className="max-w-[220px] truncate px-3 py-2.5"
                  title={[r.buyer_tel, r.buyer_email].filter(Boolean).join(" · ")}
                >
                  {r.buyer_tel ? <div className="font-mono text-xs text-slate-800">{r.buyer_tel}</div> : null}
                  <div className={r.buyer_tel ? "truncate text-xs text-bt-text-muted-lavender" : "truncate"}>
                    {r.buyer_email}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-bt-text-muted-lavender">
                  {new Date(r.created_at).toLocaleString("ko-KR")}
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {r.status === "paid" || r.status === "delivered" ? (
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          className="rounded-md border border-teal-700/40 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                          disabled={usageByOrder[r.order_id]?.state === "loading"}
                          onClick={() => void checkOrderUsage(r.order_id)}
                        >
                          {usageByOrder[r.order_id]?.state === "loading" ? "조회 중…" : "미사용 확인"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-amber-600/90 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-500"
                          onClick={() => void openDetail(r.order_id)}
                        >
                          환불
                        </button>
                      </div>
                      {(() => {
                        const u = usageByOrder[r.order_id];
                        if (u?.state === "ok") {
                          return (
                            <span
                              className={`text-[11px] font-semibold ${
                                u.unused
                                  ? "text-teal-700"
                                  : u.activated && !u.label.startsWith("사용")
                                    ? "text-violet-800"
                                    : "text-amber-800"
                              }`}
                            >
                              {u.label}
                            </span>
                          );
                        }
                        if (u?.state === "err") {
                          return (
                            <span className="max-w-[10rem] text-[11px] text-red-600">{u.message}</span>
                          );
                        }
                        return null;
                      })()}
                    </div>
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
          disabled={listLoading || page <= 1}
          className="rounded-lg border border-bt-border-soft px-3 py-1.5 disabled:opacity-40"
          onClick={() => goToPage(page - 1)}
        >
          이전
        </button>
        <span>
          {page} / {totalPages}
          {listLoading ? " · 불러오는 중" : ""}
        </span>
        <button
          type="button"
          disabled={listLoading || page >= totalPages}
          className="rounded-lg border border-bt-border-soft px-3 py-1.5 disabled:opacity-40"
          onClick={() => goToPage(page + 1)}
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
                {detail.complimentary_esim ? (
                  <div className="rounded-xl border border-violet-800/50 bg-violet-950/30 p-4">
                    <h3 className="font-semibold text-violet-200">무상 eSIM 발급</h3>
                    <dl className="mt-2 grid gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">사유 유형</dt>
                        <dd className="text-slate-200">
                          {(() => {
                            const cat = detail.complimentary_esim!.reason_category;
                            const labels: Record<string, string> = {
                              group_benefit: "단체 혜택",
                              cs_compensation: "CS 보상",
                              customer_thanks: "고객 감사",
                              promo_event: "프로모션·이벤트",
                              other: "기타",
                            };
                            return labels[cat] ?? cat;
                          })()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">사유 메모</dt>
                        <dd className="whitespace-pre-wrap text-slate-200">
                          {detail.complimentary_esim.reason_memo}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">발급 시각</dt>
                        <dd className="text-slate-200">
                          {new Date(detail.complimentary_esim.granted_at).toLocaleString("ko-KR")}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
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
                      {(() => {
                        const sel =
                          usimLines.find((l) => String(l.option_api_id) === usimLineOptionId) ??
                          usimLines[0];
                        if (!sel) return null;
                        const qty = Math.max(1, Math.trunc(Number(sel.quantity) || 1));
                        const customerTotal = Number.parseInt(String(sel.line_total_krw ?? "0"), 10) || 0;
                        const supplyTotal = supplyLineTotalKrw(sel.snapshot, qty);
                        return (
                          <div className="mt-3 rounded-lg border border-teal-900/50 bg-teal-950/50 px-3 py-2 text-xs text-teal-100">
                            <p>
                              고객 수납액{" "}
                              <span className="font-semibold text-white">
                                {customerTotal.toLocaleString("ko-KR")}원
                              </span>
                              <span className="text-teal-300/80"> (수량 {qty})</span>
                            </p>
                            {supplyTotal != null ? (
                              <p className="mt-1">
                                공급 원가{" "}
                                <span className="font-semibold text-white">
                                  {supplyTotal.toLocaleString("ko-KR")}원
                                </span>
                              </p>
                            ) : null}
                          </div>
                        );
                      })()}
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
                  const isComplimentary =
                    provider === "complimentary" || Boolean(detail.complimentary_esim);
                  const canRefund =
                    (st === "paid" || st === "delivered") && oid && !isOfflinePaid && !isComplimentary;
                  const canNonPgCancel =
                    (st === "paid" || st === "delivered") && oid && (isOfflinePaid || isComplimentary);
                  if (!canRefund && !canNonPgCancel) {
                    return null;
                  }
                  if (canNonPgCancel) {
                    return (
                      <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4">
                        <h3 className="font-semibold text-rose-200">
                          {isComplimentary ? "무상 eSIM 취소" : "오프라인 주문 취소"}
                        </h3>
                        <p className="mt-1 text-xs text-rose-100/80">
                          PG 카드 환불 없이 유심사에서 eSIM/USIM을 취소하고 주문을 refunded로 바꿉니다. 이미
                          데이터를 사용한 경우 취소할 수 없습니다.
                        </p>
                        <label className="mt-3 block text-xs text-slate-400">
                          사유
                          <input
                            value={nonPgCancelReason}
                            onChange={(e) => setNonPgCancelReason(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                          />
                        </label>
                        {nonPgCancelErr ? (
                          <p className="mt-2 text-xs text-red-400">{nonPgCancelErr}</p>
                        ) : null}
                        <button
                          type="button"
                          disabled={nonPgCancelBusy}
                          className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                          onClick={() => void submitNonPgCancel()}
                        >
                          {nonPgCancelBusy ? "취소 중…" : "유심사 취소 실행"}
                        </button>
                      </div>
                    );
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
