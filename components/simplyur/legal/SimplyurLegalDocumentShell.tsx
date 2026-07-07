import type { ReactNode } from "react";
import Link from "next/link";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import { simplyurPath } from "@/lib/simplyur/constants";
import { SIMPLYUR_PLANS_DESIGN as D } from "@/lib/simplyur/plans-design";

type Props = {
  locale: SimplyurLocale;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function SimplyurLegalDocumentShell({ locale, title, subtitle, children }: Props) {
  return (
    <main
      className="mx-auto max-w-lg px-[22px] py-8 sm:max-w-2xl"
      style={{ backgroundColor: D.bg, paddingBottom: "calc(var(--su-tab-h) + 2.5rem)", minHeight: "70vh" }}
    >
      <article className="[word-break:keep-all]">
        <header className="border-b pb-5" style={{ borderColor: D.border }}>
          <Link
            href={simplyurPath(locale, "/recommend")}
            className="text-[13px] font-semibold"
            style={{ color: D.coral }}
          >
            ← simplyur
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: D.faint }}>
            Legal
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight" style={{ color: D.navy }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: D.muted }}>
              {subtitle}
            </p>
          ) : null}
        </header>
        <div
          className="mt-6 space-y-6 text-[15px] leading-[1.75]"
          style={{ color: D.navy }}
        >
          {children}
        </div>
      </article>
    </main>
  );
}
