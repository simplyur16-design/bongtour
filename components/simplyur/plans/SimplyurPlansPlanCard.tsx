"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = {
  plan: SimplyurPublicProduct;
};

/** design_handoff_plans — data + price + Select (no days on card) */
export function SimplyurPlansPlanCard({ plan }: Props) {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const href = simplyurPath(locale, `/product/${encodeURIComponent(plan.option_api_id)}`);

  return (
    <article
      className="flex flex-col gap-3.5 border bg-white p-[18px]"
      style={{ borderColor: D.border, borderRadius: D.cardRadius }}
    >
      <p className="text-xl font-extrabold" style={{ color: D.navy }}>
        {plan.data_label}
      </p>
      <p className="text-[26px] font-extrabold leading-none" style={{ color: D.coral }}>
        {plan.simplyur_display?.formatted ?? "—"}
      </p>
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
