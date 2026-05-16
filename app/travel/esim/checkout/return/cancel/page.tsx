"use client";

import Header from "@/app/components/Header";
import { bongsimPath } from "@/lib/bongsim/constants";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CancelInner() {
  const sp = useSearchParams();
  const orderNumber = (sp?.get("orderNumber") ?? "").trim();
  const orderNoDisplay = orderNumber || "—";
  const optionApiId = (sp?.get("optionApiId") ?? "").trim();
  const retryHref = optionApiId
    ? bongsimPath(`/checkout?optionApiId=${encodeURIComponent(optionApiId)}`)
    : bongsimPath("/checkout");

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <div className="min-h-full bg-slate-50">
        <main className="mx-auto max-w-lg px-4 py-8">
          <h1 className="text-lg font-semibold text-slate-900">결제 취소</h1>
          <p className="mt-3 text-sm text-slate-600">
            결제를 진행하지 않고 나왔습니다. 계속하시려면 아래에서 다시 시도해 주세요.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            주문번호: <span className="font-mono text-slate-700">{orderNoDisplay}</span>
          </p>
          <Link
            href={retryHref}
            className="mt-6 inline-block rounded-xl border border-transparent bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            장바구니로 돌아가기
          </Link>
          <Link href={bongsimPath()} className="mt-3 block text-sm text-teal-800 underline">
            eSIM 메인
          </Link>
        </main>
      </div>
    </div>
  );
}

export default function CheckoutReturnCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <div className="min-h-full bg-slate-50 p-6 text-sm">불러오는 중…</div>
        </div>
      }
    >
      <CancelInner />
    </Suspense>
  );
}
