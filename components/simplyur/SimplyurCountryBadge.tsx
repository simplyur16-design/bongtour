"use client";

import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

/** Localized country name only — never ISO2 codes or flag emoji. */
export function SimplyurCountryBadge({ className = "" }: { className?: string }) {
  const tr = useSimplyurT();
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[color:var(--su-celadon-muted)] bg-[color:var(--su-celadon-light)] px-3 py-1 text-xs font-semibold text-[color:var(--su-celadon-dark)] ${className}`}
    >
      {tr("countries.kr.name")}
    </span>
  );
}
