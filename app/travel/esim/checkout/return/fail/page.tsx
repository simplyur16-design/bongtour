"use client";

import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from "@/lib/bongsim/constants";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FailInner() {
  const sp = useSearchParams();
  const orderId = (sp?.get("orderId") ?? "").trim();
  const optionApiId = (sp?.get("optionApiId") ?? "").trim();
  const reason = (sp?.get("reason") ?? "").trim();

  const retryHref =
    optionApiId && orderId
      ? bongsimPath(`/checkout?optionApiId=${encodeURIComponent(optionApiId)}`)
      : optionApiId
        ? bongsimPath(`/checkout?optionApiId=${encodeURIComponent(optionApiId)}`)
        : bongsimPath("/checkout");

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">?? ??</h1>
        <p className="mt-3 text-sm text-slate-600">
          ??? ???? ?????. ?? ???? ?? ??? ????? ?? ??? ?? ?? ???.
        </p>
        {reason ? <p className="mt-2 text-xs font-mono text-slate-500">??: {reason}</p> : null}
        {orderId ? <p className="mt-2 text-xs font-mono text-slate-500">?? ID: {orderId}</p> : null}
        <Link href={retryHref} className="mt-6 inline-block rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">
          ?? ??
        </Link>
        <Link href={bongsimPath()} className="mt-4 block text-sm text-teal-800 underline">
          ???
        </Link>
      </main>
      </div>
    </div>
  );
}

export default function CheckoutReturnFailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <OverseasTravelSubMainNav variant="links" />
          <div className="min-h-full bg-slate-50 p-6 text-sm">???</div>
        </div>
      }
    >
      <FailInner />
    </Suspense>
  );
}
