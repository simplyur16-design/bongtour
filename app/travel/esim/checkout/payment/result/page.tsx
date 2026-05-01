"use client";

import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath, BONGSIM_KAKAO_CHANNEL_URL } from "@/lib/bongsim/constants";
import { Ban, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function formatAmountKrw(raw: string): string | null {
  const n = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${n.toLocaleString("ko-KR")}원`;
}

function ResultInner() {
  const sp = useSearchParams();
  const statusRaw = (sp?.get("status") ?? "").trim().toLowerCase();
  const orderId = (sp?.get("orderId") ?? "").trim();
  const message = (sp?.get("message") ?? "").trim();
  const amountRaw = (sp?.get("amount") ?? "").trim();
  const orderName = (sp?.get("orderName") ?? "").trim();

  const esimMainHref = bongsimPath();
  const checkoutRetryHref = bongsimPath("/checkout");
  const guideHref = "/travel/esim/guide";

  const isCancel = statusRaw === "cancel";
  const isFail = statusRaw === "fail";
  const isSuccess = statusRaw === "success";
  const amountDisplay = amountRaw ? formatAmountKrw(amountRaw) ?? amountRaw : null;

  const shellMainClass =
    "mx-auto w-full max-w-lg px-4 pb-12 pt-6 sm:px-6 lg:max-w-xl lg:pb-16 lg:pt-8";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      {isSuccess ? (
        <main>
          <section className="bg-gradient-to-br from-emerald-50 to-teal-50 px-4 pb-10 pt-10 text-center sm:pb-12 sm:pt-12">
            <CheckCircle2
              className="mx-auto h-16 w-16 text-emerald-500"
              strokeWidth={1.75}
              aria-hidden
            />
            <h1 className="mt-5 text-2xl font-bold text-slate-900">결제가 완료되었습니다!</h1>
            <p className="mx-auto mt-2 max-w-md text-slate-600">
              eSIM QR코드가 곧 이메일과 카카오톡으로 전송됩니다.
            </p>
          </section>

          <div className={shellMainClass}>
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">주문 정보</h2>
                <dl className="mt-4 space-y-3 text-sm sm:text-base">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                    <dt className="text-slate-500">주문번호</dt>
                    <dd className="break-all font-mono text-slate-900">{orderId || "—"}</dd>
                  </div>
                  {amountDisplay ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                      <dt className="text-slate-500">결제금액</dt>
                      <dd className="font-medium text-slate-900">{amountDisplay}</dd>
                    </div>
                  ) : null}
                  {orderName ? (
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
                      <dt className="text-slate-500">상품명</dt>
                      <dd className="text-right text-slate-900 sm:max-w-[60%] sm:pl-4">{orderName}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">다음 단계</h2>
                <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
                  <li>이메일/카카오톡에서 QR코드를 확인해주세요</li>
                  <li>설정 → 셀룰러 → eSIM 추가에서 QR코드를 스캔하세요</li>
                  <li>여행지 도착 후 eSIM 데이터를 켜주세요</li>
                </ol>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                  href={guideHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-base"
                >
                  eSIM 설치 가이드 보기
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 sm:text-base"
                >
                  홈으로 돌아가기
                </Link>
              </div>

              <p className="text-center text-sm text-slate-400">
                문제가 있으신가요?{" "}
                <a
                  href={BONGSIM_KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline hover:text-teal-700"
                >
                  고객센터 문의
                </a>
              </p>
            </div>
          </div>
        </main>
      ) : null}

      {isCancel ? (
        <main className={shellMainClass}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 px-6 py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/80">
                <Ban className="h-9 w-9 text-slate-600" strokeWidth={1.75} aria-hidden />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-slate-900">결제가 취소되었습니다</h1>
              <p className="mx-auto mt-2 max-w-md text-slate-600">
                결제 창을 닫았거나 취소하신 경우입니다. 다시 결제하시려면 체크아웃으로 이동해 주세요.
              </p>
            </div>
            <div className="border-t border-slate-100 p-5 sm:p-6">
              {orderId ? (
                <p className="break-all text-xs font-mono text-slate-500 sm:text-sm">
                  <span className="font-sans font-medium text-slate-600">주문번호 </span>
                  {orderId}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={checkoutRetryHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-base"
                >
                  다시 결제하기
                </Link>
                <Link
                  href={esimMainHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 sm:text-base"
                >
                  eSIM 메인으로
                </Link>
              </div>
              <p className="mt-6 text-center text-sm text-slate-400">
                문제가 있으신가요?{" "}
                <a
                  href={BONGSIM_KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline hover:text-teal-700"
                >
                  고객센터 문의
                </a>
              </p>
            </div>
          </div>
        </main>
      ) : null}

      {isFail ? (
        <main className={shellMainClass}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 px-6 py-10 text-center">
              <XCircle className="mx-auto h-16 w-16 text-amber-600" strokeWidth={1.75} aria-hidden />
              <h1 className="mt-5 text-2xl font-bold text-slate-900">결제에 실패했습니다</h1>
              <p className="mx-auto mt-2 max-w-md text-slate-600">카드사 또는 결제 환경을 확인한 뒤 다시 시도해 주세요.</p>
            </div>
            <div className="border-t border-slate-100 p-5 sm:p-6">
              {message ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                  {message}
                </div>
              ) : null}
              {orderId ? (
                <p className={`break-all text-xs font-mono text-slate-500 sm:text-sm ${message ? "mt-4" : ""}`}>
                  <span className="font-sans font-medium text-slate-600">주문번호 </span>
                  {orderId}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={checkoutRetryHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-base"
                >
                  다시 시도
                </Link>
                <Link
                  href={esimMainHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 sm:text-base"
                >
                  eSIM 메인으로
                </Link>
              </div>
              <p className="mt-6 text-center text-sm text-slate-400">
                문제가 있으신가요?{" "}
                <a
                  href={BONGSIM_KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline hover:text-teal-700"
                >
                  고객센터 문의
                </a>
              </p>
            </div>
          </div>
        </main>
      ) : null}

      {!isCancel && !isFail && !isSuccess ? (
        <main className={shellMainClass}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 px-6 py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/80">
                <span className="text-2xl font-bold text-slate-600" aria-hidden>
                  ?
                </span>
              </div>
              <h1 className="mt-5 text-2xl font-bold text-slate-900">알 수 없는 상태</h1>
              <p className="mx-auto mt-2 max-w-md text-slate-600">결제 결과 정보가 없거나 올바르지 않습니다.</p>
            </div>
            <div className="border-t border-slate-100 p-5 sm:p-6">
              <Link
                href={esimMainHref}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-base"
              >
                eSIM 메인으로
              </Link>
              <p className="mt-6 text-center text-sm text-slate-400">
                문제가 있으신가요?{" "}
                <a
                  href={BONGSIM_KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 underline hover:text-teal-700"
                >
                  고객센터 문의
                </a>
              </p>
            </div>
          </div>
        </main>
      ) : null}
    </div>
  );
}

export default function CheckoutPaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
          불러오는 중…
        </div>
      }
    >
      <ResultInner />
    </Suspense>
  );
}
