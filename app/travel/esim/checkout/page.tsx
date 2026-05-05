import { Suspense } from 'react'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { CheckoutStoreClient } from '@/components/bongsim/checkout-store/CheckoutStoreClient'

type Props = { searchParams: Promise<{ optionApiId?: string; qty?: string }> }

function parseQtyInitial(raw: string | undefined): number | undefined {
  const n = Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > 99) return undefined
  return n
}

export default async function CheckoutPage({ searchParams }: Props) {
  const q = await searchParams
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
          <CheckoutStoreClient
            optionApiIdInitial={(q.optionApiId ?? '').trim()}
            quantityInitial={parseQtyInitial(q.qty)}
          />
        </div>
      </Suspense>
    </div>
  )
}
