"use client";

import { useEffect, useState } from "react";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurCountryBadge } from "@/components/simplyur/SimplyurCountryBadge";
import { SimplyurPlanCard } from "@/components/simplyur/SimplyurPlanCard";
import type { SimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";

type ApiPayload = { pack: SimplyurKoreaPack };

/** Korea-only plan catalog (Phase 1). */
export function SimplyurRecommendClient() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/simplyur/products/by-country?locale=${locale}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : `HTTP ${r.status}`);
        }
        return r.json() as Promise<ApiPayload>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const pack = data?.pack ?? null;

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:max-w-2xl sm:px-6">
      <SimplyurCountryBadge className="mt-0" />
      <h1 className="mt-4 text-3xl font-bold tracking-tight su-text-ink">{tr("recommend.title")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{tr("recommend.koreaOnly")}</p>
      <p className="mt-4 rounded-xl border border-[color:var(--su-hanji-border)] bg-[color:var(--su-dan-muted)] px-4 py-3 text-sm text-[color:var(--su-ink)]">
        {tr("product.checkoutSoon")} — {tr("product.checkoutSoonHint")}
      </p>

      <section className="mt-10 space-y-8">
        {loading ? <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.loading")}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {!loading && pack ? (
          <>
            <PlanGroup title={tr("recommend.roaming")} pack={pack.roaming} tr={tr} />
            {pack.local ? <PlanGroup title={tr("recommend.local")} pack={pack.local} tr={tr} /> : null}
            {pack.roaming.products.length === 0 && (!pack.local || pack.local.products.length === 0) ? (
              <p className="text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.noPlans")}</p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function PlanGroup({
  title,
  pack,
  tr,
}: {
  title: string;
  pack: SimplyurKoreaPack["roaming"];
  tr: (path: string) => string;
}) {
  if (pack.products.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold su-text-ink">{title}</h2>
        {pack.min_display ? (
          <p className="text-sm text-[color:var(--su-ink-muted)]">
            {tr("recommend.fromPrice")}{" "}
            <span className="font-semibold su-text-dan">{pack.min_display.formatted}</span>
          </p>
        ) : null}
      </div>
      <ul className="space-y-3">
        {pack.products.map((p) => (
          <li key={p.option_api_id}>
            <SimplyurPlanCard
              plan={p}
              selectLabel={tr("recommend.selectPlan")}
              priceLabel={tr("recommend.price")}
              networkFamily={p.network_family}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
