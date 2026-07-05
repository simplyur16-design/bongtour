"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { User } from "next-auth";
import { simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale; user?: User | null };

export function SimplyurHeaderAuth({ locale, user: serverUser }: Props) {
  const tr = useSimplyurT();
  const { data: session, status } = useSession();
  const user = session?.user ?? serverUser;

  if (status === "loading" && !user) {
    return (
      <span
        className="hidden h-4 w-14 animate-pulse rounded bg-[color:var(--su-hanji-border)] sm:inline-block"
        aria-hidden
      />
    );
  }

  if (user) {
    const email = user.email?.trim();
    return (
      <div className="hidden items-center gap-3 sm:flex">
        <Link
          href={simplyurPath(locale, "/my-esim")}
          className="text-sm font-semibold text-[color:var(--su-brand-ur)] transition hover:opacity-80"
        >
          {tr("nav.myEsim")}
        </Link>
        {email ? (
          <span className="max-w-[120px] truncate text-xs text-[color:var(--su-ink-muted)]" title={email}>
            {email}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: simplyurPath(locale) })}
          className="text-xs font-medium text-[color:var(--su-ink-muted)] underline-offset-2 hover:underline"
        >
          {tr("nav.signOut")}
        </button>
      </div>
    );
  }

  return (
    <Link
      href={simplyurPath(locale, "/sign-in")}
      className="hidden text-sm font-medium text-[color:var(--su-ink-muted)] transition hover:su-text-celadon sm:inline-flex"
    >
      {tr("nav.signIn")}
    </Link>
  );
}
