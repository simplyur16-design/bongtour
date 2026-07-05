"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { User } from "next-auth";
import { useState } from "react";
import { simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale; user?: User | null };

const LINKS = [
  { key: "findPlan", path: "/recommend" },
  { key: "guide", path: "/guide" },
  { key: "devices", path: "/devices" },
] as const;

export function SimplyurMobileNav({ locale, user: serverUser }: Props) {
  const tr = useSimplyurT();
  const { data: session } = useSession();
  const user = session?.user ?? serverUser;
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--su-hanji-border)] bg-white text-[color:var(--su-ink)]"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
      </button>
      {open ? (
        <nav className="absolute left-0 right-0 top-full z-50 border-b border-[color:var(--su-hanji-border)] bg-[color:var(--su-hanji)] px-4 py-3 shadow-md">
          <ul className="space-y-1">
            {LINKS.map(({ key, path }) => (
              <li key={key}>
                <Link
                  href={simplyurPath(locale, path)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--su-ink-muted)] transition hover:su-bg-celadon-light hover:su-text-celadon"
                  onClick={() => setOpen(false)}
                >
                  {tr(`nav.${key}`)}
                </Link>
              </li>
            ))}
            <li className="border-t border-[color:var(--su-hanji-border)] pt-2">
              {user ? (
                <>
                  <Link
                    href={simplyurPath(locale, "/my-esim")}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-[color:var(--su-brand-ur)]"
                    onClick={() => setOpen(false)}
                  >
                    {tr("nav.myEsim")}
                  </Link>
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm text-[color:var(--su-ink-muted)]"
                    onClick={() => {
                      setOpen(false);
                      void signOut({ callbackUrl: simplyurPath(locale) });
                    }}
                  >
                    {tr("nav.signOut")}
                  </button>
                </>
              ) : (
                <Link
                  href={simplyurPath(locale, "/sign-in")}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--su-ink-muted)]"
                  onClick={() => setOpen(false)}
                >
                  {tr("nav.signIn")}
                </Link>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
