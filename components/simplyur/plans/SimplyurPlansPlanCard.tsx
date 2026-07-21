"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
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
  const perDayLabel = perDay
    ? tr("recommend.perDay").replace("{amount}", perDay)
    : null;

  return (
    <article
      className="flex flex-col gap-3.5 border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      <p className="text-xl font-extrabold" style={{ color: D.navy }}>
        {plan.data_label}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[26px] font-extrabold leading-none" style={{ color: D.coral }}>
          {plan.simplyur_display?.formatted ?? "—"}
        </p>
        {perDayLabel ? (
          <p className="text-sm font-semibold" style={{ color: D.faint }}>
            {perDayLabel}
          </p>
        ) : null}
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
