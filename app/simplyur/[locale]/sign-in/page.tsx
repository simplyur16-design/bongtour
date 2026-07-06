import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { SimplyurEmailSignInForm } from "@/components/simplyur/auth/SimplyurEmailSignInForm";
import {
  SimplyurSignInBackLink,
  SimplyurSignInPanel,
} from "@/components/simplyur/auth/SimplyurSignInPanel";
import {
  isSignInDetailMethodForAudience,
  isSignInMethodAllowedForAudience,
  isSignInMethodEnabled,
  signInMethodTitle,
} from "@/lib/auth/sign-in-method-catalog";
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string; method?: string }>;
};

/** simplyur 웹 — 외국인 방문객 전용. 이메일만; Google·Apple은 모바일 앱. */
export default async function SimplyurSignInPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isSimplyurLocale(raw)) return null;
  const locale = raw as SimplyurLocale;

  const session = await auth();
  const { callbackUrl, error, method: rawMethod } = await searchParams;
  const defaultReturn = simplyurPath(locale, "/my-esim");
  const returnTo = callbackUrl?.startsWith("/") ? callbackUrl : defaultReturn;

  if (session?.user) {
    redirect(returnTo);
  }

  if (rawMethod === "kakao" || rawMethod === "naver" || rawMethod === "google" || rawMethod === "apple") {
    notFound();
  }

  const messages = await getSimplyurMessages(locale);
  const emailOn = isSignInMethodEnabled("email");

  const method = isSignInDetailMethodForAudience(rawMethod, "globalWeb") ? rawMethod : undefined;

  if (method && (!isSignInMethodAllowedForAudience(method, "globalWeb") || !isSignInMethodEnabled(method))) {
    notFound();
  }

  const labels = {
    audienceBadge: t(messages, "auth.audienceBadge"),
    email: t(messages, "auth.email"),
    appSocialHint: t(messages, "auth.appSocialHint"),
    emailSubtitle: t(messages, "auth.emailSubtitle"),
    invalidCredentials: t(messages, "auth.invalidCredentials"),
    backToMethods: t(messages, "auth.backToMethods"),
    domesticEsimLink: t(messages, "auth.domesticEsimLink"),
    domesticSignInLink: t(messages, "auth.domesticSignInLink"),
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-[color:var(--su-ink)]">
        {method ? signInMethodTitle(method) : t(messages, "auth.title")}
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
        {method === "email" ? labels.emailSubtitle : t(messages, "auth.subtitle")}
      </p>

      {error ? (
        <p className="mt-6 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {t(messages, "auth.errorGeneric")}
        </p>
      ) : null}

      <div className="mt-10 flex w-full flex-col items-center">
        {!method ? (
          <SimplyurSignInPanel
            locale={locale}
            callbackUrl={returnTo}
            emailEnabled={emailOn}
            labels={labels}
          />
        ) : (
          <div className="w-full max-w-sm">
            <SimplyurSignInBackLink locale={locale} callbackUrl={returnTo} label={labels.backToMethods} />
            <SimplyurEmailSignInForm
              callbackUrl={returnTo}
              submitLabel={labels.email}
              invalidCredentialsLabel={labels.invalidCredentials}
            />
          </div>
        )}
      </div>

      <Link
        href={simplyurPath(locale)}
        className="mt-8 text-sm font-medium text-[color:var(--su-celadon)] hover:underline"
      >
        {t(messages, "auth.backHome")}
      </Link>
    </main>
  );
}
