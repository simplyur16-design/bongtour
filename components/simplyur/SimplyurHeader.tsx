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
    { key: "myTrip", href: simplyurPath(locale, "/my-trip"), match: path.startsWith("my-trip") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--su-brand-border)] bg-[color:var(--su-brand-bg-soft)]/95 backdrop-blur-sm">
      <div className="relative mx-auto flex max-w-lg min-w-0 items-center gap-2 px-3 py-2.5 sm:max-w-3xl sm:gap-3 sm:px-6 sm:py-4 lg:max-w-6xl">
        <Link href={simplyurPath(locale)} className="min-w-0 shrink">
          <SimplyurWordmark
            size="sm"
            className="[&_img]:h-7 [&_img]:w-auto [&_img]:max-w-[6.75rem] sm:[&_img]:h-9 sm:[&_img]:max-w-none"
          />
        </Link>

        <nav className="hidden min-w-0 items-center gap-6 lg:flex">
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

        {/* Phone: Find eSIM + language must share one row (app chrome). */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <SimplyurHeaderAuth locale={locale} user={user} />
          <Link
            href={simplyurPath(locale, "/recommend")}
            className="su-btn-navy inline-flex max-w-[7.25rem] shrink-0 truncate px-2.5 py-1.5 text-[11px] leading-none sm:max-w-none sm:px-5 sm:py-2 sm:text-sm"
          >
            <span className="sm:hidden">{tr("nav.findPlanShort")}</span>
            <span className="hidden sm:inline">{tr("hero.cta")}</span>
          </Link>
          <SimplyurLanguageSwitcher locale={locale} currentPath={currentPath} compact />
          <SimplyurMobileNav locale={locale} user={user} />
        </div>
      </div>
    </header>
  );
}
