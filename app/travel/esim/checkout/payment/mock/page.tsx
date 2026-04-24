import Link from "next/link";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from "@/lib/bongsim/constants";
import { completeMockPaymentForm } from "@/lib/bongsim/checkout/complete-mock-payment-action";
import { isMockPaymentCaptureAllowed } from "@/lib/bongsim/runtime/mock-payment-allowance";

type Props = { searchParams: { paymentAttemptId?: string; orderId?: string; ref?: string } };

export default async function MockPaymentPage({ searchParams }: Props) {
  const q = searchParams;
  const paymentAttemptId = (q.paymentAttemptId ?? "").trim();
  const orderId = (q.orderId ?? "").trim();
  const devOnly = isMockPaymentCaptureAllowed();

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">테스트 결제 (mock)</h1>
        {!devOnly ? (
          <p className="mt-3 text-sm text-slate-600">이 환경에서는 mock 결제 완료를 사용할 수 없습니다.</p>
        ) : !paymentAttemptId || !orderId ? (
          <p className="mt-3 text-sm text-slate-600">결제 세션 정보가 없습니다.</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              실제 PG가 아닙니다. 아래 버튼은 개발용으로만 웹훅을 보내 결제 확정을 시뮬레이션합니다.
            </p>
            <form action={completeMockPaymentForm} className="mt-6 space-y-4">
              <input type="hidden" name="paymentAttemptId" value={paymentAttemptId} />
              <input type="hidden" name="orderId" value={orderId} />
              <button
                type="submit"
                className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
              >
                테스트 결제 완료 (웹훅 캡처)
              </button>
            </form>
          </>
        )}
        <Link
          href={orderId ? bongsimPath(`/checkout/return/cancel?orderId=${encodeURIComponent(orderId)}`) : bongsimPath("/checkout")}
          className="mt-6 inline-block text-sm text-slate-600 underline"
        >
          취소하고 돌아가기
        </Link>
      </main>
      </div>
    </div>
  );
}
