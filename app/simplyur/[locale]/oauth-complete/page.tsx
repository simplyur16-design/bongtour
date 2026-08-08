import { auth } from '@/auth'
import { SimplyurOAuthCompleteClient } from '@/components/simplyur/auth/SimplyurOAuthCompleteClient'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import {
  SIMPLYUR_OAUTH_RETURN_COOKIE,
} from '@/lib/auth/simplyur-oauth-return-cookie'
import { isSimplyurLocale, simplyurPath, type SimplyurLocale } from '@/lib/simplyur/constants'
import { getSimplyurMessages, t } from '@/lib/simplyur/i18n'

type Props = { params: Promise<{ locale: string }> }

/** simplyur OAuth 완료 — 앱 returnTo=app 복귀 브릿지 */
/** REGRESSION-FREEZE[simplyur-oauth-home-bridge]: clear return cookie on complete — manifest */
export default async function SimplyurOAuthCompletePage({ params }: Props) {
  const { locale: raw } = await params
  if (!isSimplyurLocale(raw)) notFound()
  const locale = raw as SimplyurLocale

  try {
    const jar = await cookies()
    jar.delete(SIMPLYUR_OAUTH_RETURN_COOKIE)
  } catch {
    /* ignore */
  }

  const session = await auth()
  const signedIn = Boolean(session?.user)
  const messages = await getSimplyurMessages(locale)

  const myEsimHref = simplyurPath(locale, '/my-esim')
  const signInHref = `${simplyurPath(locale, '/sign-in')}?callbackUrl=${encodeURIComponent(myEsimHref)}`

  return (
    <SimplyurOAuthCompleteClient
      locale={locale}
      signedIn={signedIn}
      accountEmail={session?.user?.email ?? null}
      signInHref={signInHref}
      myEsimHref={myEsimHref}
      labels={{
        title: t(messages, 'auth.oauthCompleteTitle'),
        body: t(messages, 'auth.oauthCompleteBody'),
        openApp: t(messages, 'auth.oauthCompleteOpenApp'),
        retrySignIn: t(messages, 'auth.signInSubmit'),
      }}
    />
  )
}
