"use client";

import Link from "next/link";
import type { User } from "next-auth";
import { simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";
import { SimplyurLanguageSwitcher } from "@/components/simplyur/SimplyurLanguageSwitcher";
import { SimplyurMobileNav } from "@/components/simplyur/SimplyurMobileNav";
import { SimplyurWordmark } from "@/components/simplyur/SimplyurWordmark";
import { SimplyurHeaderAuth } from "@/components/simplyur/SimplyurHeaderAuth";

type Props = { locale: SimplyurLocale; currentPath?: string; user?: User | null };

export function SimplyurHeader({ locale, currentPath = "", user = null }: Props) {
  const tr = useSimplyurT();
  const path = currentPath.replace(/^\//, "");

  const nav = [
    { key: "home", href: simplyurPath(locale), match: path === "" },
    { key: "findPlan", href: simplyurPath(locale, "/recommend"), match: path.startsWith("recommend") || path.startsWith("product") },
    { key: "guide", href: simplyurPath(locale, "/guide"), match: path.startsWith("guide") },
    { key: "devices", href: simplyurPath(locale, "/devices"), match: path.startsWith("devices") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--su-brand-border)] bg-[color:var(--su-brand-bg-soft)]/95 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3 sm:max-w-3xl sm:px-6 sm:py-4 lg:max-w-6xl">
        <Link href={simplyurPath(locale)} className="shrink-0">
          <SimplyurWordmark size="sm" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map(({ key, href, match }) => (
            <Link
              key={key}
              href={href}
              className="su-nav-link"
              data-active={match ? "true" : undefined}
            >
              {tr(`nav.${key}`)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SimplyurHeaderAuth locale={locale} user={user} />
          <Link
            href={simplyurPath(locale, "/recommend")}
            className="su-btn-navy hidden px-5 py-2 text-sm md:inline-flex"
          >
            {tr("hero.cta")}
          </Link>
          <SimplyurLanguageSwitcher locale={locale} currentPath={currentPath} />
          <SimplyurMobileNav locale={locale} user={user} />
        </div>
      </div>
    </header>
  );
}
