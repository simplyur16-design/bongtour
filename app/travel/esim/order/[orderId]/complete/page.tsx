import Link from "next/link";
import Header from '@/app/components/Header'
import { bongsimPath } from '@/lib/bongsim/constants'
import { notFound } from "next/navigation";
import { ClearRecommendFunnelOnMount } from "@/components/bongsim/ClearRecommendFunnelOnMount";
import { OrderCompleteClientRetry } from "@/components/bongsim/order-complete/OrderCompleteClientRetry";
import { OrderCompleteRealView } from "@/components/bongsim/order-complete/OrderCompleteRealView";
import { TestModeCompleteModal } from "@/components/bongsim/checkout-store/TestModeCompleteModal";
import { getOrderPublic } from "@/lib/bongsim/data/get-order-public";

type Props = { params: Promise<{ orderId: string }>; searchParams: Promise<{ read_key?: string }> };

export default async function OrderCompletePage({ params, searchParams }: Props) {
  const { orderId } = await params;
  const sp = await searchParams;
  const readKey = sp.read_key ?? null;
  const res = await getOrderPublic(orderId, { readKey });

  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    if (res.reason === "read_key_required" || res.reason === "read_key_invalid") notFound();
    // REGRESSION-FREEZE[bongsim-order-complete-client-retry]: SSR db_error → 클라이언트 재시도로 설치 UI 복구 — manifest
    return (
      <div className="min-h-screen bg-bt-page">
        <ClearRecommendFunnelOnMount />
        <Header />
        <div className="min-h-full bg-slate-50">
          <main className="mx-auto max-w-lg px-4 pt-3 pb-10 sm:max-w-xl sm:px-6 sm:pt-4">
            <nav className="text-[12px] text-slate-500">
              <Link href={bongsimPath()} className="hover:text-teal-800">
                홈
              </Link>
              <span className="mx-1.5 text-slate-300">/</span>
              <span className="text-slate-800">주문 완료</span>
            </nav>
            <h1 className="mt-3 text-[20px] font-semibold text-slate-900">주문 완료</h1>
            <div className="mt-4">
              {res.reason === "db_unconfigured" ? (
                <p className="text-sm text-slate-700">DATABASE_URL이 설정되지 않았습니다.</p>
              ) : (
                <OrderCompleteClientRetry orderId={orderId} readKey={readKey} />
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <ClearRecommendFunnelOnMount />
      <Header />
      <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-lg px-4 pt-3 pb-10 sm:max-w-xl sm:px-6 sm:pt-4">
        <nav className="text-[12px] text-slate-500">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">주문 완료</span>
        </nav>
        <h1 className="mt-3 text-[20px] font-semibold text-slate-900">주문 완료</h1>
        <div className="mt-4">
          <OrderCompleteRealView order={res.order} />
        </div>
        <TestModeCompleteModal />
      </main>
      </div>
    </div>
  );
}
