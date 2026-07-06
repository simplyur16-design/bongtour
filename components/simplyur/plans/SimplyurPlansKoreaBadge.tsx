"use client";

import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

/** design_handoff_plans — navy pill country badge */
export function SimplyurPlansKoreaBadge() {
  const tr = useSimplyurT();
  return (
    <span
      className="inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white"
      style={{ backgroundColor: D.navy }}
    >
      {tr("countries.kr.name")}
    </span>
  );
}
