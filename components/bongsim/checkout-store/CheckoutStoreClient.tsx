"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BONGSIM_CHECKOUT_TERMS_VERSION } from "@/lib/bongsim/checkout/terms";
import {
  BONGSIM_GIFT_CHECKOUT_FLAG_KEY,
  BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY,
  bongsimPath,
  type BongsimRecommendCheckoutLine,
} from "@/lib/bongsim/constants";
import { checkoutConfirmErrorMessage } from "@/lib/bongsim/checkout/checkout-confirm-error-message";
import { formatKoreanTelInput } from "@/lib/korean-tel-format";
import { formatBuyerPhoneDisplay } from "@/lib/bongsim/phone/normalize-buyer-phone";
import { EsimSupportFootnote } from "@/components/bongsim/EsimSupportFootnote";
import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import type { BongsimProductDetailV1 } from "@/lib/bongsim/contracts/product-detail.v1";
import { extractSingleCountryCode, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import { readUtmFromSession } from "@/lib/utm-capture";
import { useSession } from "next-auth/react";

type CheckoutRetryContextResponse = {
  ok?: boolean;
  error?: string;
  schema?: string;
  order_id?: string;
  order_number?: string;
  option_api_id?: string;
  quantity?: number;
  buyer_email?: string;
  buyer_phone?: string;
};

type Props = {
  optionApiIdInitial: string;
  quantityInitial?: number;
  /** 결제 실패 후 복귀 — 기존 주문에서 상품·수량·이메일 복원 */
  orderIdInitial?: string;
  /** URL `?gift=1` — 선물하기 기본 선택 */
  giftInitial?: boolean;
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

type MyCouponApiRow = {
  user_coupon_id: string;
  template_label: string;
  discount_type: string;
  discount_value: string;
  expires_at: string | null;
};

function formatMyCouponOptionLabel(r: MyCouponApiRow): string {
  const nf = new Intl.NumberFormat("ko-KR");
  const dtype = String(r.discount_type).trim().toLowerCase();
  const dv = Number(r.discount_value);
  let discText = "할인";
  if (dtype === "fixed" && Number.isFinite(dv)) discText = `${nf.format(Math.trunc(dv))}원 할인`;
  else if ((dtype === "percent" || dtype === "percentage") && Number.isFinite(dv)) discText = `${dv}% 할인`;
  let dpart = "만료 없음";
  if (r.expires_at) {
    const ms = new Date(r.expires_at).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    dpart = days <= 0 ? "만료" : `D-${days} 만료`;
  }
  return `${r.template_label} ${discText} (${dpart})`;
}

export function CheckoutStoreClient({
  optionApiIdInitial,
  quantityInitial,
  orderIdInitial = "",
  giftInitial = false,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const { data: sessionData, status: sessionStatus } = useSession();
  const orderIdFromUrl = (sp?.get("orderId") ?? orderIdInitial).trim();
  const [resumeOrderId, setResumeOrderId] = useState("");
  const [resumeOrderNumber, setResumeOrderNumber] = useState("");
  const [resumeLoading, setResumeLoading] = useState(Boolean(orderIdFromUrl && !optionApiIdInitial.trim()));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resolvedOptionApiId, setResolvedOptionApiId] = useState(optionApiIdInitial);
  const optionApiId = (sp?.get("optionApiId") ?? resolvedOptionApiId).trim();
  const qtyFromSearch = parseQtySearch(sp?.get("qty") ?? null);

  const [detail, setDetail] = useState<BongsimProductDetailV1 | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isGift, setIsGift] = useState(giftInitial);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [quantity, setQuantity] = useState(() => quantityInitial ?? 1);
  const [recommendQueue, setRecommendQueue] = useState<BongsimRecommendCheckoutLine[] | null>(null);
  const [terms, setTerms] = useState(false);
  const [locale, setLocale] = useState<"ko" | "en">("ko");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  /** 주문 합계에서 차감되는 할인액(KRW). */
  const [appliedOrderDiscountKrw, setAppliedOrderDiscountKrw] = useState<number | null>(null);
  /** `/api/bongsim/coupon/validate` 응답의 coupon_id — 주문 생성 시 함께 전달. */
  const [appliedCouponId, setAppliedCouponId] = useState<string | null>(null);
  const [appliedUserCouponId, setAppliedUserCouponId] = useState<string | null>(null);
  const [myCoupons, setMyCoupons] = useState<MyCouponApiRow[]>([]);
  const [myCouponsLoading, setMyCouponsLoading] = useState(false);
  const [selectedMyCouponId, setSelectedMyCouponId] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const checkoutIdempotencyRef = useRef<string | null>(null);
  const paymentIdempotencyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (giftInitial) {
      setIsGift(true);
      sessionStorage.setItem(BONGSIM_GIFT_CHECKOUT_FLAG_KEY, "1");
      return;
    }
    if (sessionStorage.getItem(BONGSIM_GIFT_CHECKOUT_FLAG_KEY) === "1") setIsGift(true);
  }, [giftInitial]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || phone.trim()) return;
    const u = sessionData?.user as { phone?: string } | undefined;
    const p = (u?.phone ?? "").trim();
    if (p) setPhone(formatBuyerPhoneDisplay(p));
  }, [sessionStatus, sessionData, phone]);

  useEffect(() => {
    setResolvedOptionApiId(optionApiIdInitial);
  }, [optionApiIdInitial]);

  useEffect(() => {
    const oid = orderIdFromUrl;
    if (!oid) {
      setResumeLoading(false);
      setResumeOrderId("");
      setResumeOrderNumber("");
      return;
    }
    if ((sp?.get("optionApiId") ?? "").trim()) {
      setResumeLoading(false);
      return;
    }
    let cancelled = false;
    setResumeLoading(true);
    setResumeError(null);
    (async () => {
      try {
        const res = await fetch(`/api/bongsim/checkout/retry-context?orderId=${encodeURIComponent(oid)}`, {
          method: "GET",
        });
        const j = (await res.json().catch(() => ({}))) as CheckoutRetryContextResponse;
        if (cancelled) return;
        if (!res.ok || j.ok !== true || !j.option_api_id?.trim() || !j.order_id?.trim()) {
          setResumeError(
            j.error === "not_payable"
              ? "이미 처리된 주문입니다. eSIM 메인에서 새로 주문해 주세요."
              : "이전 주문 정보를 불러오지 못했습니다.",
          );
          setResumeOrderId("");
          return;
        }
        const optId = j.option_api_id.trim();
        const qty =
          typeof j.quantity === "number" && Number.isFinite(j.quantity) ? Math.trunc(j.quantity) : 1;
        setResolvedOptionApiId(optId);
        setQuantity(Math.max(1, Math.min(99, qty)));
        if (typeof j.buyer_email === "string" && j.buyer_email.trim()) {
          setEmail(j.buyer_email.trim());
        }
        if (typeof j.buyer_phone === "string" && j.buyer_phone.trim()) {
          setPhone(formatBuyerPhoneDisplay(j.buyer_phone.trim()));
        }
        setResumeOrderId(j.order_id.trim());
        setResumeOrderNumber((j.order_number ?? "").trim());
        const q = new URLSearchParams({ orderId: oid, optionApiId: optId, qty: String(qty) });
        router.replace(`${bongsimPath("/checkout")}?${q.toString()}`, { scroll: false });
      } catch {
        if (!cancelled) setResumeError("이전 주문 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setResumeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderIdFromUrl, router, sp]);

  useEffect(() => {
    checkoutIdempotencyRef.current = null;
    paymentIdempotencyRef.current = null;
  }, [optionApiId, resumeOrderId]);

  useEffect(() => {
    setCouponCode("");
    setCouponOpen(false);
    setAppliedOrderDiscountKrw(null);
    setAppliedCouponId(null);
    setAppliedUserCouponId(null);
    setSelectedMyCouponId("");
  }, [optionApiId, quantity]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setMyCoupons([]);
      setMyCouponsLoading(false);
      return;
    }
    let cancelled = false;
    setMyCouponsLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/bongsim/mypage/coupons", { method: "GET" });
        const j = (await res.json().catch(() => ({}))) as { active?: MyCouponApiRow[] };
        if (cancelled) return;
        if (!res.ok) {
          setMyCoupons([]);
          return;
        }
        setMyCoupons(Array.isArray(j.active) ? j.active : []);
      } catch {
        if (!cancelled) setMyCoupons([]);
      } finally {
        if (!cancelled) setMyCouponsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3800);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

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

  const applyCoupon = useCallback(async () => {
    setCouponBusy(true);
    try {
      setAppliedUserCouponId(null);
      setSelectedMyCouponId("");
      const res = await fetch("/api/bongsim/coupon/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          option_api_id: optionApiId,
          quantity,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        discount_krw?: number;
        coupon_id?: string;
      };
      if (!res.ok || data.ok !== true) {
        setAppliedOrderDiscountKrw(null);
        setAppliedCouponId(null);
        setToastMessage(typeof data.error === "string" ? data.error : "쿠폰을 적용할 수 없습니다.");
        return;
      }
      const d = typeof data.discount_krw === "number" && Number.isFinite(data.discount_krw) ? Math.trunc(data.discount_krw) : 0;
      const cid = typeof data.coupon_id === "string" ? data.coupon_id.trim() : "";
      if (d > 0 && cid) {
        setAppliedOrderDiscountKrw(d);
        setAppliedCouponId(cid);
        setToastMessage("쿠폰이 적용되었습니다.");
        return;
      }
      setAppliedOrderDiscountKrw(null);
      setAppliedCouponId(null);
      setToastMessage("적용 가능한 할인이 없습니다.");
    } catch {
      setAppliedOrderDiscountKrw(null);
      setAppliedCouponId(null);
      setToastMessage("쿠폰 확인 중 오류가 발생했습니다.");
    } finally {
      setCouponBusy(false);
    }
  }, [couponCode, optionApiId, quantity]);

  const applyMyUserCoupon = useCallback(
    async (userCouponId: string) => {
      if (!userCouponId.trim()) {
        setAppliedOrderDiscountKrw(null);
        setAppliedUserCouponId(null);
        return;
      }
      setCouponBusy(true);
      try {
        const res = await fetch("/api/bongsim/coupon/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_coupon_id: userCouponId.trim(),
            option_api_id: optionApiId,
            quantity,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          discount_krw?: number;
          user_coupon_id?: string;
        };
        if (!res.ok || data.ok !== true) {
          setAppliedOrderDiscountKrw(null);
          setAppliedUserCouponId(null);
          setSelectedMyCouponId("");
          setToastMessage(typeof data.error === "string" ? data.error : "쿠폰을 적용할 수 없습니다.");
          return;
        }
        const d =
          typeof data.discount_krw === "number" && Number.isFinite(data.discount_krw) ? Math.trunc(data.discount_krw) : 0;
        const ucid = typeof data.user_coupon_id === "string" ? data.user_coupon_id.trim() : "";
        if (d > 0 && ucid) {
          setAppliedCouponId(null);
          setCouponCode("");
          setAppliedOrderDiscountKrw(d);
          setAppliedUserCouponId(ucid);
          setToastMessage("내 쿠폰이 적용되었습니다.");
          return;
        }
        setAppliedOrderDiscountKrw(null);
        setAppliedUserCouponId(null);
        setSelectedMyCouponId("");
        setToastMessage("적용 가능한 할인이 없습니다.");
      } catch {
        setAppliedOrderDiscountKrw(null);
        setAppliedUserCouponId(null);
        setSelectedMyCouponId("");
        setToastMessage("쿠폰 확인 중 오류가 발생했습니다.");
      } finally {
        setCouponBusy(false);
      }
    },
    [optionApiId, quantity],
  );
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
      const ph = phone.replace(/\D/g, "");
      if (!ph || ph.length < 10 || ph.length > 11 || !ph.startsWith("01")) {
        setSubmitError(
          isGift
            ? "구매자(결제자) 휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요."
            : "휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요. (필수)",
        );
        return;
      }
      if (isGift) {
        const rem = recipientEmail.trim();
        if (!rem || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rem)) {
          setSubmitError("받는 분 이메일을 입력해 주세요.");
          return;
        }
        const rph = recipientPhone.replace(/\D/g, "");
        if (!rph || rph.length < 10 || rph.length > 11 || !rph.startsWith("01")) {
          setSubmitError("받는 분 휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요. (필수)");
          return;
        }
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
        let orderId: string;
        let orderNumber: string;

        if (resumeOrderId) {
          orderId = resumeOrderId;
          orderNumber = resumeOrderNumber;
        } else {
        const confirmBody: Record<string, unknown> = {
          schema: "bongsim.checkout_confirm.request.v1",
          option_api_id: optionApiId,
          quantity,
          buyer_email: em,
          buyer_phone: ph,
          buyer_locale: locale,
          idempotency_key: checkoutKey,
          checkout_channel: "web",
          consents: {
            terms_version: BONGSIM_CHECKOUT_TERMS_VERSION,
            terms_accepted: true,
            marketing: { accepted: false, version: null },
            gift: isGift
              ? {
                  is_gift: true,
                  recipient_email: recipientEmail.trim(),
                  recipient_phone: recipientPhone.replace(/\D/g, ""),
                  recipient_name: recipientName.trim() || null,
                }
              : { is_gift: false },
          },
        };
        if (appliedUserCouponId && appliedOrderDiscountKrw != null && appliedOrderDiscountKrw > 0) {
          confirmBody.user_coupon_id = appliedUserCouponId;
          confirmBody.coupon_discount_krw = appliedOrderDiscountKrw;
        } else if (appliedCouponId && appliedOrderDiscountKrw != null && appliedOrderDiscountKrw > 0) {
          confirmBody.coupon_id = appliedCouponId;
          confirmBody.coupon_discount_krw = appliedOrderDiscountKrw;
        }
        Object.assign(confirmBody, readUtmFromSession());

        const cr = await fetch("/api/bongsim/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(confirmBody),
        });
        const cj = (await cr.json()) as BongsimCheckoutConfirmResponseV1 & {
          error?: string;
          details?: Record<string, string>;
        };
        if (!cr.ok) {
          setSubmitError(checkoutConfirmErrorMessage(cj));
          return;
        }
        if (cj.schema !== "bongsim.checkout_confirm.response.v1" || !cj.order?.order_id || !(cj.order.order_number ?? "").trim()) {
          setSubmitError("주문 응답이 올바르지 않습니다.");
          return;
        }
        orderId = cj.order.order_id;
        orderNumber = cj.order.order_number.trim();
        }

        const paymentKey = paymentIdempotencyRef.current ?? (paymentIdempotencyRef.current = crypto.randomUUID());
        const q = new URLSearchParams({
          orderId,
          orderNumber,
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
            provider: "welcomepay",
            return_urls: { success_url: successUrl, fail_url: failUrl, cancel_url: cancelUrl },
          }),
        });
        const pj = (await pr.json()) as BongsimPaymentSessionResponseV1 & {
          error?: string;
          details?: { message?: string; welcomepay?: string; [k: string]: string | undefined };
        };
        if (!pr.ok) {
          paymentIdempotencyRef.current = null;
          const detailMsg = pj.details?.message ?? pj.details?.welcomepay;
          setSubmitError(detailMsg ?? pj.error ?? "결제 세션을 만들지 못했습니다.");
          return;
        }
        if (pj.schema !== "bongsim.payment_session.response.v1" || !pj.client?.redirect_path) {
          setSubmitError("결제 응답이 올바르지 않습니다.");
          return;
        }
        let path = pj.client.redirect_path.startsWith("/") ? pj.client.redirect_path : `/${pj.client.redirect_path}`;
        if (pj.client.kind === "welcomepay_std") {
          const u = new URL(path, originBase);
          u.searchParams.set("welcomeOid", pj.client.welcome_oid);
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
    [
      appliedCouponId,
      appliedOrderDiscountKrw,
      appliedUserCouponId,
      detail,
      email,
      phone,
      isGift,
      recipientEmail,
      recipientPhone,
      recipientName,
      locale,
      optionApiId,
      quantity,
      resumeOrderId,
      resumeOrderNumber,
      router,
      terms,
    ],
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

        {resumeLoading ? (
          <p className="mt-4 text-sm text-slate-600 lg:mt-5 lg:text-base">이전 주문 정보를 불러오는 중…</p>
        ) : resumeError ? (
          <p className="mt-4 text-sm text-red-700 lg:mt-5 lg:text-base">{resumeError}</p>
        ) : !optionApiId ? (
          <p className="mt-4 text-sm text-slate-600 lg:mt-5 lg:text-base">
            상품을 선택한 뒤 다시 시도해 주세요.{" "}
            <Link href={bongsimPath()} className="font-medium text-teal-800 underline">
              eSIM 메인으로
            </Link>
          </p>
        ) : loadError ? (
          <p className="mt-4 text-sm text-red-700 lg:mt-5 lg:text-base">{loadError}</p>
        ) : !detail ? (
          <p className="mt-4 text-sm text-slate-600 lg:mt-5 lg:text-base">불러오는 중…</p>
        ) : (
          <div className="mt-4 space-y-4 lg:mt-5 lg:space-y-5">
            {resumeOrderId ? (
              <section className="rounded-xl border border-teal-200 bg-teal-50/90 px-4 py-3 text-sm text-teal-950">
                <p className="font-semibold">결제를 이어서 진행합니다</p>
                <p className="mt-1 text-teal-900/90">
                  주문번호 <span className="font-mono">{resumeOrderNumber || "—"}</span> · 내용 확인 후 아래{" "}
                  <strong>결제하기</strong>를 눌러 주세요.
                </p>
              </section>
            ) : null}
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
              {(() => {
                const unit = detail.summary.pricing.display_amount_krw;
                const subtotal = unit * Math.max(1, quantity);
                const disc = appliedOrderDiscountKrw ?? 0;
                const final = Math.max(0, subtotal - disc);
                const nf = new Intl.NumberFormat("ko-KR");
                if (disc > 0) {
                  return (
                    <div className="mt-4 space-y-1 lg:mt-5">
                      <p
                        className="text-lg font-medium text-slate-600 line-through lg:text-xl"
                        style={{ color: "#64748b" }}
                      >
                        {nf.format(subtotal)}원
                      </p>
                      <p className="text-2xl font-bold text-teal-600 lg:text-3xl">{nf.format(final)}원</p>
                      <p className="text-sm font-semibold text-teal-700 lg:text-base">-{nf.format(disc)}원</p>
                    </div>
                  );
                }
                return (
                  <p className="mt-4 text-2xl font-bold text-slate-900 lg:mt-5 lg:text-3xl">
                    {nf.format(unit)}원
                  </p>
                );
              })()}
            </section>

            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:space-y-5 lg:p-5">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isGift}
                    onChange={(ev) => setIsGift(ev.target.checked)}
                    className="mt-0.5 accent-violet-700"
                  />
                  <span className="min-w-0">
                    <span className="text-[14px] font-semibold text-violet-950">선물하기</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-violet-900/90">
                      QR·설치 안내는 받는 분 연락처로 보내드려요. 결제·주문 확인은 아래 구매자 정보를 사용합니다.
                    </span>
                  </span>
                </label>
              </div>

              {isGift ? (
                <fieldset className="space-y-3 rounded-xl border border-violet-100 bg-white p-3">
                  <legend className="px-1 text-[13px] font-semibold text-violet-950">받는 분</legend>
                  <label className="block">
                    <span className="text-[12px] font-medium text-slate-700 lg:text-sm">
                      받는 분 이름 <span className="font-normal text-slate-500">(선택)</span>
                    </span>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(ev) => setRecipientName(ev.target.value)}
                      placeholder="친구 이름"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] text-slate-900"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-medium text-slate-700 lg:text-sm">
                      받는 분 휴대폰 <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={recipientPhone}
                      onChange={(ev) => setRecipientPhone(formatKoreanTelInput(ev.target.value))}
                      placeholder="010-0000-0000"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] text-slate-900 lg:py-3"
                      required={isGift}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">eSIM QR·설치 안내 카카오 알림톡 수신 번호</p>
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-medium text-slate-700 lg:text-sm">
                      받는 분 이메일 <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(ev) => setRecipientEmail(ev.target.value)}
                      placeholder="friend@example.com"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] text-slate-900"
                      autoComplete="off"
                      required={isGift}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">QR·설치 링크 메일 수신</p>
                  </label>
                </fieldset>
              ) : null}

              <fieldset className={isGift ? "space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3" : "space-y-3"}>
                {isGift ? (
                  <legend className="px-1 text-[13px] font-semibold text-slate-800">구매자 (결제자)</legend>
                ) : null}
                <label className="block">
                  <span className="text-[12px] font-medium text-slate-700 lg:text-sm">
                    {isGift ? "구매자 휴대폰" : "휴대폰 번호"}{" "}
                    <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(ev) => setPhone(formatKoreanTelInput(ev.target.value))}
                    placeholder="010-0000-0000"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[15px] text-slate-900 lg:py-3"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isGift
                      ? "결제·주문 문의용 연락처입니다."
                      : "eSIM QR·설치 안내를 카카오톡·이메일로 보내드려요."}
                  </p>
                </label>

                <label className="block">
                  <span className="text-[12px] font-medium text-slate-700 lg:text-sm">
                    {isGift ? "구매자 이메일" : "이메일"}{" "}
                    {!isGift ? null : <span className="text-red-600">*</span>}
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                    autoComplete="email"
                    required
                  />
                </label>
              </fieldset>
              <label className="block">
                <span
                  className="text-[12px] font-medium text-slate-700 lg:text-sm"
                  style={{ color: "#1e293b" }}
                >
                  수량
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(ev) => setQuantity(Number.parseInt(ev.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                  required
                />
              </label>
              <label className="block">
                <span
                  className="text-[12px] font-medium text-slate-700 lg:text-sm"
                  style={{ color: "#1e293b" }}
                >
                  언어
                </span>
                <select
                  value={locale}
                  onChange={(ev) => setLocale(ev.target.value as "ko" | "en")}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 lg:mt-1.5 lg:px-4 lg:py-3 lg:text-lg"
                >
                  <option value="ko" className="text-slate-900">
                    한국어
                  </option>
                  <option value="en" className="text-slate-900">
                    영어
                  </option>
                </select>
              </label>
              <div className="flex items-start gap-2 text-[13px] text-slate-700 lg:gap-2.5 lg:text-[15px]">
                <input
                  id="bongsim-checkout-terms"
                  type="checkbox"
                  checked={terms}
                  onChange={(ev) => setTerms(ev.target.checked)}
                  className="mt-0.5 accent-teal-700 lg:mt-1 lg:h-4 lg:w-4"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <label
                    htmlFor="bongsim-checkout-terms"
                    className="block cursor-pointer leading-snug"
                    style={{ color: "#1e293b" }}
                  >
                    이용약관 및 eSIM 환불·서비스 정책을 확인하였으며 결제 진행에 동의합니다. (약관 버전{" "}
                    {BONGSIM_CHECKOUT_TERMS_VERSION})
                  </label>
                  <p className="text-[12px] leading-snug text-slate-500 lg:text-[13px]">
                    <Link
                      href="/terms"
                      className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
                    >
                      이용약관
                    </Link>
                    <span className="text-slate-400" aria-hidden>
                      {" · "}
                    </span>
                    <Link
                      href={bongsimPath("/policy")}
                      className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
                    >
                      eSIM 환불·서비스 정책
                    </Link>
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-300 bg-slate-50 transition hover:border-teal-600 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-500">
                <button
                  type="button"
                  onClick={() => setCouponOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 lg:px-4 lg:py-3 lg:text-base"
                  aria-expanded={couponOpen}
                  style={{ color: "#1e293b" }}
                >
                  쿠폰이 있으신가요?
                  <span className="text-slate-700" aria-hidden style={{ color: "#475569" }}>
                    {couponOpen ? "▲" : "▼"}
                  </span>
                </button>
                {couponOpen ? (
                  <div
                    className="border-t border-slate-300 px-3 pb-3 pt-1 text-slate-700 lg:px-4 lg:pb-4"
                    style={{ color: "#334155" }}
                  >
                    {sessionStatus === "authenticated" ? (
                      <div className="mb-3 space-y-1.5">
                        <span className="block text-xs font-medium text-slate-600">내 쿠폰함</span>
                        <select
                          disabled={Boolean(appliedCouponId) || couponBusy}
                          value={selectedMyCouponId}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            setSelectedMyCouponId(v);
                            void applyMyUserCoupon(v);
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
                        >
                          <option value="">선택 안 함</option>
                          {myCouponsLoading ? (
                            <option value="_loading" disabled>
                              불러오는 중…
                            </option>
                          ) : null}
                          {myCoupons.map((row) => (
                            <option key={row.user_coupon_id} value={row.user_coupon_id}>
                              {formatMyCouponOptionLabel(row)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(ev) => setCouponCode(ev.target.value)}
                        placeholder="쿠폰 코드"
                        disabled={Boolean(appliedUserCouponId)}
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50 lg:px-4 lg:py-2.5 lg:text-lg"
                        autoComplete="off"
                        style={{ color: "#1e293b" }}
                      />
                      <button
                        type="button"
                        disabled={couponBusy || Boolean(appliedUserCouponId)}
                        onClick={() => void applyCoupon()}
                        className="shrink-0 rounded-xl bg-teal-700 px-4 py-2 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60 lg:px-5 lg:text-lg"
                      >
                        {couponBusy ? "…" : "적용"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {submitError ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                  style={{ color: "#b91c1c" }}
                >
                  <p
                    className="text-sm font-semibold text-red-700 lg:text-base"
                    style={{ color: "#b91c1c" }}
                  >
                    {submitError}
                  </p>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-teal-700 px-4 py-3 text-lg font-semibold text-white hover:bg-teal-800 disabled:opacity-60 lg:py-4"
              >
                {submitting ? "처리 중…" : "다음: 결제 진행"}
              </button>
              <EsimSupportFootnote useCheckoutOpenChat className="mt-3 text-center text-xs" />
            </form>
          </div>
        )}
      </main>

      {toastMessage ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 px-4"
          role="status"
        >
          <div className="pointer-events-auto rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg lg:text-base">
            {toastMessage}
          </div>
        </div>
      ) : null}
    </div>
  );
}
