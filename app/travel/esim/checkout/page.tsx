import { Suspense } from "react";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { CheckoutStoreClient } from "@/components/bongsim/checkout-store/CheckoutStoreClient";

type Props = { searchParams: { optionApiId?: string } };

async function CheckoutInner({ searchParams }: Props) {
  const q = searchParams;
  return <CheckoutStoreClient optionApiIdInitial={(q.optionApiId ?? "").trim()} />;
}

export default function CheckoutPage(props: Props) {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <Suspense fallback={<div className="min-h-full bg-slate-50 p-6 text-sm text-slate-600">로딩…</div>}>
        <CheckoutInner {...props} />
      </Suspense>
    </div>
  );
}
