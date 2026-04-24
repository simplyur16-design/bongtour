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
          setError("?? ?? ??? ???????. ?? ???? ??? ???."),
        );
        return;
      }
      try {
        const res = await fetch(`/api/bongsim/orders/${encodeURIComponent(orderId)}${readKeyQuery}`, { cache: "no-store" });
        if (!res.ok) {
          queueMicrotask(() => setStatus("?? ? ??"));
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
        queueMicrotask(() => setStatus("???? ??"));
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
        <h1 className="text-lg font-semibold text-slate-900">?? ?? ?</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          ???? ?????? ??? ??? ?? ????. ???? ?? ??? ??? ? ???? ?????.
        </p>
        {!orderId ? (
          <p className="mt-4 text-sm text-red-700">orderId? ????.</p>
        ) : (
          <p className="mt-2 text-xs font-mono text-slate-500">
            ?? ID: {orderId}
            {status ? ` ? ??: ${status}` : ""}
          </p>
        )}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <Link href={bongsimPath()} className="mt-8 inline-block text-sm text-teal-800 underline">
          ???
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
          <div className="min-h-full bg-slate-50 p-6 text-sm">???</div>
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
