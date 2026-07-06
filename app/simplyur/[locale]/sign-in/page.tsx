import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { SimplyurEmailSignInForm } from "@/components/simplyur/auth/SimplyurEmailSignInForm";
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

/** simplyur 웹 — 외국인 방문객 전용. 이메일 폼 먼저; Google·Apple은 모바일 앱. */
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

  const labels = {
    email: t(messages, "auth.email"),
    emailSubtitle: t(messages, "auth.emailSubtitle"),
    invalidCredentials: t(messages, "auth.invalidCredentials"),
    appSocialHint: t(messages, "auth.appSocialHint"),
    domesticEsimLink: t(messages, "auth.domesticEsimLink"),
    domesticSignInLink: t(messages, "auth.domesticSignInLink"),
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-[color:var(--su-ink)]">
        {t(messages, "auth.title")}
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-[color:var(--su-ink-muted)]">
        {labels.emailSubtitle}
      </p>

      {error ? (
        <p className="mt-6 w-full max-w-sm rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
          {t(messages, "auth.errorGeneric")}
        </p>
      ) : null}

      <div className="mt-10 flex w-full max-w-sm flex-col items-center">
        <SimplyurEmailSignInForm
          callbackUrl={returnTo}
          submitLabel={labels.email}
          invalidCredentialsLabel={labels.invalidCredentials}
        />

        <p className="mt-8 max-w-sm text-center text-[11px] leading-relaxed text-[color:var(--su-ink-muted)]">
          {labels.appSocialHint}
        </p>

        <div className="mt-4 max-w-sm space-y-2 text-center text-[11px] leading-relaxed text-[color:var(--su-ink-muted)]">
          <p>
            <Link href={SIMPLYUR_DOMESTIC_ESIM_HREF} className="font-medium text-[color:var(--su-celadon)] hover:underline">
              {labels.domesticEsimLink}
            </Link>
          </p>
          <p>
            <Link href={SIMPLYUR_DOMESTIC_SIGNIN_HREF} className="font-medium text-[color:var(--su-celadon)] hover:underline">
              {labels.domesticSignInLink}
            </Link>
          </p>
        </div>
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
