"use client";

/**
 * REGRESSION-FREEZE[bongsim-order-complete-client-retry]: Kakao QR 버튼 SSR db_error 시
 * 클라이언트에서 주문 API 재시도 → 설치 UI 복구 — manifest
 */
import { useEffect, useState } from "react";
import type { BongsimOrderPublicV1 } from "@/lib/bongsim/contracts/order-public.v1";
import { OrderCompleteRealView } from "@/components/bongsim/order-complete/OrderCompleteRealView";
import { TestModeCompleteModal } from "@/components/bongsim/checkout-store/TestModeCompleteModal";

const MAX_ATTEMPTS = 6;
const GAP_MS = 1200;

export function OrderCompleteClientRetry({
  orderId,
  readKey,
}: {
  orderId: string;
  readKey?: string | null;
}) {
  const [order, setOrder] = useState<BongsimOrderPublicV1 | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [busy, setBusy] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const load = async (n: number) => {
      if (cancelled) return;
      setBusy(true);
      setAttempt(n);
      try {
        const q = new URLSearchParams();
        if (readKey?.trim()) q.set("read_key", readKey.trim());
        const qs = q.toString();
        const res = await fetch(
          `/api/bongsim/orders/${encodeURIComponent(orderId)}${qs ? `?${qs}` : ""}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as BongsimOrderPublicV1 & { error?: string };
        if (cancelled) return;
        if (res.ok && json?.schema === "bongsim.order_public.v1" && json.order_id) {
          setOrder(json);
          setBusy(false);
          setExhausted(false);
          return;
        }
      } catch {
        /* retry */
      }
      if (cancelled) return;
      if (n >= MAX_ATTEMPTS) {
        setBusy(false);
        setExhausted(true);
        return;
      }
      timer = window.setTimeout(() => {
        void load(n + 1);
      }, GAP_MS);
    };

    setOrder(null);
    setExhausted(false);
    void load(1);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId, readKey, nonce]);

  if (order) {
    return (
      <>
        <OrderCompleteRealView order={order} />
        <TestModeCompleteModal />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
      {exhausted ? (
        <>
          <p className="font-medium">주문을 잠시 불러오지 못했습니다.</p>
          <p className="mt-2 text-[13px] text-amber-900/90">
            카톡에서 연 설치 페이지입니다. 아래 버튼으로 다시 불러오면 QR·아이폰·안드로이드 설치 버튼을 사용할 수 있습니다.
          </p>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-[13px] font-semibold text-white"
            onClick={() => {
              setBusy(true);
              setAttempt(0);
              setNonce((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        </>
      ) : (
        <>
          <p className="font-medium">설치 정보를 불러오는 중…</p>
          <p className="mt-1 text-[13px] text-amber-900/80">
            {busy ? `잠시만 기다려 주세요 (${attempt}/${MAX_ATTEMPTS})` : "재시도 중…"}
          </p>
        </>
      )}
    </div>
  );
}
