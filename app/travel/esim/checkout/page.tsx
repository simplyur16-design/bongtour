import { Suspense } from "react";
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { CheckoutStoreClient } from "@/components/bongsim/checkout-store/CheckoutStoreClient";

type Props = { searchParams: { optionApiId?: string; qty?: string } };

function parseQtyInitial(raw: string | undefined): number | undefined {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return undefined;
  return n;
}

async function CheckoutInner({ searchParams }: Props) {
  const q = searchParams;
  return (
    <CheckoutStoreClient
      optionApiIdInitial={(q.optionApiId ?? "").trim()}
      quantityInitial={parseQtyInitial(q.qty)}
    />
  );
}

export default function CheckoutPage(props: Props) {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <Suspense
        fallback={
          <div className="mx-auto min-h-full w-full max-w-3xl bg-slate-50 p-6 text-center text-sm text-slate-600">
            로딩…
          </div>
        }
      >
        <div className="mx-auto w-full max-w-3xl">
          <CheckoutInner {...props} />
        </div>
      </Suspense>
    </div>
  );
}
