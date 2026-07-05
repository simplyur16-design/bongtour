"use client";

import { SimplyurWordmark } from "@/components/simplyur/SimplyurWordmark";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

export function SimplyurFooter() {
  const tr = useSimplyurT();

  return (
    <footer className="mt-12 hidden w-full border-t border-[color:var(--su-brand-border)] bg-white py-10 md:block">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
        <SimplyurWordmark size="sm" />
        <p className="mt-6 text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{tr("footer.tagline")}</p>
        <p className="mt-3 text-sm text-[color:var(--su-ink-muted)]">{tr("footer.email")}</p>
        <p className="mt-1 text-sm text-[color:var(--su-ink-muted)]">{tr("footer.phone")}</p>
      </div>
    </footer>
  );
}
