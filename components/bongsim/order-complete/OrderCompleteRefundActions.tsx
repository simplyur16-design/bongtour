"use client";

import { refundErrorMessage } from "@/lib/bongsim/refund/refund-error-message";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  cancelEligible: boolean;
  cancelBlockReason: string | null;
  orderStatus: string;
  /** 취소 성공 후 목록 갱신 등 — 없으면 `router.refresh()` */
  onSuccess?: () => void;
  /** 마이페이지 — 취소 영역 제목 노출 */
  showHeading?: boolean;
};

export function OrderCompleteRefundActions({
  orderId,
  cancelEligible,
  cancelBlockReason,
  orderStatus,
  onSuccess,
  showHeading = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(orderStatus === "refunded");
  const inProgress = orderStatus === "refund_requested";

  if (inProgress) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[14px] font-semibold text-slate-900">환불 처리 중</p>
        <p className="mt-2 text-[13px] text-slate-600">
          카드 취소·환불을 진행하고 있습니다. 완료되면 이 페이지에 반영됩니다.
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[14px] font-semibold text-slate-900">주문 취소 완료</p>
        <p className="mt-2 text-[13px] text-slate-600">결제가 취소(환불) 처리되었습니다. 카드사 반영은 수일 걸릴 수 있어요.</p>
      </section>
    );
  }

  if (!cancelEligible) {
    if (!cancelBlockReason) return null;
    return (
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[13px] text-slate-600">
          주문 취소: {cancelBlockReason}
        </p>
      </section>
    );
  }

  const onCancel = async () => {
    if (busy) return;
    const ok = window.confirm(
      "주문을 취소할까요?\n\n1) 유심사 eSIM 발급 취소(문자·QR로 받은 eSIM도 사용 불가)\n2) 카드 결제 전액 환불\n\n데이터를 사용하지 않았으면 취소할 수 있습니다. 이미 데이터를 사용한 경우에는 취소할 수 없습니다.",
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bongsim/orders/${encodeURIComponent(orderId)}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "고객 주문 취소" }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !j.ok) {
        setErr(refundErrorMessage(j));
        return;
      }
      setDone(true);
      if (onSuccess) onSuccess();
      else router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "취소 요청에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <h2 className="text-[14px] font-semibold text-amber-950">
        {showHeading ? "주문 취소·환불" : "주문 취소"}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-amber-900">
        유심사 eSIM 발급을 취소한 뒤 카드 결제를 전액 환불합니다. 문자·QR로 받은 eSIM도 설치·사용이
        불가해집니다. 데이터를 사용하지 않았을 때만 취소할 수 있습니다.
      </p>
      {err ? <p className="mt-2 text-[13px] text-red-700">{err}</p> : null}
      <button
        type="button"
        onClick={() => void onCancel()}
        disabled={busy}
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-[14px] font-bold text-amber-950 enabled:hover:bg-amber-100 disabled:opacity-60"
      >
        {busy ? "취소 처리 중…" : "주문 취소 및 환불"}
      </button>
    </section>
  );
}
