"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import { SimplyurPortonePayPalPanel } from "@/components/simplyur/checkout/SimplyurPortonePayPalPanel";
import { SimplyurEximbayPrepSmokePanel } from "@/components/simplyur/checkout/SimplyurEximbayPrepSmokePanel";
import { SIMPLYUR_CHECKOUT_ENABLED, simplyurPath } from "@/lib/simplyur/constants";
import { simplyurLegalPath } from "@/lib/simplyur/legal-disclosures";
import type { SimplyurPortoneMethod } from "@/lib/simplyur/payments/portone-methods";
import { requestSimplyurPortoneKiccPayment } from "@/lib/simplyur/payments/request-simplyur-portone-payment";
import { SIMPLYUR_PORTONE_PROVIDER_ID } from "@/lib/simplyur/payments/providers/portone-payments";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";

// REGRESSION-FREEZE[simplyur-portone-checkout-p2]: simplyur checkout + PortOne — manifest
// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PayPal + KICC method selector — manifest

type FirstPurchasePreview = {
  eligible: true;
  discount_rate_pct: number;
  discount_krw: number;
  grand_total_krw: number;
};

type PendingPayPal = {
  client: Extract<BongsimPaymentSessionResponseV1["client"], { kind: "portone_v2" }>;
  paymentAttemptId: string;
  orderId: string;
  orderNumber: string;
};

type Props = {
  optionApiId: string;
  initialProduct?: SimplyurPublicProduct | null;
  paymentFailed?: boolean;
  checkoutEnabled?: boolean;
  availablePortoneMethods?: SimplyurPortoneMethod[];
  /** Dev-only Eximbay FGKey smoke — not the live payment path */
  eximbayPrepUi?: boolean;
};

/**
 * 결제 API 실패를 어느 단계·어느 필드인지 알 수 있게 만든다.
 * details 값은 서버 설정 문구까지 담을 수 있어 키만 노출한다.
 */
function formatCheckoutApiError(
  stage: "confirm" | "payment_session",
  json: { error?: string; details?: unknown },
): string {
  const reason = (json.error ?? "").trim() || "unknown_error";
  const details = json.details;
  const keys =
    details && typeof details === "object" && !Array.isArray(details) ? Object.keys(details) : [];
  return keys.length ? `${stage}: ${reason} (${keys.join(", ")})` : `${stage}: ${reason}`;
}

function methodLabel(method: SimplyurPortoneMethod, tr: (k: string) => string): string {
  switch (method) {
    case "paypal":
      return tr("checkout.payMethodPaypal");
    case "kicc_wechat":
      return tr("checkout.payMethodWechat");
    case "kicc_alipay_plus":
      return tr("checkout.payMethodAlipay");
    default:
      return method;
  }
}

export function SimplyurCheckoutClient({
  optionApiId,
  initialProduct = null,
  paymentFailed = false,
  checkoutEnabled = SIMPLYUR_CHECKOUT_ENABLED,
  availablePortoneMethods = ["paypal"],
  eximbayPrepUi = false,
}: Props) {
  const router = useRouter();
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

  const [product] = useState<SimplyurPublicProduct | null>(initialProduct);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstPurchase, setFirstPurchase] = useState<FirstPurchasePreview | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<SimplyurPortoneMethod>(
    availablePortoneMethods[0] ?? "paypal",
  );
  const [pendingPayPal, setPendingPayPal] = useState<PendingPayPal | null>(null);

  useEffect(() => {
    if (availablePortoneMethods.length && !availablePortoneMethods.includes(paymentMethod)) {
      setPaymentMethod(availablePortoneMethods[0]!);
    }
  }, [availablePortoneMethods, paymentMethod]);

  const subtotalKrw = product?.simplyur_sell_price_krw ?? null;

  useEffect(() => {
    if (subtotalKrw == null || subtotalKrw <= 0) {
      setFirstPurchase(null);
      return;
    }
    const buyerEmail = email.trim();
    if (!buyerEmail) {
      setFirstPurchase(null);
      return;
    }
    const ac = new AbortController();
    const q = new URLSearchParams({
      subtotal_krw: String(subtotalKrw),
      buyer_email: buyerEmail,
    });
    fetch(`/api/bongsim/checkout/first-purchase-preview?${q}`, { signal: ac.signal })
      .then(async (r) => r.json())
      .then((j) => {
        if (j?.eligible === true) {
          setFirstPurchase(j as FirstPurchasePreview);
        } else {
          setFirstPurchase(null);
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setFirstPurchase(null);
      });
    return () => ac.abort();
  }, [email, subtotalKrw]);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const displayFormatted = useMemo(() => {
    if (!product?.simplyur_display) return "—";
    if (firstPurchase?.eligible && product.simplyur_sell_price_krw != null && product.simplyur_sell_price_krw > 0) {
      const ratio = 1 - firstPurchase.discount_krw / product.simplyur_sell_price_krw;
      const displayAmt = Math.max(0, Math.round(product.simplyur_display.amount * ratio));
      return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
        style: "currency",
        currency: product.simplyur_display.currency,
        maximumFractionDigits: product.simplyur_display.currency === "KRW" ? 0 : 2,
      }).format(displayAmt);
    }
    return product.simplyur_display.formatted;
  }, [product, firstPurchase, locale]);

  const completePortonePayment = useCallback(
    async (paymentId: string, paymentAttemptId: string) => {
      const completeRes = await fetch("/api/simplyur/checkout/portone-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          payment_attempt_id: paymentAttemptId,
        }),
      });
      const completeJson = (await completeRes.json()) as { ok?: boolean; error?: string };
      if (!completeRes.ok || !completeJson.ok) {
        throw new Error(completeJson.error ?? "payment_complete_failed");
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!product || !terms || !email.trim() || !availablePortoneMethods.length) return;
    setSubmitting(true);
    setError(null);
    setPendingPayPal(null);
    try {
      const confirmRes = await fetch("/api/simplyur/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: [{ option_api_id: product.option_api_id, quantity: 1 }],
          buyer_email: email.trim(),
          buyer_phone: phone.trim(),
          idempotency_key: idempotencyKey,
          simplyur_locale: locale,
          consents: { terms_accepted: true },
        }),
      });
      const confirmJson = (await confirmRes.json()) as BongsimCheckoutConfirmResponseV1 & {
        error?: string;
        details?: unknown;
      };
      if (!confirmRes.ok || !confirmJson.order) {
        throw new Error(formatCheckoutApiError("confirm", confirmJson));
      }

      const origin = window.location.origin;
      const successUrl = `${origin}${simplyurPath(locale, `/checkout/complete?orderId=${encodeURIComponent(confirmJson.order.order_id)}&orderNumber=${encodeURIComponent(confirmJson.order.order_number)}`)}`;
      const failUrl = `${origin}${simplyurPath(locale, `/checkout?optionApiId=${encodeURIComponent(product.option_api_id)}&failed=1`)}`;

      const payRes = await fetch("/api/bongsim/payments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: confirmJson.order.order_id,
          idempotency_key: `${idempotencyKey}-pay-${paymentMethod}`,
          provider: SIMPLYUR_PORTONE_PROVIDER_ID,
          simplyur_portone_method: paymentMethod,
          simplyur_locale: locale,
          return_urls: {
            success_url: successUrl,
            fail_url: failUrl,
            cancel_url: failUrl,
          },
        }),
      });
      const payJson = (await payRes.json()) as BongsimPaymentSessionResponseV1 & {
        error?: string;
        details?: unknown;
      };
      if (!payRes.ok || !payJson.client) {
        throw new Error(formatCheckoutApiError("payment_session", payJson));
      }

      if (payJson.client.kind !== "portone_v2") {
        throw new Error("unexpected_payment_client");
      }

      if (paymentMethod === "paypal") {
        setPendingPayPal({
          client: payJson.client,
          paymentAttemptId: payJson.payment_attempt_id,
          orderId: confirmJson.order.order_id,
          orderNumber: confirmJson.order.order_number,
        });
        setSubmitting(false);
        return;
      }

      await requestSimplyurPortoneKiccPayment(payJson.client);
      await completePortonePayment(payJson.client.payment_id, payJson.payment_attempt_id);

      router.push(
        simplyurPath(
          locale,
          `/checkout/complete?orderId=${encodeURIComponent(confirmJson.order.order_id)}&orderNumber=${encodeURIComponent(confirmJson.order.order_number)}`,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg && msg.length < 120 ? msg : tr("checkout.errorGeneric"));
      setSubmitting(false);
    }
  }, [
    product,
    terms,
    email,
    phone,
    idempotencyKey,
    locale,
    router,
    tr,
    paymentMethod,
    availablePortoneMethods.length,
    completePortonePayment,
  ]);

  const onPayPalPaid = useCallback(async () => {
    if (!pendingPayPal) return;
    setSubmitting(true);
    setError(null);
    try {
      await completePortonePayment(pendingPayPal.client.payment_id, pendingPayPal.paymentAttemptId);
      router.push(
        simplyurPath(
          locale,
          `/checkout/complete?orderId=${encodeURIComponent(pendingPayPal.orderId)}&orderNumber=${encodeURIComponent(pendingPayPal.orderNumber)}`,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg && msg.length < 120 ? msg : tr("checkout.errorGeneric"));
      setSubmitting(false);
    }
  }, [pendingPayPal, completePortonePayment, router, locale, tr]);

  if (!optionApiId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("product.notFound")}</p>
        <Link href={simplyurPath(locale, "/recommend")} className="mt-4 inline-block su-text-dan underline">
          {tr("product.backToPlans")}
        </Link>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("product.notFound")}</p>
        <Link href={simplyurPath(locale, "/recommend")} className="mt-4 inline-block su-text-dan underline">
          {tr("product.backToPlans")}
        </Link>
      </main>
    );
  }

  if (!checkoutEnabled) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold su-text-ink">{tr("checkout.title")}</h1>
        <div className="su-card mt-6 border border-[color:var(--su-dan-muted)] bg-[color:var(--su-dan-muted)] p-5">
          <p className="font-semibold su-text-dan">{tr("product.checkoutSoon")}</p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{tr("product.checkoutSoonHint")}</p>
        </div>
        <p className="mt-4 text-sm text-[color:var(--su-ink-muted)]">
          {product.plan_summary} · {product.simplyur_display?.formatted ?? "—"}
        </p>
        <Link
          href={simplyurPath(locale, "/recommend")}
          className="mt-6 inline-block text-sm font-medium su-text-celadon hover:underline"
        >
          ← {tr("product.backToPlans")}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold su-text-ink">{tr("checkout.title")}</h1>

      <section className="su-card mt-6 p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--su-ink-muted)]">
          {tr("checkout.summary")}
        </h2>
        <p className="mt-3 font-medium su-text-ink">{product.plan_summary}</p>
        {firstPurchase ? (
          <div className="mt-2 space-y-1">
            <p className="text-base font-medium text-[color:var(--su-ink-muted)] line-through">
              {product.simplyur_display?.formatted ?? "—"}
            </p>
            <p className="text-xl font-bold su-text-dan">{displayFormatted}</p>
            <p className="text-xs font-semibold su-text-celadon">
              {tr("checkout.firstPurchaseBanner").replace("{rate}", String(firstPurchase.discount_rate_pct))}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xl font-bold su-text-dan">{product.simplyur_display?.formatted ?? "—"}</p>
        )}
        {!firstPurchase && !email.trim() ? (
          <p className="mt-2 text-xs text-[color:var(--su-ink-muted)]">{tr("checkout.firstPurchaseHint")}</p>
        ) : null}
      </section>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pendingPayPal) void submit();
        }}
      >
        {availablePortoneMethods.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium su-text-ink">{tr("checkout.payMethod")}</legend>
            <div className="space-y-2">
              {availablePortoneMethods.map((method) => (
                <label
                  key={method}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm"
                >
                  <input
                    type="radio"
                    name="portone_method"
                    value={method}
                    checked={paymentMethod === method}
                    disabled={Boolean(pendingPayPal) || submitting}
                    onChange={() => setPaymentMethod(method)}
                  />
                  <span className="su-text-ink">{methodLabel(method, tr)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div>
          <label htmlFor="su-email" className="block text-sm font-medium su-text-ink">
            {tr("checkout.email")}
          </label>
          <p className="text-xs text-[color:var(--su-ink-muted)]">{tr("checkout.emailHint")}</p>
          <input
            id="su-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(pendingPayPal)}
            className="mt-2 w-full rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm su-text-ink disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="su-phone" className="block text-sm font-medium su-text-ink">
            {tr("checkout.phone")}
          </label>
          <p className="text-xs text-[color:var(--su-ink-muted)]">{tr("checkout.phoneHint")}</p>
          <input
            id="su-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={Boolean(pendingPayPal)}
            className="mt-2 w-full rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm su-text-ink disabled:opacity-60"
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-[color:var(--su-ink-muted)]">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            disabled={Boolean(pendingPayPal)}
            className="mt-1"
          />
          <span>
            {tr("checkout.termsPrefix")}{" "}
            <Link href={simplyurLegalPath(locale, "terms")} className="font-semibold su-text-celadon underline">
              {tr("footer.legalTerms")}
            </Link>
            {", "}
            <Link href={simplyurLegalPath(locale, "privacy")} className="font-semibold su-text-celadon underline">
              {tr("footer.legalPrivacy")}
            </Link>
            {", "}
            <Link href={simplyurLegalPath(locale, "refund")} className="font-semibold su-text-celadon underline">
              {tr("footer.legalRefund")}
            </Link>
            .
          </span>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {paymentFailed ? (
          <p className="text-sm text-red-600">{tr("checkout.errorGeneric")}</p>
        ) : null}

        {pendingPayPal ? (
          <SimplyurPortonePayPalPanel
            client={pendingPayPal.client}
            onPaid={() => void onPayPalPaid()}
            onFail={(msg) => {
              setError(msg.length < 120 ? msg : tr("checkout.errorGeneric"));
              setSubmitting(false);
            }}
          />
        ) : (
          <button
            type="submit"
            disabled={submitting || !terms || !email.trim() || !availablePortoneMethods.length}
            className="w-full rounded-full su-bg-dan px-6 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? tr("checkout.processing") : tr("checkout.submit")}
          </button>
        )}
      </form>
      {eximbayPrepUi ? <SimplyurEximbayPrepSmokePanel locale={locale} /> : null}
    </main>
  );
}
