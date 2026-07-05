"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimPaymentSessionResponseV1 } from "@/lib/bongsim/contracts/payment-session.v1";
import { SIMPLYUR_CHECKOUT_ENABLED, simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";

export function SimplyurCheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const optionApiId = (searchParams?.get("optionApiId") ?? "").trim();
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

  const [product, setProduct] = useState<SimplyurPublicProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!optionApiId) {
      setLoadingProduct(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/simplyur/products/${encodeURIComponent(optionApiId)}?locale=${locale}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json() as Promise<{ product: SimplyurPublicProduct }>;
      })
      .then((json) => {
        if (!cancelled) setProduct(json.product);
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProduct(false);
      });
    return () => {
      cancelled = true;
    };
  }, [optionApiId, locale]);

  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

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

  if (loadingProduct) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.loading")}</p>
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
        <p className="mt-1 text-xl font-bold su-text-dan">{product.simplyur_display?.formatted ?? "—"}</p>
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
        {searchParams?.get("failed") === "1" ? (
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
