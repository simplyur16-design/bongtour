import Link from "next/link";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from '@/lib/bongsim/constants'
import { notFound } from "next/navigation";
import { OrderCompleteRealView } from "@/components/bongsim/order-complete/OrderCompleteRealView";
import { getOrderPublic } from "@/lib/bongsim/data/get-order-public";

type Props = { params: { orderId: string }; searchParams: { read_key?: string } };

export default async function OrderCompletePage({ params, searchParams }: Props) {
  const { orderId } = params;
  const sp = searchParams;
  const res = await getOrderPublic(orderId, { readKey: sp.read_key ?? null });

  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    if (res.reason === "read_key_required" || res.reason === "read_key_invalid") notFound();
    return (
      <div className="min-h-screen bg-bt-page">
        <Header />
        <OverseasTravelSubMainNav variant="links" />
        <div className="min-h-full bg-slate-50">
        <main className="mx-auto max-w-lg px-4 py-10">
          <p className="text-sm text-slate-700">
            {res.reason === "db_unconfigured" ? "DATABASE_URL이 설정되지 않았습니다." : "주문을 불러오지 못했습니다."}
          </p>
          <Link href={bongsimPath()} className="mt-4 inline-block text-sm text-teal-800 underline">
            홈으로
          </Link>
        </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
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
      </main>
      </div>
    </div>
  );
}
