"use client";

import type { TossPaymentsPayment } from "@tosspayments/tosspayments-sdk";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

/**
 * 토스페이먼츠 V2 SDK — 결제창(Payment Window) + API 개별 연동 클라이언트 키(test_ck_ / live_ck_).
 *
 * 결제위젯 연동 키(test_gck_ 등)는 `widgets()` 전용이라 사용하지 않는다.
 * `loadTossPayments(NEXT_PUBLIC_TOSS_CLIENT_KEY)` → `payment({ customerKey: ANONYMOUS })` →
 * `requestPayment({ method: "CARD", ... })` 흐름만 사용한다.
 *
 * 쿼리: paymentAttemptId, orderId, tossOrderId, amount, orderName, customerEmail(선택).
 *
 * 모드:
 *   1) paymentKey 없음: 요약 UI + 결제하기 → 결제창
 *   2) paymentKey 있음(성공 리다이렉트): 기존과 동일하게 서버 confirm 후 success/fail 이동
 */

function TossPaymentContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const paymentAttemptId = sp?.get("paymentAttemptId") ?? "";
  const orderId = sp?.get("orderId") ?? "";
  const tossOrderId = sp?.get("tossOrderId") ?? "";
  const orderName = sp?.get("orderName") ?? "Bong투어 eSIM";
  const customerEmail = sp?.get("customerEmail") ?? "";
  const amountStr = sp?.get("amount") ?? "";
  const amount = Number.parseInt(amountStr, 10);

  const paymentKey = sp?.get("paymentKey") ?? "";
  const successAmountStr = sp?.get("amount") ?? "";
  const successAmount = Number.parseInt(successAmountStr, 10);

  const isSuccessCallback = paymentKey.length > 0;

  const [phase, setPhase] = useState<"loading" | "ready" | "confirming" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const paymentRef = useRef<TossPaymentsPayment | null>(null);

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
            orderId: tossOrderId || orderId,
            amount: Number.isFinite(successAmount) ? successAmount : amount,
            paymentAttemptId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          const msg = data?.message || data?.error || "결제 승인에 실패했어요.";
          router.replace(
            `${bongsimPath("/checkout/return/fail")}?orderId=${encodeURIComponent(orderId)}&reason=${encodeURIComponent(msg)}`,
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
        const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
        if (cancelled) return;

        const tossPayments = await loadTossPayments(clientKey);
        if (cancelled) return;

        const payment = tossPayments.payment({ customerKey: ANONYMOUS });
        paymentRef.current = payment;

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
    const payment = paymentRef.current;
    if (!payment || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}${window.location.pathname}${window.location.search}`;
      const failUrl = `${origin}${bongsimPath("/checkout/return/fail")}`;

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: amount },
        orderId: tossOrderId,
        orderName,
        successUrl,
        failUrl,
        ...(customerEmail ? { customerEmail } : {}),
      });
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
            {isSuccessCallback ? "결제 확인 중이에요" : "신용카드 결제"}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            {isSuccessCallback
              ? "잠시만 기다려 주세요. Bong투어와 토스페이먼츠가 결제 내역을 확인하고 있어요."
              : "아래 정보를 확인한 뒤 결제하기를 누르면 토스페이먼츠 결제창이 열려요."}
          </p>

          {isSuccessCallback ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-16 shadow-sm">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent"
                aria-hidden
              />
              <p className="mt-5 text-[13px] text-slate-600">결제를 확정하고 있어요…</p>
            </div>
          ) : null}

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

          {!isSuccessCallback ? (
            <div className={phase === "loading" ? "mt-8 animate-pulse space-y-4" : "mt-8 space-y-4"}>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">결제 요약</p>
                <div className="mt-3 flex items-center justify-between text-[14px]">
                  <span className="text-slate-600">결제 금액</span>
                  <span className="text-lg font-bold text-slate-900">
                    {Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}원` : "-"}
                  </span>
                </div>
                {orderName ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-[13px]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="shrink-0 text-slate-600">주문명</span>
                      <span className="text-right font-medium text-slate-900">{orderName}</span>
                    </div>
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

export default function TossPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bt-page text-sm text-slate-600">
          결제 처리 중...
        </div>
      }
    >
      <TossPaymentContent />
    </Suspense>
  );
}
