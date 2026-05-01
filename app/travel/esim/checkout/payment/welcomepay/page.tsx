"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";
import { welcomepayStdPayScriptUrl } from "@/lib/bongsim/welcomepay";

type PrepareMobile = {
  submitUrl: string;
  pNextUrl: string;
  pMid: string;
  pOid: string;
  pAmt: string;
  pTimestamp: string;
  pChkfake: string;
  pGoods: string;
  pUnam: string;
  pEmail: string;
  pMobile: string;
  pIniPayment: string;
};

type PrepareOk = {
  ok: true;
  mid: string;
  orderNumber: string;
  price: string;
  timestamp: string;
  signature: string;
  mKey: string;
  returnUrl: string;
  closeUrl: string;
  popupUrl: string;
  mobile: PrepareMobile;
};

declare global {
  interface Window {
    INIStdPay?: { pay: (formId: string) => void };
  }
}

/** 모바일 welpay 직접 POST 분기용 (태블릿·데스크톱은 PC INIStdPay). */
function isLikelyMobileWelpayUserAgent(ua: string): boolean {
  return /Mobi|Android|iP(hone|od)|IEMobile|BlackBerry|webOS|Opera Mini/i.test(ua);
}

function WelcomepayPaymentContent() {
  const sp = useSearchParams();
  const paymentAttemptId = sp?.get("paymentAttemptId") ?? "";
  const orderId = sp?.get("orderId") ?? "";
  const welcomeOid = sp?.get("welcomeOid") ?? "";
  const orderName = sp?.get("orderName") ?? "Bong투어 eSIM";
  const customerEmail = sp?.get("customerEmail") ?? "";
  const amountStr = sp?.get("amount") ?? "";
  const amount = Number.parseInt(amountStr, 10);

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prep, setPrep] = useState<PrepareOk | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uaMobile, setUaMobile] = useState<boolean | null>(null);
  const mobileFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setUaMobile(isLikelyMobileWelpayUserAgent(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!paymentAttemptId || !orderId || !welcomeOid || !Number.isFinite(amount) || amount <= 0 || !customerEmail) {
      setPhase("error");
      setErrorMsg("결제 세션 정보가 올바르지 않아요. 장바구니로 돌아가 다시 시도해 주세요.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bongsim/checkout/welcomepay-prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            orderNumber: welcomeOid,
            amount,
            orderName,
            customerEmail,
            paymentAttemptId,
          }),
        });
        const data = (await res.json()) as PrepareOk | { ok?: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
          setPhase("error");
          setErrorMsg(
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "결제 준비에 실패했어요.",
          );
          return;
        }
        const ok = data as PrepareOk;
        if (!ok.mobile?.submitUrl) {
          setPhase("error");
          setErrorMsg("모바일 결제 정보가 응답에 없어요.");
          return;
        }
        setPrep(ok);
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(e instanceof Error ? e.message : "결제 준비 요청에 실패했어요.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentAttemptId, orderId, welcomeOid, amount, orderName, customerEmail]);

  useEffect(() => {
    if (!prep || phase !== "ready" || uaMobile === null) return;
    if (uaMobile === true) {
      setSdkReady(true);
      return;
    }

    const src = welcomepayStdPayScriptUrl();
    const existing = document.querySelector(`script[data-welcomepay-ini="1"]`);
    if (existing) {
      setSdkReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.welcomepayIni = "1";
    s.onload = () => setSdkReady(true);
    s.onerror = () => {
      setPhase("error");
      setErrorMsg("웰컴페이먼츠 결제 스크립트를 불러오지 못했어요.");
    };
    document.body.appendChild(s);
    return () => {
      s.onload = null;
      s.onerror = null;
    };
  }, [prep, phase, uaMobile]);

  const buyerName =
    customerEmail.includes("@") && customerEmail.length > 1
      ? customerEmail.split("@")[0]!.slice(0, 30)
      : customerEmail.slice(0, 30) || "고객";

  const handlePay = () => {
    if (!prep || isSubmitting || !sdkReady) return;
    if (uaMobile === true) {
      setIsSubmitting(true);
      mobileFormRef.current?.submit();
      return;
    }
    const pay = window.INIStdPay?.pay;
    if (typeof pay !== "function") {
      setErrorMsg("결제 모듈이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      pay("SendPayForm_id");
    } catch (e) {
      setIsSubmitting(false);
      setErrorMsg(e instanceof Error ? e.message : "결제 호출에 실패했어요.");
    }
  };

  const payReady =
    phase === "ready" &&
    prep &&
    sdkReady &&
    (uaMobile === true || uaMobile === false);

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main>
        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:max-w-3xl lg:px-8 lg:pb-28 lg:pt-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-teal-700 lg:text-sm">결제</p>
          <h1 className="mt-2 text-[1.4rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl lg:mt-3 lg:text-3xl">
            신용카드 결제
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600 lg:mt-3 lg:text-base">
            {uaMobile === true
              ? "아래 정보를 확인한 뒤 결제하기를 누르면 웰컴페이먼츠 모바일 결제로 이동해요."
              : "아래 정보를 확인한 뒤 결제하기를 누르면 웰컴페이먼츠 결제창이 열려요."}
          </p>

          {phase === "error" ? (
            <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50/70 p-5 text-[13px] text-orange-900 lg:mt-10 lg:p-6 lg:text-[15px]">
              <p className="font-bold">결제를 시작할 수 없어요</p>
              <p className="mt-1.5 leading-relaxed lg:mt-2">{errorMsg}</p>
              <Link
                href={bongsimPath("/checkout")}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-[13px] font-bold text-orange-900 ring-1 ring-orange-200 hover:bg-orange-100 lg:mt-5 lg:min-h-12 lg:px-6 lg:text-base"
              >
                장바구니로 돌아가기
              </Link>
            </div>
          ) : null}

          {phase !== "error" ? (
            <div className={phase === "loading" ? "mt-8 animate-pulse space-y-4" : "mt-8 space-y-4 lg:mt-10 lg:space-y-5"}>
              {prep && uaMobile === true ? (
                <form
                  ref={mobileFormRef}
                  id="WelpayMobileForm"
                  method="post"
                  action={prep.mobile.submitUrl}
                  acceptCharset="UTF-8"
                  className="hidden"
                  aria-hidden
                >
                  <input type="hidden" name="P_MID" value={prep.mobile.pMid} />
                  <input type="hidden" name="P_OID" value={prep.mobile.pOid} />
                  <input type="hidden" name="P_AMT" value={prep.mobile.pAmt} />
                  <input type="hidden" name="P_TIMESTAMP" value={prep.mobile.pTimestamp} />
                  <input type="hidden" name="P_CHKFAKE" value={prep.mobile.pChkfake} />
                  <input type="hidden" name="P_NEXT_URL" value={prep.mobile.pNextUrl} />
                  <input type="hidden" name="P_GOODS" value={prep.mobile.pGoods} />
                  <input type="hidden" name="P_UNAME" value={prep.mobile.pUnam} />
                  <input type="hidden" name="P_EMAIL" value={prep.mobile.pEmail} />
                  <input type="hidden" name="P_MOBILE" value={prep.mobile.pMobile} />
                  <input type="hidden" name="P_INI_PAYMENT" value={prep.mobile.pIniPayment} />
                </form>
              ) : null}

              {prep && uaMobile === false ? (
                <form id="SendPayForm_id" name="SendPayForm_id" method="post" acceptCharset="UTF-8">
                  <input type="hidden" name="version" value="1.0" />
                  <input type="hidden" name="gopaymethod" value="Card" />
                  <input type="hidden" name="mid" value={prep.mid} />
                  <input type="hidden" name="oid" value={prep.orderNumber} />
                  <input type="hidden" name="price" value={prep.price} />
                  <input type="hidden" name="timestamp" value={prep.timestamp} />
                  <input type="hidden" name="signature" value={prep.signature} />
                  <input type="hidden" name="mKey" value={prep.mKey} />
                  <input type="hidden" name="goodname" value={orderName} />
                  <input type="hidden" name="buyername" value={buyerName} />
                  <input type="hidden" name="buyertel" value="01000000000" />
                  <input type="hidden" name="buyeremail" value={customerEmail} />
                  <input type="hidden" name="returnUrl" value={prep.returnUrl} />
                  <input type="hidden" name="closeUrl" value={prep.closeUrl} />
                  <input type="hidden" name="popupUrl" value={prep.popupUrl} />
                  <input type="hidden" name="payViewType" value="overlay" />
                </form>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 lg:text-sm">결제 요약</p>
                <div className="mt-3 flex items-center justify-between text-[14px] lg:mt-4 lg:text-base">
                  <span className="text-slate-600">결제 금액</span>
                  <span className="text-lg font-bold text-slate-900 lg:text-2xl">
                    {Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}원` : "-"}
                  </span>
                </div>
                {orderName ? (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-[13px] lg:mt-4 lg:pt-4 lg:text-[15px]">
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
                disabled={!payReady || isSubmitting}
                className="mt-2 flex min-h-[3.35rem] w-full items-center justify-center rounded-2xl bg-teal-700 px-6 text-[15px] font-bold text-white shadow-md transition enabled:hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400 lg:min-h-[3.75rem] lg:text-lg"
              >
                {payReady
                  ? isSubmitting
                    ? uaMobile === true
                      ? "결제 페이지로 이동 중…"
                      : "결제창 여는 중…"
                    : "결제하기"
                  : phase === "loading" || uaMobile === null
                    ? "결제 준비 중…"
                    : "결제 불가"}
              </button>

              <p className="text-center text-[11.5px] leading-relaxed text-slate-500 lg:text-sm">
                결제 진행은 웰컴페이먼츠가 안전하게 처리해요. 결제 완료 후 이메일로 QR코드를 보내드려요.
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function WelcomepayPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bt-page text-sm text-slate-600">
          결제 처리 중...
        </div>
      }
    >
      <WelcomepayPaymentContent />
    </Suspense>
  );
}
