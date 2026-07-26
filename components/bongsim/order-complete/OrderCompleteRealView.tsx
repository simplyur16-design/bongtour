import Link from "next/link";
import { bongsimPath } from "@/lib/bongsim/constants";
import type { BongsimOrderPublicV1 } from "@/lib/bongsim/contracts/order-public.v1";
import { EsimInstallSection } from "@/components/bongsim/order-complete/EsimInstallSection";
import { EsimTravelerVerificationCallout } from "@/components/bongsim/esim/EsimTravelerVerificationCallout";
import { OrderCompleteRefundActions } from "@/components/bongsim/order-complete/OrderCompleteRefundActions";

function formatKrw(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function orderStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "결제 완료";
    case "delivered":
      return "발급 완료";
    case "refund_requested":
      return "환불 처리 중";
    case "refunded":
      return "환불 완료";
    case "awaiting_payment":
      return "결제 대기";
    default:
      return "처리 중";
  }
}

function fulfillmentStatusLabel(status: string): string {
  switch (status) {
    case "delivered":
      return "발급 완료";
    case "failed":
      return "발급 실패";
    case "submitted":
    case "acknowledged":
    case "profile_issued":
    case "in_progress":
    case "queued":
      return "발급 준비 중";
    default:
      return "처리 중";
  }
}

function nextStepMessage(o: BongsimOrderPublicV1): string {
  if (o.status === "awaiting_payment") return "결제가 완료되면 이 페이지를 새로고침해 주세요.";
  if (o.status === "refund_requested") {
    return "카드 취소·환불을 처리하고 있습니다. 완료되면 이 페이지에 반영됩니다.";
  }
  if (o.status === "refunded") {
    return "주문이 취소(환불)되었습니다. 문자·QR로 받은 eSIM은 더 이상 사용할 수 없습니다.";
  }
  if (o.status !== "paid" && o.status !== "delivered") return "주문 상태를 확인해 주세요.";
  if (!o.fulfillment) return "배송 준비 중입니다.";
  if (o.fulfillment.status === "delivered") return "eSIM이 발급되었습니다. 이메일 또는 설치 안내를 확인해 주세요.";
  if (o.fulfillment.status === "failed") return "발급에 문제가 발생했습니다. 고객센터로 문의해 주세요.";
  return "eSIM을 준비하고 있습니다.";
}

export function OrderCompleteRealView({ order }: { order: BongsimOrderPublicV1 }) {
  return (
    <div className="space-y-4 pb-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[12px] font-medium text-slate-500">주문번호</p>
        <p className="text-[18px] font-semibold text-slate-900">{order.order_number}</p>
        <p className="mt-2 text-[13px] text-slate-600">연락처 {order.buyer_email_masked}</p>
        <p className="mt-3 text-[20px] font-semibold text-slate-900">{formatKrw(order.grand_total_krw)}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-semibold text-slate-900">결제</h2>
        <dl className="mt-2 space-y-2 text-[13px] text-slate-700">
          <div className="flex justify-between gap-4">
            <dt>상태</dt>
            <dd className="font-medium">{orderStatusLabel(order.status)}</dd>
          </div>
          {order.paid_at ? (
            <div className="flex justify-between gap-4">
              <dt>결제일시</dt>
              <dd>{order.paid_at}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-semibold text-slate-900">상품</h2>
        <ul className="mt-2 space-y-3">
          {order.lines.map((l, i) => (
            <li key={`${l.option_api_id}-${i}`} className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-800">
              <p className="font-semibold">{l.plan_name}</p>
              <p className="mt-0.5 text-slate-600">{l.option_label}</p>
              <p className="mt-1 text-slate-700">
                수량 {l.quantity} · {formatKrw(l.line_total_krw)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
        <h2 className="text-[14px] font-semibold text-teal-950">다음 단계</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-teal-900">{nextStepMessage(order)}</p>
      </section>

      {order.fulfillment ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-[14px] font-semibold text-slate-900">발급 상태</h2>
          <dl className="mt-2 space-y-2 text-[13px] text-slate-700">
            <div className="flex justify-between gap-4">
              <dt>진행</dt>
              <dd className="font-medium">{fulfillmentStatusLabel(order.fulfillment.status)}</dd>
            </div>
            {order.fulfillment.delivered_at ? (
              <div className="flex justify-between gap-4">
                <dt>발급 완료</dt>
                <dd>{order.fulfillment.delivered_at}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <OrderCompleteRefundActions
        orderId={order.order_id}
        cancelEligible={order.cancel_eligible}
        cancelBlockReason={order.cancel_block_reason}
        orderStatus={order.status}
      />

      <EsimInstallSection install={order.esim_install} installs={order.esim_installs} />

      {order.requires_traveler_verification && order.traveler_verification_iccid ? (
        <EsimTravelerVerificationCallout iccid={order.traveler_verification_iccid} />
      ) : null}

      <Link href={bongsimPath()} className="inline-block text-[13px] text-teal-800 underline">
        홈으로
      </Link>
    </div>
  );
}
