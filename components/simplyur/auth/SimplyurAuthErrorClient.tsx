"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { simplyurPath, type SimplyurLocale } from "@/lib/simplyur/constants";
import { useSimplyurT } from "@/components/simplyur/SimplyurIntlProvider";

type Props = { locale: SimplyurLocale };

const ERROR_HINTS: Record<string, string> = {
  Configuration:
    "Check NEXTAUTH_URL (http://localhost:3001) and Google Console redirect: http://localhost:3001/api/auth/callback/google",
  OAuthAccountNotLinked:
    "This email is already registered with another sign-in method. Use that method or contact support.",
  AccessDenied: "Sign-in was denied. Your account may be suspended.",
};

export function SimplyurAuthErrorClient({ locale }: Props) {
  const tr = useSimplyurT();
  const params = useSearchParams();
  const code = params.get("error") ?? "Default";
  const hint = ERROR_HINTS[code] ?? tr("auth.errorGeneric");

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16">
      <h1 className="text-xl font-bold text-[color:var(--su-ink)]">{tr("auth.errorTitle")}</h1>
      <p className="mt-4 text-center text-sm leading-relaxed text-[color:var(--su-ink-muted)]">{hint}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={simplyurPath(locale, "/sign-in")} className="su-btn-navy px-6 py-2.5 text-sm">
          {tr("auth.tryAgain")}
        </Link>
        <Link
          href={simplyurPath(locale)}
          className="text-center text-sm font-medium text-[color:var(--su-celadon)] hover:underline"
        >
          {tr("auth.backHome")}
        </Link>
      </div>
    </main>
  );
}
