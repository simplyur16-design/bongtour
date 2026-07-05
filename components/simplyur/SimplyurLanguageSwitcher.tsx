"use client";

import Link from "next/link";
import {
  SIMPLYUR_LOCALE_LABELS,
  SIMPLYUR_LOCALES,
  simplyurPath,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale; currentPath?: string };

export function SimplyurLanguageSwitcher({ locale, currentPath = "" }: Props) {
  const tr = useSimplyurT();

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg border border-[color:var(--su-hanji-border)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--su-ink-muted)] transition hover:border-[color:var(--su-celadon-muted)] hover:su-bg-celadon-light"
        aria-haspopup="listbox"
        aria-label={tr("language.label")}
      >
        {SIMPLYUR_LOCALE_LABELS[locale]}
        <span aria-hidden className="text-xs opacity-60">▾</span>
      </button>
      <ul
        role="listbox"
        className="absolute right-0 z-50 mt-1 hidden min-w-[10rem] rounded-lg border border-[color:var(--su-hanji-border)] bg-white py-1 shadow-lg group-focus-within:block group-hover:block"
      >
        {SIMPLYUR_LOCALES.map((loc) => (
          <li key={loc}>
            <Link
              href={simplyurPath(loc, currentPath)}
              className={`block px-4 py-2 text-sm transition hover:su-bg-celadon-light ${
                loc === locale
                  ? "font-semibold text-[color:var(--su-celadon-dark)]"
                  : "text-[color:var(--su-ink-muted)]"
              }`}
            >
              {SIMPLYUR_LOCALE_LABELS[loc]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
