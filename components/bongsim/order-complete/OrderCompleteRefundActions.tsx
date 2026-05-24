"use client";

import { refundErrorMessage } from "@/lib/bongsim/refund/refund-error-message";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  cancelEligible: boolean;
  cancelBlockReason: string | null;
  orderStatus: string;
};

export function OrderCompleteRefundActions({
  orderId,
  cancelEligible,
  cancelBlockReason,
  orderStatus,
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
      "주문을 취소하고 결제 금액을 환불할까요?\neSIM이 아직 발급되지 않은 경우에만 가능합니다.",
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
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "취소 요청에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
      <h2 className="text-[14px] font-semibold text-amber-950">주문 취소</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-amber-900">
        eSIM이 아직 발급되지 않았다면 결제를 취소(전액 환불)할 수 있어요. 발급이 완료된 뒤에는 취소할 수 없습니다.
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
