"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
import { shouldShowSimplyurPerDay } from "@/lib/simplyur/currency";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  plan: SimplyurPublicProduct;
  selectLabel: string;
  priceLabel: string;
  networkFamily?: string;
};

export function SimplyurPlanCard({ plan, selectLabel, priceLabel, networkFamily }: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const href = simplyurPath(locale, `/product/${encodeURIComponent(plan.option_api_id)}`);
  const perDay = plan.simplyur_display_per_day?.formatted;
  const perDayLabel =
    perDay && shouldShowSimplyurPerDay(plan.days)
      ? tr("recommend.perDay").replace("{amount}", perDay)
      : null;

  return (
    <article className="su-card flex items-center gap-3 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {networkFamily ? (
            <span className="rounded-full bg-[color:var(--su-taeguk-blue-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--su-taeguk-blue)]">
              {networkFamily === "local" ? tr("recommend.local") : tr("recommend.roaming")}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold su-text-ink">{plan.data_label}</p>
            <p className="mt-0.5 text-sm text-[color:var(--su-ink-muted)]">{plan.days_label}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium text-[color:var(--su-ink-muted)]">{priceLabel}</p>
            <p className="text-xl font-bold su-text-dan">{plan.simplyur_display?.formatted ?? "—"}</p>
            {perDayLabel ? (
              <p className="mt-1 text-xs font-semibold text-[color:var(--su-ink-muted)]">{perDayLabel}</p>
            ) : null}
          </div>
        </div>
      </div>
      <Link href={href} className="su-btn-navy shrink-0 px-5 py-2.5 text-sm">
        {selectLabel}
      </Link>
    </article>
  );
}

export type { SimplyurPublicProduct as SimplyurPlanListItem };
