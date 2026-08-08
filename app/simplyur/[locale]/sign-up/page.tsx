import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SimplyurEmailSignUpForm } from '@/components/simplyur/auth/SimplyurEmailSignUpForm'
import { SimplyurSignalPinIcon } from '@/components/simplyur/auth/SimplyurSignalPinIcon'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from '@/lib/simplyur/constants'
import { getSimplyurMessages, t } from '@/lib/simplyur/i18n'
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ callbackUrl?: string }>
}

/** simplyur email signup — foreign visitors only (domestic email register stays 410). */
/** REGRESSION-FREEZE[simplyur-email-signup]: sign-up page — manifest */
export default async function SimplyurSignUpPage({ params, searchParams }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) return null
  const locale = raw as SimplyurLocale

  const session = await auth()
  const { callbackUrl } = await searchParams
  const defaultReturn = simplyurPath(locale, '/my-esim')
  const returnTo = callbackUrl?.startsWith('/') ? callbackUrl : defaultReturn

  if (session?.user) {
    redirect(returnTo)
  }

  const messages = await getSimplyurMessages(locale)
  const signInHref =
    callbackUrl?.startsWith('/')
      ? `${simplyurPath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : simplyurPath(locale, '/sign-in')

  return (
    <main className="mx-auto w-full max-w-lg">
      <div
        className="relative flex min-h-[70vh] flex-col px-7 pb-10 pt-6"
        style={{ backgroundColor: SIMPLYUR_LOGIN_1B.bg }}
      >
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-8 flex flex-col items-center gap-3.5 text-center">
            <SimplyurSignalPinIcon width={36} height={43} />
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: SIMPLYUR_LOGIN_1B.navy }}>
              {t(messages, 'auth.signUpTitle')}
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
              {t(messages, 'auth.signUpSubtitle')}
            </p>
          </div>

          <SimplyurEmailSignUpForm
            locale={locale}
            callbackUrl={returnTo}
            signInHref={signInHref}
            labels={{
              email: t(messages, 'auth.emailLabel'),
              password: t(messages, 'auth.passwordLabel'),
              confirmPassword: t(messages, 'auth.confirmPasswordLabel'),
              termsPrefix: t(messages, 'auth.signUpTermsPrefix'),
              termsLink: t(messages, 'auth.signUpTermsLink'),
              privacyLink: t(messages, 'auth.signUpPrivacyLink'),
              termsAnd: t(messages, 'auth.signUpTermsAnd'),
              submit: t(messages, 'auth.signUpSubmit'),
              successSigningIn: t(messages, 'auth.signUpSigningIn'),
              errorGeneric: t(messages, 'auth.signUpErrorGeneric'),
              errorInvalidEmail: t(messages, 'auth.signUpErrorInvalidEmail'),
              errorWeakPassword: t(messages, 'auth.signUpErrorWeakPassword'),
              errorEmailTaken: t(messages, 'auth.signUpErrorEmailTaken'),
              errorTermsRequired: t(messages, 'auth.signUpErrorTermsRequired'),
              errorPasswordMismatch: t(messages, 'auth.signUpErrorPasswordMismatch'),
              haveAccount: t(messages, 'auth.haveAccount'),
              signInLink: t(messages, 'auth.signInLink'),
            }}
          />
        </div>

        <Link
          href={simplyurPath(locale)}
          className="mt-8 text-center text-sm font-medium hover:underline"
          style={{ color: SIMPLYUR_LOGIN_1B.coral }}
        >
          {t(messages, 'auth.backHome')}
        </Link>
      </div>
    </main>
  )
}
