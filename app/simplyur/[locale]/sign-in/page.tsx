import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { SimplyurLogin1bPanel } from "@/components/simplyur/auth/SimplyurLogin1bPanel";
import {
  SIMPLYUR_DOMESTIC_ESIM_HREF,
  SIMPLYUR_DOMESTIC_SIGNIN_HREF,
} from "@/lib/simplyur/constants";
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from "@/lib/simplyur/constants";
import { getSimplyurMessages, t } from "@/lib/simplyur/i18n";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string; method?: string }>;
};

/** simplyur 웹 — design_handoff_login_1b (이메일만; Apple·Google은 앱). */
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

  const signUpHref =
    callbackUrl?.startsWith("/")
      ? `${simplyurPath(locale, "/sign-up")}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : simplyurPath(locale, "/sign-up");

  const labels = {
    welcomeTitle: t(messages, "auth.welcomeTitle"),
    welcomeSubtitle: t(messages, "auth.welcomeSubtitle"),
    skip: t(messages, "auth.skip"),
    continueEmail: t(messages, "auth.continueEmail"),
    emailSubtitle: t(messages, "auth.emailSubtitle"),
    email: t(messages, "auth.email"),
    signInSubmit: t(messages, "auth.signInSubmit"),
    invalidCredentials: t(messages, "auth.invalidCredentials"),
    appSocialHint: t(messages, "auth.appSocialHint"),
    domesticEsimLink: t(messages, "auth.domesticEsimLink"),
    domesticSignInLink: t(messages, "auth.domesticSignInLink"),
    backToMethods: t(messages, "auth.backToMethods"),
    backHome: t(messages, "auth.backHome"),
    noAccount: t(messages, "auth.noAccount"),
    signUpLink: t(messages, "auth.signUpLink"),
  };

  return (
    <main className="mx-auto w-full max-w-lg">
      {error ? (
        <p className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {t(messages, "auth.errorGeneric")}
        </p>
      ) : null}

      <SimplyurLogin1bPanel
        locale={locale}
        callbackUrl={returnTo}
        labels={labels}
        domesticEsimHref={SIMPLYUR_DOMESTIC_ESIM_HREF}
        domesticSignInHref={SIMPLYUR_DOMESTIC_SIGNIN_HREF}
        signUpHref={signUpHref}
      />
    </main>
  );
}
