"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SIMPLYUR_CHECKOUT_ENABLED, simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurCountryBadge } from "@/components/simplyur/SimplyurCountryBadge";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";

type Props = { optionApiId: string };

export function SimplyurProductClient({ optionApiId }: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const [product, setProduct] = useState<SimplyurPublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/simplyur/products/${encodeURIComponent(optionApiId)}?locale=${locale}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error("load failed");
        return r.json() as Promise<{ product: SimplyurPublicProduct }>;
      })
      .then((json) => {
        if (!cancelled && json) setProduct(json.product);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [optionApiId, locale]);

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.loading")}</p>
      </main>
    );
  }

  if (notFound || !product) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("product.notFound")}</p>
        <Link href={simplyurPath(locale, "/recommend")} className="mt-4 inline-block su-text-dan underline">
          {tr("product.backToPlans")}
        </Link>
      </main>
    );
  }

  const network =
    (product.network_family || "").toLowerCase() === "local"
      ? tr("recommend.local")
      : tr("recommend.roaming");
  const checkoutHref = simplyurPath(
    locale,
    `/checkout?optionApiId=${encodeURIComponent(product.option_api_id)}`,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <Link
        href={simplyurPath(locale, "/recommend")}
        className="text-sm font-medium text-[color:var(--su-celadon)] hover:underline"
      >
        ← {tr("product.backToPlans")}
      </Link>

      <div className="mt-6">
        <SimplyurCountryBadge />
      </div>

      <h1 className="mt-4 text-2xl font-bold su-text-ink sm:text-3xl">{product.data_label}</h1>
      <p className="mt-1 text-sm text-[color:var(--su-ink-muted)]">{product.days_label}</p>
      <p className="mt-2 text-2xl font-bold su-text-dan">{product.simplyur_display?.formatted ?? "—"}</p>

      <section className="su-panel mt-8 p-5 sm:p-6">
        <h2 className="font-semibold su-text-ink">{tr("product.details")}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--su-ink-muted)]">{tr("product.network")}</dt>
            <dd className="font-medium su-text-ink">{network}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--su-ink-muted)]">{tr("recommend.duration")}</dt>
            <dd className="font-medium su-text-ink">{product.days_label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[color:var(--su-ink-muted)]">{tr("recommend.data")}</dt>
            <dd className="font-medium su-text-ink">{product.data_label}</dd>
          </div>
        </dl>
      </section>

      <Link
        href={SIMPLYUR_CHECKOUT_ENABLED ? checkoutHref : simplyurPath(locale, "/recommend")}
        aria-disabled={!SIMPLYUR_CHECKOUT_ENABLED}
        onClick={SIMPLYUR_CHECKOUT_ENABLED ? undefined : (e) => e.preventDefault()}
        className={`mt-8 flex w-full flex-col items-center justify-center rounded-full px-8 py-3.5 text-lg font-semibold transition-colors ${
          SIMPLYUR_CHECKOUT_ENABLED
            ? "su-bg-dan"
            : "cursor-not-allowed bg-[color:var(--su-ink-muted)] opacity-90"
        }`}
      >
        {SIMPLYUR_CHECKOUT_ENABLED ? tr("product.buyNow") : tr("product.checkoutSoon")}
      </Link>
      {!SIMPLYUR_CHECKOUT_ENABLED ? (
        <p className="mt-3 text-center text-sm text-[color:var(--su-ink-muted)]">{tr("product.checkoutSoonHint")}</p>
      ) : null}
    </main>
  );
}
