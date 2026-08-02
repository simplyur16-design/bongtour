"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurCountryBadge } from "@/components/simplyur/SimplyurCountryBadge";
import type { SimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { SimplyurPlanCard } from "@/components/simplyur/SimplyurPlanCard";

function pickPreviewPlans(pack: SimplyurKoreaPack): SimplyurKoreaPack["roaming"]["products"] {
  const merged = [...pack.roaming.products, ...(pack.local?.products ?? [])];
  return merged.slice(0, 3);
}

/** Korea-only popular plans preview on the home page. */
export function SimplyurPopularPlans() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const [plans, setPlans] = useState<SimplyurPublicProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = `/api/simplyur/products/by-country?codes=kr&locale=${locale}&cv=2`;
    (async () => {
      try {
        let r = await fetch(url, { cache: "no-store" });
        if (!r.ok) {
          await new Promise((res) => window.setTimeout(res, 450));
          r = await fetch(url, { cache: "no-store" });
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { pack?: SimplyurKoreaPack };
        if (!cancelled) setPlans(json.pack ? pickPreviewPlans(json.pack) : []);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <section className="mx-auto max-w-lg px-4 py-8 sm:max-w-2xl">
      <div className="text-center">
        <SimplyurCountryBadge />
        <h2 className="mt-4 text-xl font-bold tracking-tight su-text-ink sm:text-2xl">{tr("home.popularPlans")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--su-ink-muted)]">{tr("countries.subtitle")}</p>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.loading")}</p>
        ) : null}
        {!loading && plans.length === 0 ? (
          <p className="text-center text-sm text-[color:var(--su-ink-muted)]">{tr("recommend.noPlans")}</p>
        ) : null}
        {plans.map((plan) => (
          <SimplyurPlanCard
            key={plan.option_api_id}
            plan={plan}
            selectLabel={tr("recommend.selectPlan")}
            priceLabel={tr("recommend.price")}
            networkFamily={plan.network_family}
          />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={simplyurPath(locale, "/recommend")}
          className="inline-flex items-center justify-center rounded-full border-2 border-[color:var(--su-celadon)] px-8 py-3 text-base font-semibold text-[color:var(--su-celadon-dark)] transition hover:su-bg-celadon-light"
        >
          {tr("home.viewAllPlans")} →
        </Link>
      </div>
    </section>
  );
}
