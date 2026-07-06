"use client";

import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

/** design_handoff_plans — checkout opening soon info banner */
export function SimplyurPlansInfoBanner() {
  const tr = useSimplyurT();
  return (
    <div
      className="flex gap-2.5 rounded-[14px] border px-4 py-3.5"
      style={{ backgroundColor: D.bannerBg, borderColor: D.bannerBorder }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: D.coral }}
        aria-hidden
      >
        i
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] font-bold" style={{ color: D.navy }}>
          {tr("recommend.bannerTitle")}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: D.muted }}>
          {tr("recommend.bannerBody")}
        </p>
      </div>
    </div>
  );
}
