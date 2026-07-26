"use client";

import Link from "next/link";
import { SimplyurWordmark } from "@/components/simplyur/SimplyurWordmark";
import { useSimplyurIntl, useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { simplyurPath } from "@/lib/simplyur/constants";
import {
  SIMPLYUR_FTC_BIZ_VERIFY_HREF,
  SIMPLYUR_LEGAL_ENTITY,
  simplyurLegalPath,
} from "@/lib/simplyur/legal-disclosures";

// REGRESSION-FREEZE[simplyur-pg-legal-surface]: simplyur PG 심사용 사업자·약관 푸터 — manifest

export function SimplyurFooter() {
  const { locale } = useSimplyurIntl();
  const tr = useSimplyurT();
  const e = SIMPLYUR_LEGAL_ENTITY;

  return (
    <footer className="mt-12 w-full border-t border-[color:var(--su-brand-border)] bg-white py-8 pb-[calc(var(--su-tab-h)+1.5rem)] md:py-10 md:pb-10">
      <div className="mx-auto flex max-w-lg flex-col px-[22px] sm:max-w-2xl">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <SimplyurWordmark size="sm" />
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{tr("footer.tagline")}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--su-brand-border)] bg-[color:var(--su-brand-bg-soft)] px-4 py-4 text-left text-[13px] leading-relaxed text-[color:var(--su-ink-muted)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--su-brand-navy)]">
            {tr("footer.businessInfoTitle")}
          </p>
          <ul className="mt-2 list-none space-y-0.5 pl-0 [word-break:keep-all]">
            <li>
              {tr("footer.legalNameLabel")}: Bong Tour Co., Ltd. ({e.legalName})
            </li>
            <li>
              {tr("footer.representativeLabel")}: {e.representativeName}
            </li>
            <li>
              {tr("footer.bizRegNoLabel")}: {e.bizRegNo}
            </li>
            <li>
              {tr("footer.mailOrderLabel")}: {e.mailOrderReportNo}
            </li>
            <li>{e.addressEn}</li>
            <li>
              {tr("footer.phoneLabel")}:{" "}
              <a href={e.phoneTel} className="underline underline-offset-2">
                {e.phone}
              </a>
            </li>
            <li>
              {tr("footer.emailLabel")}:{" "}
              <a href={e.emailHref} className="underline underline-offset-2">
                {e.email}
              </a>
            </li>
          </ul>
          <p className="mt-3">
            <a
              href={SIMPLYUR_FTC_BIZ_VERIFY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[color:var(--su-brand-coral)] underline underline-offset-2"
            >
              {tr("footer.ftcVerify")}
            </a>
          </p>
        </div>

        <nav
          className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold md:justify-start"
          aria-label="Legal"
        >
          <Link href={simplyurLegalPath(locale, "terms")} className="text-[color:var(--su-brand-navy)] hover:underline">
            {tr("footer.legalTerms")}
          </Link>
          <Link
            href={simplyurLegalPath(locale, "privacy")}
            className="text-[color:var(--su-brand-navy)] hover:underline"
          >
            {tr("footer.legalPrivacy")}
          </Link>
          <Link href={simplyurLegalPath(locale, "refund")} className="text-[color:var(--su-brand-navy)] hover:underline">
            {tr("footer.legalRefund")}
          </Link>
          <Link href={simplyurPath(locale, "/recommend")} className="text-[color:var(--su-brand-coral)] hover:underline">
            {tr("footer.productsLink")}
          </Link>
        </nav>

        <p className="mt-4 text-center text-xs text-[color:var(--su-ink-muted)] md:text-left">{tr("footer.email")}</p>
        <p className="mt-1 text-center text-xs text-[color:var(--su-ink-muted)] md:text-left">{tr("footer.phone")}</p>
      </div>
    </footer>
  );
}
