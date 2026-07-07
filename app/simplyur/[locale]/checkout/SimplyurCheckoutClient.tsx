"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import { SIMPLYUR_CHECKOUT_ENABLED, simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";

type FirstPurchasePreview = {
  eligible: true;
  discount_rate_pct: number;
  discount_krw: number;
  grand_total_krw: number;
};

type Props = {
  optionApiId: string;
  initialProduct?: SimplyurPublicProduct | null;
  paymentFailed?: boolean;
};

export function SimplyurCheckoutClient({
  optionApiId,
  initialProduct = null,
  paymentFailed = false,
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

  const submit = useCallback(async () => {
    if (!product || !terms || !email.trim()) return;
    setSubmitting(true);
    setError(null);
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
      };
      if (!confirmRes.ok || !confirmJson.order) {
        throw new Error(confirmJson.error ?? "confirm_failed");
      }

      const origin = window.location.origin;
      const successUrl = `${origin}${simplyurPath(locale, `/checkout/complete?orderId=${encodeURIComponent(confirmJson.order.order_id)}&orderNumber=${encodeURIComponent(confirmJson.order.order_number)}`)}`;
      const failUrl = `${origin}${simplyurPath(locale, `/checkout?optionApiId=${encodeURIComponent(product.option_api_id)}&failed=1`)}`;
      const cancelUrl = failUrl;

      const payRes = await fetch("/api/bongsim/payments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: confirmJson.order.order_id,
          idempotency_key: `${idempotencyKey}-pay`,
          provider: "bongsim_mock",
          return_urls: {
            success_url: successUrl,
            fail_url: failUrl,
            cancel_url: cancelUrl,
          },
        }),
      });
      const payJson = (await payRes.json()) as BongsimPaymentSessionResponseV1 & { error?: string };
      if (!payRes.ok || !payJson.client) {
        throw new Error(payJson.error ?? "payment_session_failed");
      }
      if (payJson.client.kind === "mock_redirect") {
        window.location.href = payJson.client.redirect_path;
        return;
      }
      router.push(payJson.client.redirect_path);
    } catch {
      setError(tr("checkout.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }, [product, terms, email, phone, idempotencyKey, locale, router, tr]);

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

  if (!SIMPLYUR_CHECKOUT_ENABLED) {
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
          void submit();
        }}
      >
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
            className="mt-2 w-full rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm su-text-ink"
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
            className="mt-2 w-full rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-2.5 text-sm su-text-ink"
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-[color:var(--su-ink-muted)]">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-1"
          />
          {tr("checkout.terms")}
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {paymentFailed ? (
          <p className="text-sm text-red-600">{tr("checkout.errorGeneric")}</p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !terms || !email.trim()}
          className="w-full rounded-full su-bg-dan px-6 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? tr("checkout.processing") : tr("checkout.submit")}
        </button>
      </form>
    </main>
  );
}
