"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
import { shouldShowSimplyurPerDay } from "@/lib/simplyur/currency";
import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  plan: SimplyurPublicProduct;
};

/** design_handoff_plans — data + price + per-day + Select (days come from picker)
 * REGRESSION-FREEZE[simplyur-fx-daily-price]: per-day next to package total — manifest
 */
export function SimplyurPlansPlanCard({ plan }: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const href = simplyurPath(locale, `/product/${encodeURIComponent(plan.option_api_id)}`);
  const perDay = plan.simplyur_display_per_day?.formatted;
  const perDayLabel = perDay && shouldShowSimplyurPerDay(plan.days)
    ? tr("recommend.perDay").replace("{amount}", perDay)
    : null;

  return (
    <article
      className="flex flex-col gap-3.5 border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold" style={{ color: D.navy }}>
            {plan.data_label}
          </p>
          {plan.data_hint ? (
            <p className="mt-1.5 text-xs leading-snug" style={{ color: D.muted }}>
              {plan.data_hint}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[26px] font-extrabold leading-none" style={{ color: D.coral }}>
            {plan.simplyur_display?.formatted ?? "—"}
          </p>
          {perDayLabel ? (
            <p className="mt-1.5 text-sm font-semibold" style={{ color: D.faint }}>
              {perDayLabel}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={href}
        className="flex w-full items-center justify-center text-base font-semibold text-white transition hover:opacity-95"
        style={{
          height: D.buttonHeight,
          borderRadius: D.buttonRadius,
          backgroundColor: D.coral,
        }}
      >
        {tr("recommend.selectPlan")}
      </Link>
    </article>
  );
}
