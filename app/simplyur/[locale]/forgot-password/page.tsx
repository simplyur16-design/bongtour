import Link from 'next/link'
import { SimplyurForgotPasswordForm } from '@/components/simplyur/auth/SimplyurForgotPasswordForm'
import { SimplyurSignalPinIcon } from '@/components/simplyur/auth/SimplyurSignalPinIcon'
import { SIMPLYUR_LOGIN_1B } from '@/lib/simplyur/login-design'
import { simplyurPath, isSimplyurLocale, type SimplyurLocale } from '@/lib/simplyur/constants'
import { getSimplyurMessages, t } from '@/lib/simplyur/i18n'

type Props = {
  params: Promise<{ locale: string }>
}

/** REGRESSION-FREEZE[auth-password-reset]: simplyur forgot-password page — manifest */
export default async function SimplyurForgotPasswordPage({ params }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) return null
  const locale = raw as SimplyurLocale
  const messages = await getSimplyurMessages(locale)
  const signInHref = simplyurPath(locale, '/sign-in')

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
              {t(messages, 'auth.forgotPasswordTitle')}
            </h1>
            <p className="text-[13px] leading-relaxed" style={{ color: SIMPLYUR_LOGIN_1B.muted }}>
              {t(messages, 'auth.forgotPasswordSubtitle')}
            </p>
          </div>
          <SimplyurForgotPasswordForm
            locale={locale}
            signInHref={signInHref}
            labels={{
              email: t(messages, 'auth.emailLabel'),
              submit: t(messages, 'auth.forgotPasswordSubmit'),
              success: t(messages, 'auth.forgotPasswordSuccess'),
              backToSignIn: t(messages, 'auth.forgotPasswordBack'),
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
