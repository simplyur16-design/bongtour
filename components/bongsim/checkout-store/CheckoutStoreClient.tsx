"use client";

import { bongsimPath } from '@/lib/bongsim/constants'
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BONGSIM_CHECKOUT_TERMS_VERSION } from "@/lib/bongsim/checkout/terms";
import {
  BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY,
  type BongsimRecommendCheckoutLine,
} from "@/lib/bongsim/constants";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { extractSingleCountryCode, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";

type Props = {
  optionApiIdInitial: string;
  quantityInitial?: number;
};

function parseQtySearch(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return undefined;
  return n;
}

/** 체크아웃 상단 — 국기 + 한글 국가/권역명 */
function checkoutCountryHeadline(planName: string): { flag: string; name: string } {
  const plan = planName.trim();
  let code = extractSingleCountryCode(plan);
  if (!code) {
    const codes = getPlanCoveredCountries(plan);
    if (codes.length === 1) code = codes[0]!;
  }
  if (code) {
    const c = COUNTRY_OPTIONS.find((x) => x.code === code);
    if (c) return { flag: c.flag, name: c.nameKr };
  }
  return { flag: "🌍", name: plan || "상품" };
}

function checkoutPlanSubtitle(detail: BongsimProductDetailV1, countryHeadlineName: string): string {
  const pn = detail.summary.plan_name.trim();
  const ol = (detail.summary.option_label || "").trim();
  const parts: string[] = [];
  if (pn && pn !== "—" && pn !== countryHeadlineName) parts.push(pn);
  if (ol && ol !== "—") parts.push(ol);
  if (parts.length) return parts.join(" · ");
  if (ol && ol !== "—") return ol;
  if (pn && pn !== "—") return pn;
  return "—";
}

/** API `display_basis` 내부 키를 사용자용 문구로만 노출 */
function displayBasisLabelKr(basis: string): string {
  switch (basis) {
    case "after.recommended_krw":
    case "before.recommended_krw":
      return "권장 판매가 기준";
    case "after.consumer_krw":
    case "before.consumer_krw":
      return "소비자가 기준";
    case "after.supply_krw":
    case "before.supply_krw":
      return "공급가 기준";
    case "missing_all_price_cells":
      return "가격 미확인";
    default:
      return "표시 가격 기준";
  }
}

function readRecommendQueue(): BongsimRecommendCheckoutLine[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const out: BongsimRecommendCheckoutLine[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.optionApiId === "string" ? o.optionApiId.trim() : "";
      const q = typeof o.quantity === "number" ? o.quantity : Number.parseInt(String(o.quantity ?? ""), 10);
      if (!id || !Number.isFinite(q) || q < 1 || q > 99) continue;
      out.push({ optionApiId: id, quantity: Math.trunc(q) });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function CheckoutStoreClient({ optionApiIdInitial, quantityInitial }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const optionApiId = (sp?.get("optionApiId") ?? optionApiIdInitial).trim();
  const qtyFromSearch = parseQtySearch(sp?.get("qty") ?? null);

  const [detail, setDetail] = useState<BongsimProductDetailV1 | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(() => quantityInitial ?? 1);
  const [recommendQueue, setRecommendQueue] = useState<BongsimRecommendCheckoutLine[] | null>(null);
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
    const q = readRecommendQueue();
    setRecommendQueue(q);
    const fromUrl = qtyFromSearch ?? quantityInitial;
    if (fromUrl != null) {
      setQuantity(fromUrl);
      return;
    }
    if (q) {
      const line = q.find((l) => l.optionApiId === optionApiId);
      if (line) setQuantity(line.quantity);
    }
  }, [optionApiId, qtyFromSearch, quantityInitial]);

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

  const checkoutSummary = useMemo(() => {
    if (!detail) return null;
    const head = checkoutCountryHeadline(detail.summary.plan_name);
    return { head, planSubtitle: checkoutPlanSubtitle(detail, head.name) };
  }, [detail]);

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
      <main className="mx-auto w-full max-w-lg px-4 pt-3 sm:max-w-xl sm:px-6 sm:pt-4 lg:max-w-2xl lg:px-8 lg:pt-6">
        <nav className="text-[12px] text-slate-500 lg:text-sm">
          <Link href={bongsimPath()} className="hover:text-teal-800">
            홈
          </Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-800">결제</span>
        </nav>
        <h1 className="mt-3 text-[20px] font-semibold text-slate-900 lg:mt-4 lg:text-2xl">주문·결제</h1>

        {!optionApiId ? (
          <p className="mt-4 text-sm text-slate-600 lg:mt-5 lg:text-base">상품을 선택한 뒤 다시 시도해 주세요.</p>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700 lg:mt-5 lg:text-base">{loadError}</p>
        ) : !detail ? (
          <p className="mt-4 text-sm text-slate-600 lg:mt-5 lg:text-base">불러오는 중…</p>
        ) : (
          <div className="mt-4 space-y-4 lg:mt-5 lg:space-y-5">
            {recommendQueue && recommendQueue.length > 1 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-[13px] leading-snug text-amber-950 lg:p-5 lg:text-[15px]">
                <p className="font-semibold">추천에서 여러 국가 상품을 담았어요</p>
                <p className="mt-1.5 text-amber-900/90 lg:mt-2">
                  현재 주문은 <strong>이 상품 1건</strong>만 포함합니다. 결제를 마친 뒤, 같은 방식으로 나머지{" "}
                  <strong>{recommendQueue.length - 1}건</strong>을 각각 주문해 주세요. (체크아웃 API는 국가당 1상품
                  주문만 지원합니다.)
                </p>
              </section>
            ) : null}
            <section className="rounded-xl border border-teal-200 bg-teal-50 p-4 shadow-sm lg:p-5">
              {checkoutSummary ? (
                <>
                  <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
                    <span className="text-2xl leading-none" aria-hidden>
                      {checkoutSummary.head.flag}
                    </span>
                    <span>{checkoutSummary.head.name}</span>
                  </p>
                  <p className="mt-2 text-base leading-snug text-slate-800">{checkoutSummary.planSubtitle}</p>
                </>
              ) : null}
              <p className="mt-4 text-2xl font-bold text-slate-900 lg:mt-5 lg:text-3xl">
                {new Intl.NumberFormat("ko-KR").format(detail.summary.pricing.display_amount_krw)}원
                <span className="ml-2 text-sm font-normal text-slate-500 lg:text-base">
                  ({displayBasisLabelKr(detail.summary.pricing.display_basis)})
                </span>
              </p>
            </section>

            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:space-y-5 lg:p-5">
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700 lg:text-sm">이메일</span>
                <input
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700 lg:text-sm">수량</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(ev) => setQuantity(Number.parseInt(ev.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                  required
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-slate-700 lg:text-sm">언어 (선택)</span>
                <select
                  value={locale}
                  onChange={(ev) => setLocale(ev.target.value as "ko" | "en" | "")}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                >
                  <option value="">기본</option>
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-slate-700 lg:gap-2.5 lg:text-[15px]">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(ev) => setTerms(ev.target.checked)}
                  className="mt-0.5 lg:mt-1 lg:h-4 lg:w-4"
                />
                <span>
                  이용약관 및 결제 진행에 동의합니다. (약관 버전 {BONGSIM_CHECKOUT_TERMS_VERSION})
                </span>
              </label>
              {submitError ? <p className="text-sm text-red-700 lg:text-base">{submitError}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-teal-700 px-4 py-3 text-lg font-semibold text-white hover:bg-teal-800 disabled:opacity-60 lg:py-4"
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
