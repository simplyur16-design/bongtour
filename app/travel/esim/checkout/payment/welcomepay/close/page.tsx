"use client";

import { bongsimPath } from "@/lib/bongsim/constants";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * PC 결제창 닫기 등으로 진입 시 — 결과 페이지(취소)로 합류.
 * `closeUrl`이 이 경로를 가리키는 구성이면 PG가 넘긴 쿼리를 유지해 전달한다.
 */
function CloseRedirectInner() {
  const router = useRouter();

  useEffect(() => {
    const incoming = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const q = new URLSearchParams();
    q.set("status", "cancel");
    const orderId = (incoming.get("orderId") ?? "").trim();
    if (orderId) q.set("orderId", orderId);
    const message = (incoming.get("message") ?? "").trim();
    if (message) q.set("message", message);
    router.replace(`${bongsimPath("/checkout/payment/result")}?${q.toString()}`);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 text-sm text-slate-600">
      결제 창을 닫는 중…
    </div>
  );
}

export default function WelcomepayClosePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-sky-50 text-sm text-slate-600">
          불러오는 중…
        </div>
      }
    >
      <CloseRedirectInner />
    </Suspense>
  );
}
