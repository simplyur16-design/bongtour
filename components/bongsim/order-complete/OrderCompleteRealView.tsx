import Link from "next/link";
import { bongsimPath } from '@/lib/bongsim/constants'
import type { BongsimOrderPublicV1 } from "@/lib/bongsim/contracts/order-public.v1";

function formatKrw(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function nextStepMessage(o: BongsimOrderPublicV1): string {
  if (o.status === "awaiting_payment") return "결제가 완료되면 이 페이지를 새로고침해 주세요.";
  if (o.status !== "paid") return "주문 상태를 확인해 주세요.";
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
            <dd className="font-medium">{order.status}</dd>
          </div>
          {order.paid_at ? (
            <div className="flex justify-between gap-4">
              <dt>결제일시</dt>
              <dd>{order.paid_at}</dd>
            </div>
          ) : null}
          {order.payment_reference ? (
            <div className="flex justify-between gap-4">
              <dt>결제 참조</dt>
              <dd className="break-all font-mono text-[12px]">{order.payment_reference}</dd>
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
              <dd className="font-medium">{order.fulfillment.status}</dd>
            </div>
            {order.fulfillment.supplier_submission_id ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-slate-500">공급 접수 ID</dt>
                <dd className="break-all font-mono text-[12px]">{order.fulfillment.supplier_submission_id}</dd>
              </div>
            ) : null}
            {order.fulfillment.delivered_at ? (
              <div className="flex justify-between gap-4">
                <dt>발급 완료</dt>
                <dd>{order.fulfillment.delivered_at}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <h2 className="text-[13px] font-semibold text-slate-800">{order.install_stub.label}</h2>
        {order.install_stub.href ? (
          <Link href={order.install_stub.href} className="mt-2 inline-block text-[13px] text-teal-800 underline">
            열기
          </Link>
        ) : (
          <p className="mt-2 text-[12px] text-slate-500">설치 URL은 추후 연결됩니다.</p>
        )}
      </section>

      <Link href={bongsimPath()} className="inline-block text-[13px] text-teal-800 underline">
        홈으로
      </Link>
    </div>
  );
}
