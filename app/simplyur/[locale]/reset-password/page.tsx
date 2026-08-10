import Link from 'next/link'
import { SimplyurResetPasswordForm } from '@/components/simplyur/auth/SimplyurResetPasswordForm'
import { SimplyurSignalPinIcon } from '@/components/simplyur/auth/SimplyurSignalPinIcon'
import { simplyurMobileDeepLink } from '@/lib/auth/simplyur-oauth-callback'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from '@/lib/simplyur/constants'
import { getSimplyurMessages, t } from '@/lib/simplyur/i18n'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string; email?: string; returnTo?: string }>
}

/** REGRESSION-FREEZE[auth-password-reset]: simplyur reset-password page — manifest */
export default async function SimplyurResetPasswordPage({ params, searchParams }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) return null
  const locale = raw as SimplyurLocale
  const { token = '', email = '', returnTo = '' } = await searchParams
  const returnToApp = returnTo === 'app'
  const messages = await getSimplyurMessages(locale)
  const signInHref = simplyurPath(locale, '/sign-in')
  const openAppHref = simplyurMobileDeepLink('sign-in/email')

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
              {t(messages, 'auth.resetPasswordTitle')}
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
              {t(messages, 'auth.resetPasswordSubtitle')}
            </p>
          </div>
          <SimplyurResetPasswordForm
            email={email}
            token={token}
            signInHref={signInHref}
            returnToApp={returnToApp}
            openAppHref={openAppHref}
            labels={{
              newPassword: t(messages, 'auth.newPasswordLabel'),
              confirmPassword: t(messages, 'auth.confirmPasswordLabel'),
              submit: t(messages, 'auth.resetPasswordSubmit'),
              success: t(messages, 'auth.resetPasswordSuccess'),
              backToSignIn: t(messages, 'auth.forgotPasswordBack'),
              openApp: t(messages, 'auth.oauthCompleteOpenApp'),
              continueInBrowser: t(messages, 'auth.resetPasswordContinueBrowser'),
              errorWeak: t(messages, 'auth.signUpErrorWeakPassword'),
              errorMismatch: t(messages, 'auth.signUpErrorPasswordMismatch'),
              errorInvalid: t(messages, 'auth.resetPasswordInvalid'),
              errorGeneric: t(messages, 'auth.resetPasswordErrorGeneric'),
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
