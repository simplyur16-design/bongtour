"use client";

import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResultInner() {
  const sp = useSearchParams();
  const statusRaw = (sp?.get("status") ?? "").trim().toLowerCase();
  const orderId = (sp?.get("orderId") ?? "").trim();
  const message = (sp?.get("message") ?? "").trim();

  const esimMainHref = bongsimPath();
  const checkoutRetryHref = bongsimPath("/checkout");
  const successFlowHref = orderId
    ? bongsimPath(`/checkout/return/success?orderId=${encodeURIComponent(orderId)}`)
    : bongsimPath("/checkout/return/success");

  const isCancel = statusRaw === "cancel";
  const isFail = statusRaw === "fail";
  const isSuccess = statusRaw === "success";

  return (
    <div className="min-h-screen bg-sky-50">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6 lg:max-w-xl lg:py-14">
        <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-md ring-1 ring-teal-50/80 sm:p-8">
          {isCancel ? (
            <>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">결제 취소</h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                결제가 취소되었습니다. 다시 시도하시려면 아래 버튼을 눌러주세요.
              </p>
              {orderId ? (
                <p className="mt-3 break-all text-xs font-mono text-slate-500">주문 ID: {orderId}</p>
              ) : null}
              <Link
                href={esimMainHref}
                className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 sm:text-base"
              >
                eSIM 메인으로
              </Link>
            </>
          ) : null}

          {isFail ? (
            <>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">결제 실패</h1>
              <p className="mt-4 text-sm font-medium text-slate-800 sm:text-base">결제에 실패했습니다.</p>
              {message ? (
                <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                  {message}
                </p>
              ) : null}
              {orderId ? (
                <p className="mt-3 break-all text-xs font-mono text-slate-500">주문 ID: {orderId}</p>
              ) : null}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={checkoutRetryHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 sm:text-base"
                >
                  다시 시도
                </Link>
                <Link
                  href={esimMainHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-teal-200 bg-white px-5 text-sm font-semibold text-teal-900 transition hover:bg-teal-50 sm:text-base"
                >
                  eSIM 메인
                </Link>
              </div>
            </>
          ) : null}

          {isSuccess ? (
            <>
              <h1 className="text-lg font-bold text-teal-900 sm:text-xl">결제 완료</h1>
              <p className="mt-4 text-sm font-semibold text-slate-800 sm:text-base">결제가 완료되었습니다!</p>
              {orderId ? (
                <p className="mt-3 break-all text-xs font-mono text-slate-600 sm:text-sm">주문 ID: {orderId}</p>
              ) : null}
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                주문 처리 상태를 확인한 뒤 완료 페이지로 이동할 수 있어요. 이메일로 안내가 갈 수 있습니다.
              </p>
              <Link
                href={successFlowHref}
                className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 sm:text-base"
              >
                주문 확인하기
              </Link>
              <Link
                href={esimMainHref}
                className="mt-4 block text-center text-sm font-medium text-teal-800 underline underline-offset-2 hover:text-teal-950"
              >
                eSIM 메인으로
              </Link>
            </>
          ) : null}

          {!isCancel && !isFail && !isSuccess ? (
            <>
              <h1 className="text-lg font-bold text-slate-900">알 수 없는 상태</h1>
              <p className="mt-3 text-sm text-slate-600">결제 결과 정보가 없거나 올바르지 않습니다.</p>
              <Link
                href={esimMainHref}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800"
              >
                eSIM 메인으로
              </Link>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-sky-50 text-sm text-slate-600">
          불러오는 중…
        </div>
      }
    >
      <ResultInner />
    </Suspense>
  );
}
