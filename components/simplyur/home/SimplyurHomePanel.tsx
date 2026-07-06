"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
import {
  SIMPLYUR_HOME_DESIGN as D,
  SIMPLYUR_HOME_WHY_ICONS,
  SIMPLYUR_HOME_WHY_KEYS,
} from "@/lib/simplyur/home-design";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurPlansInfoBanner } from "@/components/simplyur/plans/SimplyurPlansInfoBanner";
import { SimplyurPlansKoreaBadge } from "@/components/simplyur/plans/SimplyurPlansKoreaBadge";

/** design_handoff_home — Home tab [03] */
export function SimplyurHomePanel() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

  return (
    <main
      className="mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2.5rem)" }}
    >
      <div className="flex flex-col" style={{ gap: D.sectionGap }}>
        <SimplyurPlansKoreaBadge />

        <div className="flex flex-col gap-3">
          <h1
            className="font-extrabold tracking-tight"
            style={{ fontSize: D.heroTitleSize, lineHeight: 1.15, color: D.navy }}
          >
            {tr("hero.titleLine1")}
            <br />
            <span style={{ color: D.coral }}>{tr("hero.titleHighlight")}</span>
          </h1>
          <p className="max-w-[320px] text-sm leading-relaxed" style={{ color: D.muted }}>
            {tr("hero.subtitle")}
          </p>
        </div>

        <Link
          href={simplyurPath(locale, "/recommend")}
          className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition hover:opacity-95"
          style={{ backgroundColor: D.coral, boxShadow: D.ctaShadow }}
        >
          {tr("hero.cta")}
        </Link>

        <SimplyurPlansInfoBanner />

        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-bold" style={{ color: D.navy }}>
            {tr("why.title")}
          </p>
          <div className="flex flex-col gap-2.5">
            {SIMPLYUR_HOME_WHY_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-3.5 border bg-white px-4 py-3.5"
                style={{ borderColor: D.border, borderRadius: D.cardRadius }}
              >
                <span
                  className="flex shrink-0 items-center justify-center text-base"
                  style={{
                    width: D.iconTileSize,
                    height: D.iconTileSize,
                    borderRadius: D.iconTileRadius,
                    backgroundColor: D.iconTileBg,
                    color: D.coral,
                  }}
                  aria-hidden
                >
                  {SIMPLYUR_HOME_WHY_ICONS[key]}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-bold" style={{ color: D.navy }}>
                    {tr(`why.items.${key}.title`)}
                  </p>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: D.muted }}>
                    {tr(`why.items.${key}.body`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-[22px] px-0.5 pt-0.5">
          <Link href={simplyurPath(locale, "/guide")} className="text-[13px] font-semibold" style={{ color: D.coral }}>
            {tr("hero.guideLink")}
          </Link>
          <Link href={simplyurPath(locale, "/devices")} className="text-[13px] font-semibold" style={{ color: D.coral }}>
            {tr("hero.deviceLink")}
          </Link>
        </div>
      </div>
    </main>
  );
}
