import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SimplyurGoogleSignInForm } from "@/components/simplyur/auth/SimplyurGoogleSignInForm";
import { getAuthCsrfToken } from "@/lib/auth/get-auth-csrf-token";
import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth-provider";
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SimplyurSignInPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return null;
  const locale = raw as SimplyurLocale;

  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const defaultReturn = simplyurPath(locale, "/my-esim");
  const returnTo = callbackUrl?.startsWith("/") ? callbackUrl : defaultReturn;

  if (session?.user) {
    redirect(returnTo);
  }

  const messages = await getSimplyurMessages(locale);
  const googleOn = isGoogleOAuthConfigured();
  const csrfToken = googleOn ? await getAuthCsrfToken() : "";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-[color:var(--su-ink)]">
        {t(messages, "auth.title")}
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
        {t(messages, "auth.subtitle")}
      </p>

      {error ? (
        <p className="mt-6 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {t(messages, "auth.errorGeneric")}
        </p>
      ) : null}

      <div className="mt-10 flex w-full flex-col items-center gap-4">
        <SimplyurGoogleSignInForm
          callbackUrl={returnTo}
          csrfToken={csrfToken}
          label={t(messages, "auth.google")}
          disabled={!googleOn || !csrfToken}
          disabledHint={googleOn ? undefined : t(messages, "auth.googleNotConfigured")}
        />
      </div>

      <p className="mt-10 text-center text-xs text-[color:var(--su-ink-muted)]">
        {t(messages, "auth.comingSoon")}
      </p>

      <Link
        href={simplyurPath(locale)}
        className="mt-8 text-sm font-medium text-[color:var(--su-celadon)] hover:underline"
      >
        {t(messages, "auth.backHome")}
      </Link>
    </main>
  );
}
