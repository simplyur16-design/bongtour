"use client";

import Link from "next/link";
import { simplyurPath } from "@/lib/simplyur/constants";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurAbstractBg } from "@/components/simplyur/SimplyurAbstractBg";
import { SimplyurCountryBadge } from "@/components/simplyur/SimplyurCountryBadge";
import { SimplyurEsimIcon } from "@/components/simplyur/SimplyurEsimIcon";

export function SimplyurHero() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();

  return (
    <section className="relative su-hero-surface overflow-hidden border-b border-[color:var(--su-brand-border)]">
      <SimplyurAbstractBg />

      <div className="relative z-10 mx-auto max-w-lg px-4 py-10 text-center sm:px-6 sm:py-12">
        <SimplyurEsimIcon className="mx-auto h-12 w-12 text-[color:var(--su-brand-ur)]" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--su-brand-simply)]">
          eSIM
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--su-brand-ur)] sm:text-3xl">
          {tr("hero.headline")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[color:var(--su-ink-muted)] sm:text-base">
          {tr("hero.subtitle")}
        </p>
        <p className="mt-3 text-sm font-semibold text-[color:var(--su-brand-ur)]">
          <SimplyurCountryBadge />
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href={simplyurPath(locale, "/recommend")} className="su-btn-navy w-full py-3.5 text-center text-base">
            {tr("hero.cta")}
          </Link>
          <Link
            href={simplyurPath(locale, "/guide")}
            className="text-center text-sm font-medium text-[color:var(--su-brand-nav)] underline-offset-4 hover:underline"
          >
            {tr("hero.guideLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
