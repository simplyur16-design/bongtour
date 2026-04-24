"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

/**
 * 토스페이먼츠 결제창 페이지.
 *
 * 2가지 모드로 동작:
 *   1. 초기 진입 (URL에 paymentKey 없음): 토스 위젯 렌더링 + 결제 버튼
 *   2. successUrl 콜백 (URL에 paymentKey·amount 붙어있음): 서버 confirm 호출 → success/fail 페이지로 리다이렉트
 *
 * 실패/취소 시에는 토스가 failUrl로 보내므로 이 페이지는 paymentKey 보유 케이스만 처리.
 */

declare global {
  interface Window {
    TossPayments?: unknown;
  }
}

type WidgetsInstance = {
  setAmount: (args: { currency: "KRW"; value: number }) => Promise<void>;
  renderPaymentMethods: (args: { selector: string; variantKey?: string }) => Promise<unknown>;
  renderAgreement: (args: { selector: string; variantKey?: string }) => Promise<unknown>;
  requestPayment: (args: {
    orderId: string;
    orderName: string;
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
  }) => Promise<void>;
};

type TossPaymentsInstance = {
  widgets: (args: { customerKey: string }) => WidgetsInstance;
};

export default function TossCheckoutPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const paymentAttemptId = sp?.get("paymentAttemptId") ?? "";
  const orderId = sp?.get("orderId") ?? "";
  const tossOrderId = sp?.get("tossOrderId") ?? "";
  const orderName = sp?.get("orderName") ?? "Bong투어 eSIM";
  const customerEmail = sp?.get("customerEmail") ?? "";
  const amountStr = sp?.get("amount") ?? "";
  const amount = Number.parseInt(amountStr, 10);

  // success 콜백에서 토스가 붙여주는 값
  const paymentKey = sp?.get("paymentKey") ?? "";
  const successAmountStr = sp?.get("successAmount") ?? sp?.get("amount") ?? "";
  const successAmount = Number.parseInt(successAmountStr, 10);

  const isSuccessCallback = paymentKey.length > 0;

  const [phase, setPhase] = useState<"loading" | "ready" | "confirming" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const widgetsRef = useRef<WidgetsInstance | null>(null);

  /* 성공 콜백 모드 ---------------------------------------------------------- */
  useEffect(() => {
    if (!isSuccessCallback) return;
    if (phase !== "loading" && phase !== "confirming") return;

    (async () => {
      setPhase("confirming");
      try {
        const res = await fetch("/api/bongsim/payments/toss/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey,
            orderId: tossOrderId || orderId, // 토스에서 받은 orderId (= tossOrderId) 우선
            amount: Number.isFinite(successAmount) ? successAmount : amount,
            paymentAttemptId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const msg = data?.message || data?.error || "결제 승인에 실패했어요.";
          router.replace(
            `${bongsimPath(
              "/checkout/return/fail",
            )}?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(msg)}`,
          );
          return;
        }
        router.replace(`${bongsimPath("/checkout/return/success")}?orderId=${encodeURIComponent(orderId)}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown_error";
        router.replace(
          `${bongsimPath("/checkout/return/fail")}?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(msg)}`,
        );
      }
    })();
  }, [isSuccessCallback, phase, paymentKey, tossOrderId, orderId, successAmount, amount, paymentAttemptId, router]);

  /* 초기 진입 (위젯 렌더링) 모드 --------------------------------------------- */
  useEffect(() => {
    if (isSuccessCallback) return;
    if (!paymentAttemptId || !orderId || !tossOrderId || !Number.isFinite(amount) || amount <= 0) {
      setPhase("error");
      setErrorMsg("결제 세션 정보가 올바르지 않아요. 장바구니로 돌아가 다시 시도해 주세요.");
      return;
    }

    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      setPhase("error");
      setErrorMsg("결제 설정이 완료되지 않았어요. 고객센터로 문의해 주세요. (client_key missing)");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // @tosspayments/tosspayments-sdk v2 동적 import (클라이언트 전용)
        const mod = await import("@tosspayments/tosspayments-sdk");
        if (cancelled) return;
        const { loadTossPayments, ANONYMOUS } = mod as {
          loadTossPayments: (key: string) => Promise<TossPaymentsInstance>;
          ANONYMOUS: string;
        };

        const tossPayments = await loadTossPayments(clientKey);
        if (cancelled) return;

        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: "KRW", value: amount });
        await widgets.renderPaymentMethods({ selector: "#toss-payment-method", variantKey: "DEFAULT" });
        await widgets.renderAgreement({ selector: "#toss-agreement", variantKey: "AGREEMENT" });

        if (!cancelled) setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(e instanceof Error ? e.message : "결제창을 불러오지 못했어요.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    const widgets = widgetsRef.current;
    if (!widgets || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const origin = window.location.origin;
      const successParams = new URLSearchParams({
        paymentAttemptId,
        orderId,
        tossOrderId,
      });
      const failParams = new URLSearchParams({
        orderId,
      });
      await widgets.requestPayment({
        orderId: tossOrderId,
        orderName,
        successUrl: `${origin}${bongsimPath("/checkout/payment/toss")}?${successParams.toString()}`,
        failUrl: `${origin}${bongsimPath("/checkout/return/fail")}?${failParams.toString()}`,
        customerEmail: customerEmail || undefined,
      });
      // requestPayment가 성공하면 브라우저가 토스 창으로 이동. 이후 successUrl로 복귀.
    } catch (e) {
      setIsSubmitting(false);
      setErrorMsg(e instanceof Error ? e.message : "결제 요청에 실패했어요.");
    }
  };

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:pb-28 lg:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700">결제</p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
            {isSuccessCallback ? "결제 확인 중이에요" : "결제 수단 선택"}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            {isSuccessCallback
              ? "잠시만 기다려 주세요. Bong투어와 토스페이먼츠가 결제 내역을 확인하고 있어요."
              : "안전한 토스페이먼츠 결제창에서 원하는 결제 수단을 선택해 주세요."}
          </p>

          {/* 성공 콜백 모드 */}
          {isSuccessCallback ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-16 shadow-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" aria-hidden />
              <p className="mt-5 text-[13px] text-slate-600">결제를 확정하고 있어요…</p>
            </div>
          ) : null}

          {/* 에러 */}
          {phase === "error" && !isSuccessCallback ? (
            <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50/70 p-5 text-[13px] text-orange-900">
              <p className="font-bold">결제를 시작할 수 없어요</p>
              <p className="mt-1.5 leading-relaxed">{errorMsg}</p>
              <Link
                href={bongsimPath("/checkout")}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-[13px] font-bold text-orange-900 ring-1 ring-orange-200 hover:bg-orange-100"
              >
                장바구니로 돌아가기
              </Link>
            </div>
          ) : null}

          {/* 결제창 위젯 */}
          {!isSuccessCallback ? (
            <div className={phase === "loading" ? "mt-8 animate-pulse space-y-4" : "mt-8 space-y-4"}>
              <div
                id="toss-payment-method"
                className="min-h-[360px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              />
              <div
                id="toss-agreement"
                className="min-h-[80px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              />

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-[13px] text-slate-700">
                <div className="flex items-center justify-between">
                  <span>결제 금액</span>
                  <span className="text-base font-bold text-slate-900">
                    {Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}원` : "-"}
                  </span>
                </div>
                {orderName ? (
                  <div className="mt-1.5 flex items-center justify-between text-[12px] text-slate-500">
                    <span>주문명</span>
                    <span className="max-w-[60%] truncate text-right">{orderName}</span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handlePay}
                disabled={phase !== "ready" || isSubmitting}
                className="mt-2 flex min-h-[3.35rem] w-full items-center justify-center rounded-2xl bg-teal-700 px-6 text-[15px] font-bold text-white shadow-md transition enabled:hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {phase === "ready"
                  ? isSubmitting
                    ? "결제창 여는 중…"
                    : "결제하기"
                  : phase === "loading"
                  ? "결제창 준비 중…"
                  : "결제 불가"}
              </button>

              <p className="text-center text-[11.5px] leading-relaxed text-slate-500">
                결제 진행은 토스페이먼츠가 안전하게 처리해요. 결제 완료 후 이메일로 QR코드를 보내드려요.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
