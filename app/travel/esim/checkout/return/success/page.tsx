"use client";

import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { bongsimPath } from "@/lib/bongsim/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { BongsimOrderPublicV1 } from "@/lib/bongsim/contracts/order-public.v1";

function SuccessInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const orderId = (sp?.get("orderId") ?? "").trim();
  const readKey = (sp?.get("read_key") ?? "").trim();
  const readKeyQuery = readKey ? `?read_key=${encodeURIComponent(readKey)}` : "";
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let n = 0;
    const tick = async () => {
      if (stopped.current) return;
      n += 1;
      if (n > 90) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        queueMicrotask(() =>
          setError("확인에 시간이 오래 걸리고 있어요. 잠시 후에도 같으면 고객센터로 문의해 주세요."),
        );
        return;
      }
      try {
        const res = await fetch(`/api/bongsim/orders/${encodeURIComponent(orderId)}${readKeyQuery}`, { cache: "no-store" });
        if (!res.ok) {
          queueMicrotask(() => setStatus("조회 실패"));
          return;
        }
        const o = (await res.json()) as BongsimOrderPublicV1;
        if (o.schema !== "bongsim.order_public.v1") return;
        queueMicrotask(() => setStatus(o.status));
        if (o.status === "paid") {
          stopped.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.replace(bongsimPath(`/order/${encodeURIComponent(orderId)}/complete${readKeyQuery}`));
        }
      } catch {
        queueMicrotask(() => setStatus("일시적 오류"));
      }
    };
    void tick();
    intervalRef.current = setInterval(() => void tick(), 2000);
    return () => {
      stopped.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId, readKeyQuery, router]);

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-lg px-4 py-8">
        <h1 className="text-lg font-semibold text-slate-900">결제 확인 중</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          결제가 정상적으로 반영됐는지 확인하고 있어요. 잠시만 기다려 주세요. 완료되면 자동으로 다음 화면으로 이동합니다.
        </p>
        {!orderId ? (
          <p className="mt-4 text-sm text-red-700">주문 정보(orderId)가 없습니다.</p>
        ) : (
          <p className="mt-2 text-xs font-mono text-slate-500">
            주문 ID: {orderId}
            {status ? ` · 상태: ${status}` : ""}
          </p>
        )}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <Link href={bongsimPath()} className="mt-8 inline-block text-sm text-teal-800 underline">
          eSIM 메인
        </Link>
      </main>
      </div>
    </div>
  );
}

export default function CheckoutReturnSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bt-page">
          <Header />
          <OverseasTravelSubMainNav variant="links" />
          <div className="min-h-full bg-slate-50 p-6 text-sm">불러오는 중…</div>
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
