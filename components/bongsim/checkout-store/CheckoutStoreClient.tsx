"use client";

import { bongsimPath } from '@/lib/bongsim/constants'
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BONGSIM_CHECKOUT_TERMS_VERSION } from "@/lib/bongsim/checkout/terms";
import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";

type Props = {
  optionApiIdInitial: string;
};

export function CheckoutStoreClient({ optionApiIdInitial }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const optionApiId = (sp?.get("optionApiId") ?? optionApiIdInitial).trim();

  const [detail, setDetail] = useState<BongsimProductDetailV1 | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [terms, setTerms] = useState(false);
  const [locale, setLocale] = useState<"ko" | "en" | "">("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const checkoutIdempotencyRef = useRef<string | null>(null);
  const paymentIdempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    checkoutIdempotencyRef.current = null;
    paymentIdempotencyRef.current = null;
  }, [optionApiId]);

  useEffect(() => {
    if (!optionApiId) {
      queueMicrotask(() => {
        setDetail(null);
        setLoadError("optionApiId가 필요합니다.");
      });
      return;
    }
    let cancelled = false;
    (async () => {
      queueMicrotask(() => setLoadError(null));
      const res = await fetch(`/api/bongsim/products/${encodeURIComponent(optionApiId)}`, { method: "GET" });
      if (cancelled) return;
      if (!res.ok) {
        setDetail(null);
        setLoadError(res.status === 404 ? "상품을 찾을 수 없습니다." : "상품을 불러오지 못했습니다.");
        return;
      }
      const json = (await res.json()) as BongsimProductDetailV1;
      if (json.schema !== "bongsim.product_detail.v1") {
        setLoadError("잘못된 응답입니다.");
        setDetail(null);
        return;
      }
      setDetail(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [optionApiId]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      if (!optionApiId || !detail) return;
      const originBase = typeof window !== "undefined" ? window.location.origin : "";
      if (!originBase) {
        setSubmitError("브라우저 환경에서만 결제를 진행할 수 있습니다.");
        return;
      }
      if (!terms) {
        setSubmitError("이용약관에 동의해 주세요.");
        return;
      }
      const em = email.trim();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setSubmitError("유효한 이메일을 입력해 주세요.");
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        setSubmitError("수량은 1~99 사이 정수여야 합니다.");
        return;
      }
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);

      const checkoutKey = checkoutIdempotencyRef.current ?? (checkoutIdempotencyRef.current = crypto.randomUUID());

      try {
        const cr = await fetch("/api/bongsim/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema: "bongsim.checkout_confirm.request.v1",
            option_api_id: optionApiId,
            quantity,
            buyer_email: em,
            buyer_locale: locale === "ko" || locale === "en" ? locale : undefined,
            idempotency_key: checkoutKey,
            checkout_channel: "web",
            consents: {
              terms_version: BONGSIM_CHECKOUT_TERMS_VERSION,
              terms_accepted: true,
              marketing: { accepted: false, version: null },
            },
          }),
        });
        const cj = (await cr.json()) as BongsimCheckoutConfirmResponseV1 & { error?: string; details?: Record<string, string> };
        if (!cr.ok) {
          setSubmitError(cj.error === "validation" ? "입력값을 확인해 주세요." : "주문 생성에 실패했습니다.");
          return;
        }
        if (cj.schema !== "bongsim.checkout_confirm.response.v1" || !cj.order?.order_id) {
          setSubmitError("주문 응답이 올바르지 않습니다.");
          return;
        }
        const orderId = cj.order.order_id;

        const paymentKey = paymentIdempotencyRef.current ?? (paymentIdempotencyRef.current = crypto.randomUUID());
        const q = new URLSearchParams({
          orderId,
          optionApiId,
        });
        const successUrl = `${originBase}${bongsimPath(`/checkout/return/success?${q.toString()}`)}`;
        const failUrl = `${originBase}${bongsimPath(`/checkout/return/fail?${q.toString()}`)}`;
        const cancelUrl = `${originBase}${bongsimPath(`/checkout/return/cancel?${q.toString()}`)}`;

        const pr = await fetch("/api/bongsim/payments/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema: "bongsim.payment_session.request.v1",
            order_id: orderId,
            idempotency_key: paymentKey,
            provider: "toss_payments",
            return_urls: { success_url: successUrl, fail_url: failUrl, cancel_url: cancelUrl },
          }),
        });
        const pj = (await pr.json()) as BongsimPaymentSessionResponseV1 & { error?: string };
        if (!pr.ok) {
          paymentIdempotencyRef.current = null;
          setSubmitError(pj.error ?? "결제 세션을 만들지 못했습니다.");
          return;
        }
        if (pj.schema !== "bongsim.payment_session.response.v1" || !pj.client?.redirect_path) {
          setSubmitError("결제 응답이 올바르지 않습니다.");
          return;
        }
        let path = pj.client.redirect_path.startsWith("/") ? pj.client.redirect_path : `/${pj.client.redirect_path}`;
        if (pj.client.kind === "toss_sdk") {
          const u = new URL(path, originBase);
          u.searchParams.set("tossOrderId", pj.client.toss_order_id);
          u.searchParams.set("orderName", pj.client.order_name);
          u.searchParams.set("customerEmail", pj.client.customer_email);
          u.searchParams.set("amount", String(pj.client.amount_krw));
          path = `${u.pathname}${u.search}`;
        }
        router.push(path);
      } catch {
        setSubmitError("네트워크 오류가 발생했습니다.");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [detail, email, locale, optionApiId, quantity, router, terms],
  );

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <main className="mx-auto max-w-lg px-4 pt-3 sm:max-w-xl sm:px-6 sm:pt-4">
        <nav className="text-[12px] text-slate-500">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">결제</span>
        </nav>
        <h1 className="mt-3 text-[20px] font-semibold text-slate-900">주문·결제</h1>

        {!optionApiId ? (
          <p className="mt-4 text-sm text-slate-600">상품을 선택한 뒤 다시 시도해 주세요.</p>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700">{loadError}</p>
        ) : !detail ? (
          <p className="mt-4 text-sm text-slate-600">불러오는 중…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[13px] font-semibold text-slate-900">{detail.summary.plan_name}</p>
              <p className="mt-1 text-[12px] text-slate-600">{detail.summary.option_label}</p>
              <p className="mt-3 text-[16px] font-semibold text-slate-900">
                {new Intl.NumberFormat("ko-KR").format(detail.summary.pricing.display_amount_krw)}원
                <span className="ml-2 text-[11px] font-normal text-slate-500">(표시 기준: {detail.summary.pricing.display_basis})</span>
              </p>
            </section>

            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700">이메일</span>
                <input
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700">수량</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(ev) => setQuantity(Number.parseInt(ev.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700">언어 (선택)</span>
                <select
                  value={locale}
                  onChange={(ev) => setLocale(ev.target.value as "ko" | "en" | "")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">기본</option>
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-slate-700">
                <input type="checkbox" checked={terms} onChange={(ev) => setTerms(ev.target.checked)} className="mt-0.5" />
                <span>
                  이용약관 및 결제 진행에 동의합니다. (약관 버전 {BONGSIM_CHECKOUT_TERMS_VERSION})
                </span>
              </label>
              {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {submitting ? "처리 중…" : "다음: 결제 진행"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
