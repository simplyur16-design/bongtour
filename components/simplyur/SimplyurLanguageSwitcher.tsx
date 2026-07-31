"use client";

import Link from "next/link";
import {
  SIMPLYUR_LOCALE_LABELS,
  SIMPLYUR_LOCALE_SHORT_LABELS,
  SIMPLYUR_LOCALES,
  simplyurPath,
  type SimplyurLocale,
} from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale; currentPath?: string; compact?: boolean };

export function SimplyurLanguageSwitcher({
  locale,
  currentPath = "",
  compact = false,
}: Props) {
  const tr = useSimplyurT();

  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        className={`flex items-center gap-0.5 rounded-lg border border-[color:var(--su-hanji-border)] bg-white font-medium text-[color:var(--su-ink-muted)] transition hover:border-[color:var(--su-celadon-muted)] hover:su-bg-celadon-light ${
          compact
            ? "px-2 py-1.5 text-[11px] leading-none sm:gap-1 sm:px-3 sm:py-1.5 sm:text-sm"
            : "gap-1 px-3 py-1.5 text-sm"
        }`}
        aria-haspopup="listbox"
        aria-label={tr("language.label")}
      >
        <span className={compact ? "sm:hidden" : "hidden"}>
          {SIMPLYUR_LOCALE_SHORT_LABELS[locale]}
        </span>
        <span className={compact ? "hidden sm:inline" : undefined}>
          {SIMPLYUR_LOCALE_LABELS[locale]}
        </span>
        <span aria-hidden className="text-[10px] opacity-60 sm:text-xs">
          ▾
        </span>
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
